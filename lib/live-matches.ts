import {
	GET_CURRENT_AND_NEXT_EVENTS,
	type EventsResponse
} from '@/lib/graphql/operations/events'
import {
	GET_HOME_EVENT_FIXTURES,
	type HomeEventFixturesGraphQLResponse,
	type HomeFixture
} from '@/lib/graphql/operations/home'
import {
	buildLiveFixturePlayersBatchQuery,
	GET_EVENT_LIVE_PERFORMANCES,
	GET_LIVE_FIXTURE_PLAYERS,
	GET_LIVE_MATCHDAY_DESK,
	type EventLivePerformancesResponse,
	type LiveFixturePerformance,
	type LiveFixturePlayersBatchResponse,
	type LiveFixturePlayersData,
	type LiveFixturePlayersResponse,
	type LiveMatchdayDeskRow,
	type LiveMatchdayDeskResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import { executeQuery } from '@/lib/graphql-client'
import { getCurrentSeasonKey } from '@/lib/season'
import { teamFullNames } from '@/types/common'
import type { Match, PlayerStat } from '@/types/match'

type QueryExecutorOptions = {
	cache?: RequestCache
	signal?: AbortSignal
	handledErrorCodes?: readonly string[]
	suppressErrorLog?: boolean
}

export type QueryExecutor = <T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: QueryExecutorOptions
) => Promise<T>

export interface LiveMatchdayDeskPayload extends LiveMatchdayDeskResponse {
	fixturePlayers?: LiveFixturePlayersData[]
}

	type LiveRef = { season: string; eventId: number; scoreCoreRevision: string }

export type LiveFixturePlayerFailureCode =
	| 'LIVE_SCORE_REVISION_GONE'
	| 'LIVE_PUBLICATION_UNAVAILABLE'
	| 'RATE_LIMITED'
	| 'UNAUTHENTICATED'
	| 'FORBIDDEN'
	| 'REQUEST_TIMEOUT'
	| 'REQUEST_CANCELLED'
	| 'NETWORK_ERROR'
	| 'DETAIL_UNAVAILABLE'

export interface LiveFixturePlayerLoadFailure extends LiveRef {
	stage: 'batch' | 'fixture'
	fixtureIds: number[]
	code: LiveFixturePlayerFailureCode
}

type LiveMatchdayDeskLoadOptions = {
	includeFixturePlayers?: boolean
	onFixturePlayerFailure?: (failure: LiveFixturePlayerLoadFailure) => void
	suppressErrorLog?: boolean
}

const FIXTURE_PLAYER_BATCH_SIZE = 5
const FIXTURE_PLAYER_BATCH_CONCURRENCY = 2

const REVISION_RECOVERY_OPTIONS = {
	handledErrorCodes: ['LIVE_SCORE_REVISION_GONE']
} as const

const isSettledDesk = (
	desk: LiveMatchdayDeskResponse['liveMatchdayDesk']
): boolean =>
	desk.state === 'FINALIZED' &&
	(desk.windowState === 'FINALIZED' || desk.dataAvailability === 'FINAL')

const hasCoherentLiveRevision = (
	desk: LiveMatchdayDeskResponse['liveMatchdayDesk']
): boolean =>
	Boolean(desk.scoreCoreRevision) &&
	desk.revisions.scoreCore === desk.scoreCoreRevision

export function getPreferredLiveMatchesTab(
	matches: readonly Match[]
): 'live' | 'finished' | 'not-started' {
	const hasLive = matches.some(
		match => match.status === 'LIVE' || match.status === 'HT'
	)
	const hasFinished = matches.some(match => match.status === 'FT')
	const hasNotStarted = matches.some(match => match.status === 'NOT_STARTED')
	const hasUpcoming = matches.some(match => match.status === 'UPCOMING')

	if (hasLive) return 'live'
	if (hasNotStarted) return 'not-started'
	if (hasFinished) return 'finished'
	if (hasUpcoming) return 'not-started'
	return 'live'
}

