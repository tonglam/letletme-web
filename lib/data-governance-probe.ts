import 'server-only'

import type { Session } from '@/lib/auth'
import { getCoreEventContext } from '@/lib/events'
import { loadGameweekDesk } from '@/lib/gameweek-desk-server'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import {
	GET_LIVE_POINTS,
	type LiveCalcDataResponse
} from '@/lib/graphql/operations/live'
import {
	GET_MY_FPL_MANAGER_GAMEWEEK,
	type MyFplManagerGameweekResponse
} from '@/lib/graphql/operations/my-fpl'
import {
	GET_ENTRY_LIVE_COMPETITION_BOARD,
	GET_TOURNAMENT_OFFICIAL_H2H,
	type EntryLiveCompetitionBoardResponse,
	type TournamentOfficialH2HResponse
} from '@/lib/graphql/operations/tournaments'
import { loadPriceChangeBoard } from '@/lib/price-change-server'
import { loadPlayerStatsDesk } from '@/lib/player-stats-desk-server'

export type DataGovernanceProbeRequest = {
	contractKey: string
	scopeKey: string
	periodKey: string
	eventId?: number | null
	sourceDay?: string | null
	producerRevision?: string | null
	expectedCount?: number | null
	observedCount?: number | null
}

export type DataGovernanceProbeResponse = {
	success: true
	contractKey: string
	scopeKey: string
	graphqlSeenAt: string
	webSeenAt: string
	graphqlRevision: string
	webRevision: string
	expectedCount: number | null
	observedCount: number | null
	complete: boolean
	settlementState?: 'PROVISIONAL' | 'FINALIZING' | 'FINAL' | 'DELAYED'
	coverageState?: 'COMPLETE' | 'CORRECTION_PENDING'
	timelinessState?: 'CURRENT' | 'STALE'
	finalizationDueAt?: string | null
}

export class DataGovernanceProbeError extends Error {
	readonly code:
		'INVALID_REQUEST' | 'UNSUPPORTED_CONTRACT' | 'BUSINESS_DATA_UNAVAILABLE'

	constructor(code: DataGovernanceProbeError['code'], message: string) {
		super(message)
		this.name = 'DataGovernanceProbeError'
		this.code = code
	}
}

const positiveInteger = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value > 0

const nonNegativeIntegerOrNull = (value: unknown): number | null =>
	value === null ||
	value === undefined ||
	(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
		? (value ?? null)
		: NaN

const requiredString = (value: unknown, field: string): string => {
	if (typeof value !== 'string' || value.trim() === '' || value.length > 256) {
		throw new DataGovernanceProbeError('INVALID_REQUEST', `${field} is invalid`)
	}
	return value
}

export function parseDataGovernanceProbeRequest(
	value: unknown
): DataGovernanceProbeRequest {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new DataGovernanceProbeError(
			'INVALID_REQUEST',
			'probe body must be an object'
		)
	}
	const body = value as Record<string, unknown>
	const contractKey = requiredString(body.contractKey, 'contractKey')
	const scopeKey = requiredString(body.scopeKey, 'scopeKey')
	const periodKey = requiredString(body.periodKey, 'periodKey')
	const eventId =
		body.eventId === null || body.eventId === undefined ? null : body.eventId
	if (eventId !== null && !positiveInteger(eventId)) {
		throw new DataGovernanceProbeError('INVALID_REQUEST', 'eventId is invalid')
	}
	const expectedCount = nonNegativeIntegerOrNull(body.expectedCount)
	const observedCount = nonNegativeIntegerOrNull(body.observedCount)
	if (Number.isNaN(expectedCount) || Number.isNaN(observedCount)) {
		throw new DataGovernanceProbeError('INVALID_REQUEST', 'counts are invalid')
	}
	const sourceDay =
		body.sourceDay === null || body.sourceDay === undefined
			? null
			: requiredString(body.sourceDay, 'sourceDay')
	const producerRevision =
		body.producerRevision === null || body.producerRevision === undefined
			? null
			: requiredString(body.producerRevision, 'producerRevision')
	return {
		contractKey,
		scopeKey,
		periodKey,
		eventId,
		sourceDay,
		producerRevision,
		expectedCount,
		observedCount
	}
}

const revision = (value: unknown): string => {
	if (typeof value !== 'string' && typeof value !== 'number') {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer response has no revision'
		)
	}
	const result = String(value).trim()
	if (!result) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer response has an empty revision'
		)
	}
	return result
}

type DataGovernanceCanary = Readonly<{
	entryId: number | null
	tournamentId: number | null
	playerIds: number[]
	userId: string
}>

