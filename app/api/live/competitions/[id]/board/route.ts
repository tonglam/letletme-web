import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { GraphQLRequestError } from '@/lib/graphql-client'
import {
	GET_ENTRY_LIVE_COMPETITION_BOARD,
	GET_TOURNAMENT_LIVE_DESK,
	type EntryLiveCompetitionBoardResponse,
	type EntryLiveCompetitionBoardVariables
} from '@/lib/graphql/operations/tournaments'
import { getVerifiedEntryContext } from '@/lib/session'
import { getCurrentSeasonKey } from '@/lib/season'
import { loadTournamentLiveDeskWithRevisionRecovery } from '@/lib/tournament/liveDesk'

export const dynamic = 'force-dynamic'

// Full-field tournament boards (including large classic leagues) can require
// several upstream/cache reads on a cold revision. Keep this budget scoped to
// the board route; the request signal still aborts work when the client leaves.
const LIVE_COMPETITION_BOARD_TIMEOUT_MS = 20_000

const noStoreHeaders = (requestId?: string): Record<string, string> => ({
	'Cache-Control': 'private, no-store',
	...(requestId ? { 'X-Request-Id': requestId } : {})
})

const positiveInteger = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value > 0

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const allowedSorts = new Set([
	'EVENT_POINTS',
	'NET_EVENT_POINTS',
	'TRANSFER_COST',
	'PLAYED',
	'TOTAL_POINTS',
	'OVERALL_RANK',
	'TEAM_VALUE',
	'RANK',
	'ENTRY_NAME'
])
const allowedChips = new Set([
	'TRIPLE_CAPTAIN',
	'BENCH_BOOST',
	'WILDCARD',
	'FREE_HIT'
])

function parsePostVariables(
	value: unknown,
	entryId: number,
	tournamentId: number
): EntryLiveCompetitionBoardVariables | null {
	if (!isRecord(value) || !positiveInteger(value.eventId) || value.eventId > 38)
		return null
	const page = value.page ?? 1
	const pageSize = value.pageSize ?? 20
	if (!positiveInteger(page) || !positiveInteger(pageSize) || pageSize > 50)
		return null
	const search = value.search == null ? null : value.search
	if (search !== null && (typeof search !== 'string' || search.length > 100))
		return null
	const sort = value.sort ?? 'EVENT_POINTS'
	const direction = value.direction ?? 'DESC'
	if (
		!allowedSorts.has(String(sort)) ||
		(direction !== 'ASC' && direction !== 'DESC')
	)
		return null
	const chips = value.chips ?? []
	const captainPlayerIds = value.captainPlayerIds ?? []
	const teamCountRules = value.teamCountRules ?? []
	if (
		!Array.isArray(chips) ||
		chips.length > 5 ||
		!chips.every(chip => typeof chip === 'string' && allowedChips.has(chip)) ||
		new Set(chips).size !== chips.length ||
		!Array.isArray(captainPlayerIds) ||
		captainPlayerIds.length > 15 ||
		!captainPlayerIds.every(positiveInteger) ||
		new Set(captainPlayerIds).size !== captainPlayerIds.length ||
		!Array.isArray(teamCountRules) ||
		teamCountRules.length > 4
	) {
		return null
	}
	let ownership: EntryLiveCompetitionBoardVariables['ownership'] = null
	if (value.ownership != null) {
		if (!isRecord(value.ownership)) return null
		const playerIds = value.ownership.playerIds
		if (
			!Array.isArray(playerIds) ||
			playerIds.length === 0 ||
			playerIds.length > 5 ||
			!playerIds.every(positiveInteger) ||
			new Set(playerIds).size !== playerIds.length
		) {
			return null
		}
		const scope = value.ownership.scope ?? 'ANY'
		const captainMode = value.ownership.captainMode ?? 'ANY'
		if (
			!['ANY', 'STARTER', 'BENCH'].includes(String(scope)) ||
			!['ANY', 'CAPTAIN', 'VICE'].includes(String(captainMode))
		) {
			return null
		}
		ownership = {
			playerIds,
			scope: scope as NonNullable<typeof ownership>['scope'],
			captainMode: captainMode as NonNullable<typeof ownership>['captainMode']
		}
	}
	const normalizedTeamRules: NonNullable<
		EntryLiveCompetitionBoardVariables['teamCountRules']
	> = []
	for (const rule of teamCountRules) {
		if (!isRecord(rule)) return null
		const scope = rule.scope ?? 'ANY'
		if (
			!positiveInteger(rule.teamId) ||
			!positiveInteger(rule.exactCount) ||
			rule.exactCount > 15 ||
			!['ANY', 'STARTER', 'BENCH'].includes(String(scope))
		) {
			return null
		}
		normalizedTeamRules.push({
			teamId: rule.teamId,
			exactCount: rule.exactCount,
			scope: scope as 'ANY' | 'STARTER' | 'BENCH'
		})
	}
	let ref: EntryLiveCompetitionBoardVariables['ref'] = null
	if (value.ref != null) {
		if (
			!isRecord(value.ref) ||
			typeof value.ref.season !== 'string' ||
			value.ref.season.length === 0 ||
			value.ref.eventId !== value.eventId ||
			typeof value.ref.revision !== 'string' ||
			value.ref.revision.length === 0
		) {
			return null
		}
		ref = {
			season: value.ref.season,
			eventId: value.ref.eventId as number,
			revision: value.ref.revision
		}
	}
	const expectedBoardRevision = value.expectedBoardRevision ?? null
	if (
		expectedBoardRevision !== null &&
		(typeof expectedBoardRevision !== 'string' ||
			expectedBoardRevision.length === 0 ||
			expectedBoardRevision.length > 200)
	) {
		return null
	}
	if (page > 1 && expectedBoardRevision === null) return null
	return {
		entryId,
		tournamentId,
		eventId: value.eventId,
		ref,
		page,
		pageSize,
		sort: sort as EntryLiveCompetitionBoardVariables['sort'],
		direction,
		search,
		chips,
		captainPlayerIds,
		ownership,
		teamCountRules: normalizedTeamRules,
		expectedBoardRevision
	}
}