const POSITION_ELEMENT_TYPE: Record<
	NonNullable<LiveFixturePerformance['player']>['position'],
	number
> = {
	GOALKEEPER: 1,
	DEFENDER: 2,
	MIDFIELDER: 3,
	FORWARD: 4
}

const errorCode = (error: unknown): string | null =>
	error && typeof error === 'object' && 'code' in error
		? typeof (error as { code?: unknown }).code === 'string'
			? (error as { code: string }).code
			: null
		: null

const errorStatus = (error: unknown): number | null =>
	error && typeof error === 'object' && 'status' in error
		? typeof (error as { status?: unknown }).status === 'number'
			? (error as { status: number }).status
			: null
		: null

export const liveFixturePlayerFailureCode = (
	error: unknown
): LiveFixturePlayerFailureCode => {
	const code = errorCode(error)
	if (
		code === 'LIVE_SCORE_REVISION_GONE' ||
		code === 'LIVE_PUBLICATION_UNAVAILABLE' ||
		code === 'RATE_LIMITED' ||
		code === 'UNAUTHENTICATED' ||
		code === 'FORBIDDEN' ||
		code === 'REQUEST_TIMEOUT' ||
		code === 'REQUEST_CANCELLED' ||
		code === 'NETWORK_ERROR'
	) {
		return code
	}
	const status = errorStatus(error)
	if (status === 401) return 'UNAUTHENTICATED'
	if (status === 403) return 'FORBIDDEN'
	if (status === 408) return 'REQUEST_TIMEOUT'
	if (status === 429) return 'RATE_LIMITED'
	if (error instanceof Error && error.name === 'AbortError')
		return 'REQUEST_CANCELLED'
	const message =
		error instanceof Error || typeof error === 'string' ? String(error) : ''
	if (message.includes('LIVE_SCORE_REVISION_GONE')) return 'LIVE_SCORE_REVISION_GONE'
	if (message.includes('LIVE_PUBLICATION_UNAVAILABLE'))
		return 'LIVE_PUBLICATION_UNAVAILABLE'
	return 'DETAIL_UNAVAILABLE'
}

const RECOVERABLE_FIXTURE_PLAYER_BATCH_CODES = new Set([
	'NOT_FOUND',
	'GRAPHQL_VALIDATION_FAILED',
	'INTERNAL_SERVER_ERROR',
	'UPSTREAM_GRAPHQL_ERROR'
])

const fixturePlayerBatchCanFallback = (error: unknown): boolean => {
	const status = errorStatus(error)
	if (status !== null && status !== 0 && status !== 200) return false
	const code = errorCode(error)
	return code !== null && RECOVERABLE_FIXTURE_PLAYER_BATCH_CODES.has(code)
}

const liveScoreRevisionGone = (error: unknown): boolean =>
	liveFixturePlayerFailureCode(error) === 'LIVE_SCORE_REVISION_GONE'

const isExpectedFixtureDetail = (
	detail: LiveFixturePlayersData | null | undefined,
	ref: LiveRef,
	fixtureId: number
): detail is LiveFixturePlayersData =>
	detail?.season === ref.season &&
	detail.eventId === ref.eventId &&
	detail.scoreCoreRevision === ref.scoreCoreRevision &&
	detail.fixtureId === fixtureId

const mapFixturePlayer = (row: LiveFixturePerformance): PlayerStat | null => {
	if (!row.player?.team) return null
	return {
		player: row.player.webName,
		element: row.player.id,
		elementType: POSITION_ELEMENT_TYPE[row.player.position],
		price: row.player.price,
		minutes: row.minutes ?? 0,
		goals: row.goalsScored ?? 0,
		assists: row.assists ?? 0,
		cleanSheets: row.cleanSheets ?? 0,
		goalsConceded: row.goalsConceded ?? 0,
		ownGoals: row.ownGoals ?? 0,
		penalties_saved: row.penaltiesSaved ?? 0,
		penalties_missed: row.penaltiesMissed ?? 0,
		yellow_cards: row.yellowCards ?? 0,
		red_cards: row.redCards ?? 0,
		saves: row.saves ?? 0,
		bonus_points: row.bonus ?? 0,
		bps: row.bps ?? 0,
		defensiveContribution: row.defensiveContribution ?? 0,
		totalPoints: row.totalPoints
	}
}