type ProbeEventContext = Readonly<{
	eventId: number
	season: string
}>

const CANARY_INTEGER = /^[1-9]\d*$/
const MAX_LIVE_LEAGUE_CANARY_PAGES = Math.ceil(5_000 / 50) + 1

function parseCanaryInteger(name: string): number | null {
	const raw = process.env[name]?.trim() ?? ''
	if (!raw) return null
	if (!CANARY_INTEGER.test(raw)) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer canary configuration is invalid'
		)
	}
	const value = Number(raw)
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer canary configuration is invalid'
		)
	}
	return value
}

function canaryForContract(contractKey: string): DataGovernanceCanary {
	const requiresEntry = new Set([
		'entry-data',
		'live-picks',
		'league-tournament',
		'my-fpl',
		'official-h2h'
	])
	const requiresTournament = new Set(['league-tournament', 'official-h2h'])
	const requiresPlayers = contractKey === 'player-stats'
	const entryId = requiresEntry.has(contractKey)
		? parseCanaryInteger('DATA_GOVERNANCE_CANARY_ENTRY_ID')
		: null
	if (requiresEntry.has(contractKey) && entryId === null) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer canary entry is not configured'
		)
	}
	const tournamentId = requiresTournament
		? parseCanaryInteger('DATA_GOVERNANCE_CANARY_TOURNAMENT_ID')
		: null
	if (requiresTournament.has(contractKey) && tournamentId === null) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer canary tournament is not configured'
		)
	}
	const playerIds = requiresPlayers
		? (process.env.DATA_GOVERNANCE_CANARY_PLAYER_IDS?.trim() ?? '')
				.split(',')
				.map(value => value.trim())
				.filter(Boolean)
				.map(value => {
					if (!CANARY_INTEGER.test(value)) {
						throw new DataGovernanceProbeError(
							'BUSINESS_DATA_UNAVAILABLE',
							'consumer canary player configuration is invalid'
						)
					}
					return Number(value)
				})
		: []
	if (
		requiresPlayers &&
		(playerIds.length < 1 ||
			playerIds.length > 2 ||
			new Set(playerIds).size !== playerIds.length ||
			playerIds.some(value => !Number.isSafeInteger(value) || value < 1))
	) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer canary player configuration is invalid'
		)
	}
	const userId =
		process.env.DATA_GOVERNANCE_CANARY_USER_ID?.trim() ||
		'data-governance-probe'
	if (userId.length > 128) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer canary user configuration is invalid'
		)
	}
	return { entryId, tournamentId, playerIds, userId }
}

function canarySession(config: DataGovernanceCanary): Session {
	return {
		session: { id: 'data-governance-probe' },
		user: {
			id: config.userId,
			name: 'Data Governance Probe',
			fplEntryId: config.entryId,
			fplEntryVerifiedAt: new Date().toISOString()
		}
	} as unknown as Session
}

function scopeSeason(scopeKey: string): string | null {
	return (
		scopeKey.match(/^(?:season:)?(\d{4})(?::|$)/)?.[1] ??
		scopeKey.match(/^season:(\d{4})(?::|$)/)?.[1] ??
		null
	)
}

function assertScopeSeason(scopeKey: string, season: string): void {
	const requestedSeason = scopeSeason(scopeKey)
	if (requestedSeason && requestedSeason !== season) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer response season does not match the requested scope'
		)
	}
}

async function resolveProbeEvent(
	input: DataGovernanceProbeRequest
): Promise<ProbeEventContext> {
	const context = await getCoreEventContext()
	const eventId =
		input.eventId ??
		context.currentEventId ??
		context.latestFinishedEventId ??
		context.nextEventId
	if (!positiveInteger(eventId)) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer probe has no eligible event'
		)
	}
	assertScopeSeason(input.scopeKey, context.season)
	return { eventId, season: context.season }
}

function pickCountIsComplete(
	picks: ReadonlyArray<{ position?: number | null }>
): boolean {
	const positions = picks
		.map(pick => pick.position)
		.filter((position): position is number => positiveInteger(position))
	return (
		picks.length === 15 &&
		positions.length === 15 &&
		new Set(positions).size === 15 &&
		positions.every(position => position >= 1 && position <= 15)
	)
}

function snapshotRevision(value: unknown): string {
	if (!value || typeof value !== 'object') {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer response has no snapshot metadata'
		)
	}
	const candidate = (value as { revision?: unknown }).revision
	return revision(candidate)
}

