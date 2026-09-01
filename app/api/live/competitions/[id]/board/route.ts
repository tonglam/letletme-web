import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { GraphQLRequestError } from '@/lib/graphql-client'
import {
	GET_ENTRY_LIVE_COMPETITION_BOARD,
	type EntryLiveCompetitionBoardResponse,
	type EntryLiveCompetitionBoardVariables
} from '@/lib/graphql/operations/tournaments'
import { getVerifiedEntryContext } from '@/lib/session'

export const dynamic = 'force-dynamic'

const LIVE_COMPETITION_BOARD_TIMEOUT_MS = 5_000

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
	'TEAM_VALUE',
	'RANK',
	'ENTRY_NAME'
])
const allowedChips = new Set([
	'NONE',
	'TRIPLE_CAPTAIN',
	'BENCH_BOOST',
	'WILDCARD',
	'FREE_HIT',
	'MANAGER'
])

function parsePostVariables(
	value: unknown,
	entryId: number,
	tournamentId: number
): EntryLiveCompetitionBoardVariables | null {
	if (!isRecord(value) || !positiveInteger(value.eventId) || value.eventId > 38)
		return null
	if (value.input !== undefined && value.input !== null && !isRecord(value.input))
		return null
	const input = isRecord(value.input) ? value.input : {}
	const first = input.first ?? 20
	if (!positiveInteger(first) || first > 50) return null
	const after = input.after ?? null
	if (after !== null && (typeof after !== 'string' || after.length === 0 || after.length > 512))
		return null
	const search = input.search == null ? null : input.search
	if (search !== null && (typeof search !== 'string' || search.length > 100)) return null
	const sort = input.sort ?? 'EVENT_POINTS'
	const direction = input.direction ?? 'DESC'
	if (!allowedSorts.has(String(sort)) || (direction !== 'ASC' && direction !== 'DESC'))
		return null
	const chips = input.chips ?? []
	const captainPlayerIds = input.captainPlayerIds ?? []
	const teamCountRules = input.teamCountRules ?? []
	if (
		!Array.isArray(chips) ||
		chips.length > 6 ||
		!chips.every(chip => typeof chip === 'string' && allowedChips.has(chip)) ||
		new Set(chips).size !== chips.length ||
		!Array.isArray(captainPlayerIds) ||
		captainPlayerIds.length > 15 ||
		!captainPlayerIds.every(positiveInteger) ||
		new Set(captainPlayerIds).size !== captainPlayerIds.length ||
		!Array.isArray(teamCountRules) ||
		teamCountRules.length > 4
	)
		return null
	let ownership: NonNullable<EntryLiveCompetitionBoardVariables['input']>['ownership'] = null
	if (input.ownership != null) {
		if (!isRecord(input.ownership)) return null
		const playerIds = input.ownership.playerIds
		if (
			!Array.isArray(playerIds) ||
			playerIds.length === 0 ||
			playerIds.length > 5 ||
			!playerIds.every(positiveInteger) ||
			new Set(playerIds).size !== playerIds.length
		)
			return null
		const scope = input.ownership.scope ?? 'ANY'
		const captainMode = input.ownership.captainMode ?? 'ANY'
		if (
			!['ANY', 'STARTER', 'BENCH'].includes(String(scope)) ||
			!['ANY', 'CAPTAIN', 'VICE'].includes(String(captainMode))
		)
			return null
		ownership = {
			playerIds,
			scope: scope as NonNullable<typeof ownership>['scope'],
			captainMode: captainMode as NonNullable<typeof ownership>['captainMode']
		}
	}
	const normalizedTeamRules: NonNullable<
		NonNullable<EntryLiveCompetitionBoardVariables['input']>['teamCountRules']
	> = []
	for (const rule of teamCountRules) {
		if (!isRecord(rule)) return null
		const scope = rule.scope ?? 'ANY'
		if (
			!positiveInteger(rule.teamId) ||
			typeof rule.exactCount !== 'number' ||
			!Number.isSafeInteger(rule.exactCount) ||
			rule.exactCount < 0 ||
			rule.exactCount > 15 ||
			!['ANY', 'STARTER', 'BENCH'].includes(String(scope))
		)
			return null
		normalizedTeamRules.push({
			teamId: rule.teamId,
			exactCount: rule.exactCount,
			scope: scope as 'ANY' | 'STARTER' | 'BENCH'
		})
	}
	return {
		entryId,
		tournamentId,
		eventId: value.eventId,
		input: {
			first,
			after,
			sort: sort as NonNullable<EntryLiveCompetitionBoardVariables['input']>['sort'],
			direction,
			search,
			chips,
			captainPlayerIds,
			ownership,
			teamCountRules: normalizedTeamRules
		}
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
			{ error: 'UNAUTHENTICATED' },
			{ status: 401, headers: noStoreHeaders(requestId) }
		)
	const tournamentId = Number((await context.params).id)
	if (!positiveInteger(tournamentId))
		return NextResponse.json(
			{ error: 'BAD_USER_INPUT' },
			{ status: 400, headers: noStoreHeaders(requestId) }
		)
	const variables = parsePostVariables(await request.json().catch(() => null), entryId, tournamentId)
	if (!variables)
		return NextResponse.json(
			{ error: 'BAD_USER_INPUT' },
			{ status: 400, headers: noStoreHeaders(requestId) }
		)
	try {
		const data = await executeServerQueryWithSession<EntryLiveCompetitionBoardResponse>(
			session,
			GET_ENTRY_LIVE_COMPETITION_BOARD,
			variables as unknown as Record<string, unknown>,
			{
				cache: 'no-store',
				signal: request.signal,
				timeoutMs: LIVE_COMPETITION_BOARD_TIMEOUT_MS,
				contract: 'live-points-v2'
			}
		)
		return NextResponse.json(data, { headers: noStoreHeaders(requestId) })
	} catch (error) {
		const code = error instanceof GraphQLRequestError ? error.code : null
		const status =
			code === 'LIVE_BOARD_REVISION_GONE'
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
		if (status === 429 && error instanceof GraphQLRequestError)
			headers['Retry-After'] = String(Math.max(1, error.retryAfterSeconds ?? 30))
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
										: 'COMPETITION_UNAVAILABLE'
			},
			{ status, headers }
		)
	}
}