export function mergeLiveFixturePlayers(
	matches: Match[],
	details: readonly LiveFixturePlayersData[]
): Match[] {
	const byFixture = new Map(details.map(detail => [detail.fixtureId, detail]))
	return matches.map(match => {
		const detail = byFixture.get(Number(match.id))
		if (!detail) return match
		const rows = detail.players
			.map(row => ({ row, player: mapFixturePlayer(row) }))
			.filter(
				(value): value is { row: LiveFixturePerformance; player: PlayerStat } =>
					value.player !== null && value.row.player?.team != null
			)
		const homePlayers = rows
			.filter(value => value.row.player?.team?.id === Number(match.homeTeam.id))
			.map(value => value.player)
		const awayPlayers = rows
			.filter(value => value.row.player?.team?.id === Number(match.awayTeam.id))
			.map(value => value.player)
		const allPlayers = rows.map(value => ({
			...value.player,
			team: value.row.player?.team?.shortName ?? ''
		}))
		return {
			...match,
			homeTeam: { ...match.homeTeam, players: homePlayers },
			awayTeam: { ...match.awayTeam, players: awayPlayers },
			bonusPoints: allPlayers
				.filter(player => (player.bonus_points ?? 0) > 0)
				.map(player => ({
					player: player.player,
					team: player.team,
					points: player.bonus_points ?? 0
				})),
			bps: allPlayers
				.filter(player => player.bps != null)
				.map(player => ({
					player: player.player,
					team: player.team,
					score: player.bps ?? 0
				}))
				.sort((left, right) => right.score - left.score)
				.slice(0, 5)
		}
	})
}