async function probeEntryData(
	input: DataGovernanceProbeRequest,
	config: DataGovernanceCanary
): Promise<{
	revision: string
	complete: boolean
	settlementState: 'PROVISIONAL' | 'FINALIZING' | 'FINAL' | 'DELAYED'
	coverageState: 'COMPLETE' | 'CORRECTION_PENDING'
	timelinessState: 'CURRENT' | 'STALE'
	expectedCount: number
	observedCount: number
	finalizationDueAt: string | null
}> {
	const { eventId } = await resolveProbeEvent(input)
	const response =
		await executeServerQueryWithSession<MyFplManagerGameweekResponse>(
			canarySession(config),
			GET_MY_FPL_MANAGER_GAMEWEEK,
			{ eventId, snapshotRevision: null },
			{ cache: 'no-store', timeoutMs: 5_000 }
		)
	const gameweek = response.myFplManagerGameweek
	if (!gameweek || gameweek.eventId !== eventId) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'entry business loader returned the wrong event'
		)
	}
	const picks = gameweek.result?.picks ?? []
	const meta = gameweek.snapshotMeta
	if (!meta) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer response has no snapshot metadata'
		)
	}
	return {
		revision: snapshotRevision(meta),
		settlementState: meta.settlementState,
		coverageState: meta.coverageState,
		timelinessState: meta.timelinessState,
		expectedCount: meta.expectedEntryCount,
		observedCount: meta.observedEntryCount,
		finalizationDueAt: meta.finalizationDueAt,
		complete:
			gameweek.state === 'READY' &&
			gameweek.result?.eventId === eventId &&
			pickCountIsComplete(picks)
	}
}

async function probeLivePicks(
	input: DataGovernanceProbeRequest,
	config: DataGovernanceCanary
): Promise<{ revision: string; complete: boolean }> {
	const { eventId } = await resolveProbeEvent(input)
	if (config.entryId === null) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'live picks canary entry is not configured'
		)
	}
	const response = await executeServerQueryWithSession<LiveCalcDataResponse>(
		canarySession(config),
		GET_LIVE_POINTS,
		{ eventId, entryId: config.entryId },
		{ cache: 'no-store', timeoutMs: 5_000 }
	)
	const live = response.calcLivePointsByEntry
	if (!live || live.event !== eventId) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'live points loader returned the wrong event'
		)
	}
	const scoreCoreRevision =
		live.snapshot?.revisions?.scoreCore ?? live.score?.revisions.scoreCore
	return {
		revision: revision(scoreCoreRevision),
		complete: pickCountIsComplete(live.pickList) && live.snapshot != null
	}
}