export async function POST(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const requestId = randomUUID()
	const { entryId, session } = await getVerifiedEntryContext()
	if (!entryId)
		return NextResponse.json(
			{ error: 'Unauthenticated' },
			{ status: 401, headers: noStoreHeaders(requestId) }
		)
	const tournamentId = Number((await context.params).id)
	if (!positiveInteger(tournamentId))
		return NextResponse.json(
			{ error: 'Invalid live competition parameters' },
			{ status: 400, headers: noStoreHeaders(requestId) }
		)
	const body = await request.json().catch(() => null)
	const variables = parsePostVariables(body, entryId, tournamentId)
	if (!variables)
		return NextResponse.json(
			{ error: 'Invalid live competition parameters' },
			{ status: 400, headers: noStoreHeaders(requestId) }
		)
	try {
		const data =
			await executeServerQueryWithSession<EntryLiveCompetitionBoardResponse>(
				session,
				GET_ENTRY_LIVE_COMPETITION_BOARD,
				variables as unknown as Record<string, unknown>,
				{
					cache: 'no-store',
					signal: request.signal,
					timeoutMs: LIVE_COMPETITION_BOARD_TIMEOUT_MS
				}
			)
		return NextResponse.json(data, { headers: noStoreHeaders(requestId) })
	} catch (error) {
		const code = error instanceof GraphQLRequestError ? error.code : null
		const status =
			code === 'LIVE_BOARD_REVISION_GONE' || code === 'LIVE_REVISION_GONE'
				? 409
				: code === 'RATE_LIMITED' ||
					  code === 'UPSTREAM_RATE_LIMITED' ||
					  (error instanceof GraphQLRequestError && error.status === 429)
					? 429
					: code === 'BAD_USER_INPUT'
						? 400
						: code === 'UNAUTHENTICATED'
							? 401
							: code === 'FORBIDDEN'
								? 403
								: 502
		const headers = noStoreHeaders(requestId)
		if (status === 429 && error instanceof GraphQLRequestError) {
			headers['Retry-After'] = String(
				Math.max(1, error.retryAfterSeconds ?? 30)
			)
		}
		return NextResponse.json(
			{
				error:
					status === 409
						? code
						: status === 429
							? 'RATE_LIMITED'
							: status === 401
								? 'UNAUTHENTICATED'
								: status === 403
									? 'FORBIDDEN'
									: status === 400
										? 'BAD_USER_INPUT'
										: 'Competition unavailable'
			},
			{ status, headers }
		)
	}
}

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const { entryId, session } = await getVerifiedEntryContext()
	if (!entryId)
		return NextResponse.json(
			{ error: 'Unauthenticated' },
			{ status: 401, headers: noStoreHeaders() }
		)
	const tournamentId = Number((await context.params).id)
	const params = new URL(request.url).searchParams
	const eventId = Number(params.get('eventId'))
	const revision = params.get('revision')
	if (
		!Number.isSafeInteger(tournamentId) ||
		tournamentId <= 0 ||
		!Number.isSafeInteger(eventId) ||
		eventId <= 0 ||
		!revision
	)
		return NextResponse.json(
			{ error: 'Invalid live competition parameters' },
			{ status: 400 }
		)
	try {
		const data = await loadTournamentLiveDeskWithRevisionRecovery(
			(ref, recoveryOptions) =>
				executeServerQueryWithSession(
					session,
					GET_TOURNAMENT_LIVE_DESK,
					{ entryId, selectedTournamentId: tournamentId, ref },
					{ cache: 'no-store', signal: request.signal, ...recoveryOptions }
				),
			{ season: String(getCurrentSeasonKey()), eventId, revision }
		)
		return NextResponse.json(data, {
			headers: { 'Cache-Control': 'private, no-store' }
		})
	} catch (error) {
		const status = String(error).includes('LIVE_REVISION_GONE') ? 409 : 502
		return NextResponse.json(
			{
				error: status === 409 ? 'LIVE_REVISION_GONE' : 'Competition unavailable'
			},
			{ status, headers: { 'Cache-Control': 'private, no-store' } }
		)
	}
}