async function loadPublicationFixturePlayers(
	executor: QueryExecutor,
	desk: LiveMatchdayDeskResponse['liveMatchdayDesk'],
	fixtureIds: number[],
	onFailure?: (failure: LiveFixturePlayerLoadFailure) => void
): Promise<LiveFixturePlayersData[]> {
	if (!desk.scoreCoreRevision || fixtureIds.length === 0) return []
	const ref: LiveRef = {
		season: desk.season,
		eventId: desk.eventId,
		scoreCoreRevision: desk.scoreCoreRevision
	}
	const batches = Array.from(
		{ length: Math.ceil(fixtureIds.length / FIXTURE_PLAYER_BATCH_SIZE) },
		(_, index) =>
			fixtureIds.slice(
				index * FIXTURE_PLAYER_BATCH_SIZE,
				(index + 1) * FIXTURE_PLAYER_BATCH_SIZE
			)
	)
	const reportFailure = (
		stage: LiveFixturePlayerLoadFailure['stage'],
		failedFixtureIds: number[],
		code: LiveFixturePlayerFailureCode
	) => onFailure?.({ ...ref, stage, fixtureIds: failedFixtureIds, code })
	const loadAbortController = new AbortController()
	let terminalFailure = false
	let terminalError: unknown
	const stopFixturePlayerLoads = (error: unknown) => {
		if (terminalFailure) return
		terminalError = error
		terminalFailure = true
		loadAbortController.abort()
	}
	const loadSingleFixture = async (
		fixtureId: number
	): Promise<LiveFixturePlayersData | null> => {
		try {
			const response = await executor<LiveFixturePlayersResponse>(
				GET_LIVE_FIXTURE_PLAYERS,
				{ ref, fixtureId },
				{ cache: 'no-store', signal: loadAbortController.signal }
			)
			if (isExpectedFixtureDetail(response.liveFixturePlayers, ref, fixtureId)) {
				return response.liveFixturePlayers
			}
			reportFailure('fixture', [fixtureId], 'DETAIL_UNAVAILABLE')
			return null
		} catch (error) {
			const code = liveFixturePlayerFailureCode(error)
			reportFailure('fixture', [fixtureId], code)
			if (code !== 'DETAIL_UNAVAILABLE') {
				stopFixturePlayerLoads(error)
				throw error
			}
			return null
		}
	}
	const loadSingleFallbacks = async (
		failedFixtureIds: number[]
	): Promise<LiveFixturePlayersData[]> => {
		const details: LiveFixturePlayersData[] = []
		for (const fixtureId of failedFixtureIds) {
			if (terminalFailure) break
			const detail = await loadSingleFixture(fixtureId)
			if (detail) details.push(detail)
		}
		return details
	}
	const loadBatch = async (
		batch: number[]
	): Promise<LiveFixturePlayersData[]> => {
		let response: LiveFixturePlayersBatchResponse
		try {
			response = await executor<LiveFixturePlayersBatchResponse>(
				buildLiveFixturePlayersBatchQuery(batch.length),
				{
					ref,
					...Object.fromEntries(
						batch.map((fixtureId, index) => [`fixture${index}`, fixtureId])
					)
				},
				{
					cache: 'no-store',
					signal: loadAbortController.signal,
					...REVISION_RECOVERY_OPTIONS
				}
			)
		} catch (error) {
			const code = liveFixturePlayerFailureCode(error)
			reportFailure('batch', [...batch], code)
			if (code !== 'DETAIL_UNAVAILABLE') {
				stopFixturePlayerLoads(error)
				throw error
			}
			if (!fixturePlayerBatchCanFallback(error)) return []
			return loadSingleFallbacks(batch)
		}

		const details: LiveFixturePlayersData[] = []
		const missingFixtureIds: number[] = []
		for (let index = 0; index < batch.length; index += 1) {
			const fixtureId = batch[index]!
			const detail =
				response[`fixture${index}` as keyof LiveFixturePlayersBatchResponse]
			if (isExpectedFixtureDetail(detail, ref, fixtureId)) {
				details.push(detail)
			} else {
				missingFixtureIds.push(fixtureId)
			}
		}
		if (missingFixtureIds.length > 0) {
			reportFailure('batch', missingFixtureIds, 'DETAIL_UNAVAILABLE')
			details.push(...(await loadSingleFallbacks(missingFixtureIds)))
		}
		return details
	}

	const detailsByBatch: LiveFixturePlayersData[][] = new Array(batches.length)
	let nextBatchIndex = 0
	const loadNextBatch = async () => {
		while (!terminalFailure) {
			const batchIndex = nextBatchIndex++
			const batch = batches[batchIndex]
			if (!batch) return
			detailsByBatch[batchIndex] = await loadBatch(batch)
		}
	}
	try {
		await Promise.all(
			Array.from(
				{ length: Math.min(FIXTURE_PLAYER_BATCH_CONCURRENCY, batches.length) },
				() => loadNextBatch()
			)
		)
	} catch (error) {
		if (terminalFailure) throw terminalError
		throw error
	}

	return detailsByBatch.flat()
}

async function loadDurableFixturePlayers(
	executor: QueryExecutor,
	desk: LiveMatchdayDeskResponse['liveMatchdayDesk']
): Promise<LiveFixturePlayersData[]> {
	const matches = desk.matches.filter(
		match => match.started || match.finished || match.finishedProvisional
	)
	if (matches.length === 0) return []

	const response = await executor<EventLivePerformancesResponse>(
		GET_EVENT_LIVE_PERFORMANCES,
		{ eventId: desk.eventId },
		{ cache: 'no-store' }
	)
	const performances = response.eventLive?.performances ?? []
	if (performances.length === 0) {
		throw new Error('Durable event-live performances are unavailable')
	}

	// eventLive.performances is an event-level aggregate and has no fixture id.
	// A team can appear in more than one fixture in a double gameweek, so its
	// aggregate cannot be assigned safely to either fixture. Leave those
	// fixtures unpopulated rather than displaying the same performance twice.
	const teamFixtureCounts = new Map<number, number>()
	for (const match of matches) {
		for (const teamId of [match.homeTeamId, match.awayTeamId]) {
			teamFixtureCounts.set(teamId, (teamFixtureCounts.get(teamId) ?? 0) + 1)
		}
	}

	return matches
		.filter(
			match =>
				[match.homeTeamId, match.awayTeamId].every(
					teamId => (teamFixtureCounts.get(teamId) ?? 0) === 1
				)
		)
		.map(match => ({
			season: desk.season,
			eventId: desk.eventId,
			scoreCoreRevision: desk.scoreCoreRevision,
			fixtureId: match.fixtureId,
			players: performances.filter(performance => {
				const teamId = performance.player?.team?.id
				return teamId === match.homeTeamId || teamId === match.awayTeamId
			})
		}))
}