async function probeTournament(
	input: DataGovernanceProbeRequest,
	config: DataGovernanceCanary,
	contractKey: 'league-tournament' | 'official-h2h'
): Promise<{ revision: string; complete: boolean }> {
	const { eventId } = await resolveProbeEvent(input)
	if (config.entryId === null || config.tournamentId === null) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			`${contractKey} canary is not configured`
		)
	}
	if (contractKey === 'official-h2h') {
		const response =
			await executeServerQueryWithSession<TournamentOfficialH2HResponse>(
				canarySession(config),
				GET_TOURNAMENT_OFFICIAL_H2H,
				{ tournamentId: config.tournamentId, eventId },
				{ cache: 'no-store', timeoutMs: 5_000, contract: 'live-points-v2' }
			)
		const official = response.tournamentOfficialH2H
		return {
			revision: revision(official.revisions?.content ?? 'unavailable'),
			complete:
				official.eventId === eventId &&
				official.availability === 'READY' &&
				official.standings?.state === 'READY' &&
				official.standings.rows.length > 0 &&
				official.matches.length > 0 &&
				official.matches.every(match => match.availability === 'READY')
		}
	}
	const response =
		await executeServerQueryWithSession<EntryLiveCompetitionBoardResponse>(
			canarySession(config),
			GET_ENTRY_LIVE_COMPETITION_BOARD,
			{
				entryId: config.entryId,
				tournamentId: config.tournamentId,
				eventId,
				input: { first: 50 }
			},
			{ cache: 'no-store', timeoutMs: 5_000, contract: 'live-points-v2' }
		)
	let board = response.entryLiveCompetitionBoard
	if (
		!board ||
		board.head.eventId !== eventId ||
		board.head.tournamentId !== config.tournamentId
	) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'live league board returned no matching event'
		)
	}
	const expectedRevision = revision(board.head.contentRevision)
	const seenEntries = new Set<number>()
	let after: string | null = null
	let pageCount = 0
	while (true) {
		if (
			board.head.eventId !== eventId ||
			board.head.tournamentId !== config.tournamentId ||
			revision(board.head.contentRevision) !== expectedRevision ||
			board.head.availability !== 'READY'
		) {
			throw new DataGovernanceProbeError(
				'BUSINESS_DATA_UNAVAILABLE',
				'live league board changed while the canary was paged'
			)
		}
		if (board.totalEntries <= 0 || board.totalEntries > 5_000) {
			throw new DataGovernanceProbeError(
				'BUSINESS_DATA_UNAVAILABLE',
				'live league board has an invalid bounded row count'
			)
		}
		for (const row of board.rows) {
			if (seenEntries.has(row.entry)) {
				throw new DataGovernanceProbeError(
					'BUSINESS_DATA_UNAVAILABLE',
					'live league board contains a duplicate entry'
				)
			}
			seenEntries.add(row.entry)
			if (
				(row.availability === 'READY' && row.score === null) ||
				(row.availability === 'MISSING' && row.score !== null) ||
				(row.availability !== 'READY' && row.availability !== 'MISSING')
			) {
				throw new DataGovernanceProbeError(
					'BUSINESS_DATA_UNAVAILABLE',
					'live league board contains an incomplete row'
				)
			}
		}
		pageCount += 1
		if (pageCount > MAX_LIVE_LEAGUE_CANARY_PAGES) {
			throw new DataGovernanceProbeError(
				'BUSINESS_DATA_UNAVAILABLE',
				'live league board pagination exceeded the safety bound'
			)
		}
		if (!board.pageInfo.hasNextPage) {
			if (
				(board.rows.length === 0 && board.pageInfo.endCursor !== null) ||
				seenEntries.size !== board.filteredEntries ||
				board.filteredEntries !== board.totalEntries
			) {
				throw new DataGovernanceProbeError(
					'BUSINESS_DATA_UNAVAILABLE',
					'live league board pagination is incomplete'
				)
			}
			break
		}
		if (!board.pageInfo.endCursor || board.pageInfo.endCursor === after) {
			throw new DataGovernanceProbeError(
				'BUSINESS_DATA_UNAVAILABLE',
				'live league board pagination did not advance'
			)
		}
		after = board.pageInfo.endCursor
		const next =
			await executeServerQueryWithSession<EntryLiveCompetitionBoardResponse>(
				canarySession(config),
				GET_ENTRY_LIVE_COMPETITION_BOARD,
				{
					entryId: config.entryId,
					tournamentId: config.tournamentId,
					eventId,
					input: { first: 50, after }
				},
				{ cache: 'no-store', timeoutMs: 5_000, contract: 'live-points-v2' }
			)
		board = next.entryLiveCompetitionBoard
	}
	return {
		revision: expectedRevision,
		complete:
			seenEntries.size === board.totalEntries &&
			response.entryLiveCompetitionBoard.viewerRow?.entry === config.entryId &&
			response.entryLiveCompetitionBoard.viewerRow.availability === 'READY'
	}
}

async function probeMyFpl(
	input: DataGovernanceProbeRequest,
	config: DataGovernanceCanary
): Promise<Awaited<ReturnType<typeof probeEntryData>>> {
	const { eventId } = await resolveProbeEvent(input)
	const result = await probeEntryData({ ...input, eventId }, config)
	return {
		...result,
		complete: result.complete && result.coverageState === 'COMPLETE'
	}
}

async function probePlayerStats(
	input: DataGovernanceProbeRequest,
	config: DataGovernanceCanary
): Promise<{ revision: string; complete: boolean; observedCount: number }> {
	const { eventId } = await resolveProbeEvent(input)
	const result = await loadPlayerStatsDesk(
		config.playerIds,
		eventId,
		5,
		'overview'
	)
	const revisions = result.entries.flatMap(entry => {
		const candidate = entry.overview?.statsContext?.revision
		return typeof candidate === 'string' && candidate.trim() ? [candidate] : []
	})
	if (revisions.length === 0 || new Set(revisions).size !== 1) {
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'player stats loader has no coherent revision'
		)
	}
	return {
		revision: revisions[0]!,
		complete:
			result.outcome === 'complete' &&
			result.entries.length === config.playerIds.length,
		observedCount: result.entries.length
	}
}