async function loadFixturePlayers(
	executor: QueryExecutor,
	desk: LiveMatchdayDeskResponse['liveMatchdayDesk'],
	onFailure?: (failure: LiveFixturePlayerLoadFailure) => void
): Promise<LiveFixturePlayersData[]> {
	const fixtureIds = desk.matches
		.filter(
			match => match.started || match.finished || match.finishedProvisional
		)
		.map(match => match.fixtureId)
	if (fixtureIds.length === 0) return []

	const settled = isSettledDesk(desk)
	if (!hasCoherentLiveRevision(desk)) {
		return settled ? loadDurableFixturePlayers(executor, desk) : []
	}

	try {
		const details = await loadPublicationFixturePlayers(
			executor,
			desk,
			fixtureIds,
			onFailure
		)
		const complete =
			details.length === fixtureIds.length &&
			details.every(detail => detail.players.length > 0)
		if (settled && !complete) {
			return loadDurableFixturePlayers(executor, desk)
		}
		return details
	} catch (error) {
		if (!settled) throw error
		return loadDurableFixturePlayers(executor, desk)
	}
}

/** Resolve a desk and its optional player section with one bounded revision retry. */
export async function loadLiveMatchdayDesk(
	executor: QueryExecutor,
	ref: LiveRef | null = null,
	options: LiveMatchdayDeskLoadOptions = {}
): Promise<LiveMatchdayDeskPayload> {
	const includeFixturePlayers = options.includeFixturePlayers !== false
	const queryDesk = (
		nextRef: LiveRef | null,
		queryOptions?: Pick<QueryExecutorOptions, 'handledErrorCodes'>
	) =>
		executor<LiveMatchdayDeskResponse>(
			GET_LIVE_MATCHDAY_DESK,
			{ ref: nextRef },
			{
				...queryOptions,
				cache: 'no-store',
				suppressErrorLog: options.suppressErrorLog
			}
		)
	let recoveredRevision = false
	let desk: LiveMatchdayDeskResponse
	try {
		desk = await queryDesk(ref, ref ? REVISION_RECOVERY_OPTIONS : undefined)
	} catch (error) {
		if (!ref || !liveScoreRevisionGone(error)) throw error
		desk = await queryDesk(null)
		recoveredRevision = true
	}

	const withOptionalFixturePlayers = async (
		payload: LiveMatchdayDeskResponse
	): Promise<LiveMatchdayDeskPayload> => ({
		...payload,
		fixturePlayers: includeFixturePlayers
			? await loadFixturePlayers(
					executor,
				payload.liveMatchdayDesk,
				options.onFixturePlayerFailure
			)
			: []
	})

	try {
		return await withOptionalFixturePlayers(desk)
	} catch (error) {
		if (!recoveredRevision && liveScoreRevisionGone(error)) {
			const refreshed = await queryDesk(null)
			try {
				return await withOptionalFixturePlayers(refreshed)
			} catch {
				return { ...refreshed, fixturePlayers: [] }
			}
		}
		// Player details are a section-level enhancement. Preserve the score,
		// status and minute desk on any independent detail failure.
		return { ...desk, fixturePlayers: [] }
	}
}

function getTeamShortName(fullName: string): string {
	const normalized = fullName.trim()
	const exact = Object.entries(teamFullNames).find(
		([, name]) => name.toLowerCase() === normalized.toLowerCase()
	)
	if (exact) return exact[0]
	const partial = Object.entries(teamFullNames).find(
		([, name]) =>
			name.toLowerCase().includes(normalized.toLowerCase()) ||
			normalized.toLowerCase().includes(name.toLowerCase())
	)
	return partial?.[0] ?? normalized.substring(0, 3).toUpperCase()
}

export function transformLiveMatches(
	rows: LiveMatchdayDeskResponse['liveMatchdayDesk']['matches'],
	fixturePlayers: readonly LiveFixturePlayersData[] = []
): Match[] {
	const matches: Match[] = rows.map(row => ({
		id: String(row.fixtureId),
		eventId: row.eventId,
		homeTeam: {
			id: row.homeTeamId,
			name: row.homeTeamName,
			shortName: getTeamShortName(row.homeTeamName),
			score: row.homeScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		awayTeam: {
			id: row.awayTeamId,
			name: row.awayTeamName,
			shortName: getTeamShortName(row.awayTeamName),
			score: row.awayScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		status:
			row.finished || row.finishedProvisional
				? 'FT'
				: row.started
					? 'LIVE'
					: 'NOT_STARTED',
		minute: row.minutes,
		kickoff: row.kickoffTime ?? '',
		viewers: 0,
		provisional: row.finishedProvisional === true
	}))
	return mergeLiveFixturePlayers(matches, fixturePlayers)
}

type CoreFixture = Omit<HomeFixture, 'eventId'>

/**
 * The live desk owns the score overlay for its anchor event. Once that event
 * is settled, the next event's core fixture schedule is the only safe source
 * for the upcoming view; do not manufacture it from the settled live rows.
 */
export function transformCoreFixturesToMatches(
	eventId: number,
	fixtures: readonly CoreFixture[]
): Match[] {
	return fixtures.map(fixture => ({
		id: String(fixture.id),
		eventId,
		homeTeam: {
			id: fixture.homeTeam.id,
			name: fixture.homeTeam.name,
			shortName: fixture.homeTeam.shortName,
			score: fixture.homeScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		awayTeam: {
			id: fixture.awayTeam.id,
			name: fixture.awayTeam.name,
			shortName: fixture.awayTeam.shortName,
			score: fixture.awayScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		status: fixture.finished
			? 'FT'
			: fixture.started
				? 'LIVE'
				: 'NOT_STARTED',
		minute: 0,
		kickoff: fixture.kickoffTime ?? '',
		viewers: 0
	}))
}

const shouldLoadNextEventFixtures = (
	desk: LiveMatchdayDeskResponse['liveMatchdayDesk'] | null | undefined,
	currentEventId: number | null,
	nextEventId: number | null
): boolean => {
	if (!desk || !currentEventId || !nextEventId || currentEventId === nextEventId)
		return false
	if (desk.state === 'FINALIZED' || desk.windowState === 'FINALIZED') return true
	const rows = desk.matches ?? []
	return (
		rows.length > 0 &&
		rows.every(row => row.finished || row.finishedProvisional)
	)
}

async function loadNextEventMatches(
	executor: QueryExecutor,
	currentEventId: number | null,
	nextEventId: number | null,
	desk: LiveMatchdayDeskResponse['liveMatchdayDesk'] | null | undefined
): Promise<Match[]> {
	if (!shouldLoadNextEventFixtures(desk, currentEventId, nextEventId)) return []
	try {
		const response = await executor<HomeEventFixturesGraphQLResponse>(
			GET_HOME_EVENT_FIXTURES,
			{ eventId: nextEventId },
			{ cache: 'no-store' }
		)
		return transformCoreFixturesToMatches(nextEventId!, response.eventFixtures)
	} catch (error) {
		// Upcoming fixtures are an enhancement to the settled desk. A failed
		// core read must not erase the current event or make the live page fail.
		console.error('[live/matches] failed to load next event fixtures:', error)
		return []
	}
}

export interface LiveMatchesSnapshot {
	matches: Match[]
	snapshot: LiveSnapshotStatus | null
	currentEventId: number | null
	nextEventId: number | null
	windowState?: string
	dataAvailability?: string
	nextRefreshAt?: string | null
}

export interface LiveMatchesLoadOptions {
	/** Browser refreshes use the V2 score-core revision-aware GET route. */
	preferHttp?: boolean
	scoreCoreRevision?: string | null
	/** Initial RSC can defer the large player section to the browser refresh. */
	includeFixturePlayers?: boolean
	suppressErrorLog?: boolean
	signal?: AbortSignal
}

const validEventId = (value: unknown): number | null =>
	typeof value === 'number' && Number.isInteger(value) && value > 0
		? value
		: null

export async function getLiveMatchesSnapshot(
	nextEventId: number | null,
	executor: QueryExecutor = executeQuery,
	currentEventId: number | null = null,
	options: LiveMatchesLoadOptions = {}
): Promise<LiveMatchesSnapshot> {
	let desk: LiveMatchdayDeskPayload
	if (options.preferHttp && currentEventId && options.scoreCoreRevision) {
		const params = new URLSearchParams({
			season: String(getCurrentSeasonKey()),
			eventId: String(currentEventId),
				scoreCoreRevision: options.scoreCoreRevision,
			includePlayers: options.includeFixturePlayers === false ? '0' : '1'
		})
		const response = await fetch(`/api/live/matches?${params.toString()}`, {
			cache: 'no-store',
			signal: options.signal
		})
		if (!response.ok)
			throw new Error(`Live matches request failed (${response.status})`)
		desk = (await response.json()) as LiveMatchdayDeskPayload
	} else {
		const ref =
				currentEventId && options.scoreCoreRevision
				? {
						season: String(getCurrentSeasonKey()),
						eventId: currentEventId,
						scoreCoreRevision: options.scoreCoreRevision
					}
				: null
		desk = await loadLiveMatchdayDesk(executor, ref, {
		includeFixturePlayers: options.includeFixturePlayers,
		suppressErrorLog: options.suppressErrorLog
		})
	}
	const current = validEventId(desk.liveMatchdayDesk?.eventId) ?? currentEventId
	const nextMatches = await loadNextEventMatches(
		executor,
		current,
		nextEventId,
		desk.liveMatchdayDesk
	)
	const snapshot = desk.liveMatchdayDesk
		? {
				eventId: desk.liveMatchdayDesk.eventId,
					scoreCoreRevision: hasCoherentLiveRevision(desk.liveMatchdayDesk)
						? desk.liveMatchdayDesk.scoreCoreRevision
						: null,
				state: desk.liveMatchdayDesk.windowState ?? desk.liveMatchdayDesk.state,
				publishedAt: hasCoherentLiveRevision(desk.liveMatchdayDesk)
					? desk.liveMatchdayDesk.publishedAt
					: null,
					revisions: desk.liveMatchdayDesk.revisions,
					times: desk.liveMatchdayDesk.times,
					delivery: desk.liveMatchdayDesk.delivery,
				windowState: desk.liveMatchdayDesk.windowState,
				dataAvailability: desk.liveMatchdayDesk.dataAvailability,
				nextRefreshAt: desk.liveMatchdayDesk.nextRefreshAt
			}
		: null
	return {
		matches: [
			...transformLiveMatches(
				desk.liveMatchdayDesk?.matches ?? [],
				desk.fixturePlayers ?? []
			),
			...nextMatches
		],
		snapshot,
		currentEventId: current,
		nextEventId,
		windowState: desk.liveMatchdayDesk?.windowState,
		dataAvailability: desk.liveMatchdayDesk?.dataAvailability,
		nextRefreshAt: desk.liveMatchdayDesk?.nextRefreshAt ?? null
	}
}

export { GET_CURRENT_AND_NEXT_EVENTS }
export type { EventsResponse }