/** Execute the same server loaders and GraphQL operations used by public pages. */
export async function probeDataContract(
	input: DataGovernanceProbeRequest
): Promise<DataGovernanceProbeResponse> {
	let graphqlRevision: string
	let expectedCount: number | null = input.expectedCount ?? null
	let observedCount: number | null = input.observedCount ?? null
	let complete = false
	let settlementState: DataGovernanceProbeResponse['settlementState']
	let coverageState: DataGovernanceProbeResponse['coverageState']
	let timelinessState: DataGovernanceProbeResponse['timelinessState']
	let finalizationDueAt: string | null | undefined

	try {
		const config = canaryForContract(input.contractKey)
		switch (input.contractKey) {
			case 'core-fixtures': {
				const context = await getCoreEventContext()
				graphqlRevision = revision(context.revision)
				assertScopeSeason(input.scopeKey, context.season)
				complete = context.sourceCheckedAt.length > 0
				break
			}
			case 'market-price': {
				const board = await loadPriceChangeBoard()
				const market = board.priceChangeBoard
				graphqlRevision = revision(market.revision)
				expectedCount = market.expectedPlayerCount
				observedCount = market.observedPlayerCount
				complete = market.status === 'READY' && expectedCount === observedCount
				break
			}
			case 'live-snapshot': {
				const { eventId, season } = await resolveProbeEvent(input)
				const desk = await loadGameweekDesk(eventId)
				if (desk.scoreCoreRevision === null) {
					throw new DataGovernanceProbeError(
						'BUSINESS_DATA_UNAVAILABLE',
						'live snapshot has no canonical live revision'
					)
				}
				if (desk.season !== season) {
					throw new DataGovernanceProbeError(
						'BUSINESS_DATA_UNAVAILABLE',
						'live snapshot season does not match the requested scope'
					)
				}
				graphqlRevision = revision(desk.scoreCoreRevision)
				complete =
					desk.eventId === eventId &&
					desk.overviewState === 'AVAILABLE' &&
					desk.boardsState === 'AVAILABLE'
				break
			}
			case 'entry-data': {
				const result = await probeEntryData(input, config)
				graphqlRevision = result.revision
				complete = result.complete
				break
			}
			case 'live-picks': {
				const result = await probeLivePicks(input, config)
				graphqlRevision = result.revision
				complete = result.complete
				break
			}
			case 'league-tournament':
			case 'official-h2h': {
				const result = await probeTournament(input, config, input.contractKey)
				graphqlRevision = result.revision
				complete = result.complete
				break
			}
			case 'my-fpl': {
				const result = await probeMyFpl(input, config)
				graphqlRevision = result.revision
				settlementState = result.settlementState
				coverageState = result.coverageState
				timelinessState = result.timelinessState
				// These counts must come from the GraphQL snapshot metadata.  The
				// producer values are an assertion supplied by Data, not a value
				// that may overwrite what the consumer actually observed.
				expectedCount = result.expectedCount
				observedCount = result.observedCount
				finalizationDueAt = result.finalizationDueAt
				complete =
					result.complete &&
					(input.producerRevision === null ||
						input.producerRevision === undefined ||
						input.producerRevision === result.revision) &&
					(input.expectedCount === null ||
						input.expectedCount === undefined ||
						input.expectedCount === result.expectedCount) &&
					(input.observedCount === null ||
						input.observedCount === undefined ||
						input.observedCount === result.observedCount)
				break
			}
			case 'player-stats': {
				const result = await probePlayerStats(input, config)
				graphqlRevision = result.revision
				observedCount = input.observedCount ?? result.observedCount
				complete = result.complete
				break
			}
			default:
				throw new DataGovernanceProbeError(
					'UNSUPPORTED_CONTRACT',
					`no server-side canary loader is configured for ${input.contractKey}`
				)
		}
	} catch (error) {
		if (error instanceof DataGovernanceProbeError) throw error
		throw new DataGovernanceProbeError(
			'BUSINESS_DATA_UNAVAILABLE',
			'consumer business loader failed'
		)
	}

	const graphqlSeenAt = new Date().toISOString()
	const webSeenAt = new Date().toISOString()
	// Do not claim a consumer revision is authoritative when the request's
	// producer target is already known to disagree. Data will also enforce this
	// parity check when it writes the observation.
	const webRevision = graphqlRevision!
	// Response is aggregate-only: canary identifiers and row-level payloads
	// never cross the Data/Web governance boundary.
	return {
		success: true,
		contractKey: input.contractKey,
		scopeKey: input.scopeKey,
		graphqlSeenAt,
		webSeenAt,
		graphqlRevision: graphqlRevision!,
		webRevision,
		expectedCount,
		observedCount,
		complete,
		...(settlementState ? { settlementState } : {}),
		...(coverageState ? { coverageState } : {}),
		...(timelinessState ? { timelinessState } : {}),
		...(finalizationDueAt !== undefined ? { finalizationDueAt } : {})
	}
}
