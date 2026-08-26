import {
	GET_CURRENT_AND_NEXT_EVENTS,
	type EventsResponse
} from '@/lib/graphql/operations/events'
import {
	buildLiveFixturePlayersBatchQuery,
	GET_EVENT_LIVE_PERFORMANCES,
	GET_LIVE_MATCHDAY_DESK,
	type EventLivePerformancesResponse,
	type LiveFixturePerformance,
	type LiveFixturePlayersBatchResponse,
	type LiveFixturePlayersData,
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
}

export type QueryExecutor = <T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: QueryExecutorOptions
) => Promise<T>

export interface LiveMatchdayDeskPayload extends LiveMatchdayDeskResponse {
	fixturePlayers?: LiveFixturePlayersData[]
}

type LiveRef = { season: string; eventId: number; revision: string }

const FIXTURE_PLAYER_BATCH_SIZE = 5
const FIXTURE_PLAYER_BATCH_CONCURRENCY = 2

const REVISION_RECOVERY_OPTIONS = {
	handledErrorCodes: ['LIVE_REVISION_GONE']
} as const

const isSettledDesk = (
	desk: LiveMatchdayDeskResponse['liveMatchdayDesk']
): boolean =>
	desk.state === 'SETTLED' &&
	(desk.windowState === 'FINALIZED' || desk.dataAvailability === 'FINAL')

const hasCoherentLiveRevision = (
	desk: LiveMatchdayDeskResponse['liveMatchdayDesk']
): boolean =>
	(desk.source === 'REDIS' || desk.source === 'POSTGRES') &&
	Boolean(desk.liveRevision) &&
	desk.revision === desk.liveRevision

export function getPreferredLiveMatchesTab(
	matches: readonly Match[]
): 'live' | 'finished' | 'not-started' | 'upcoming' {
	const hasLive = matches.some(
		match => match.status === 'LIVE' || match.status === 'HT'
	)
	const hasFinished = matches.some(match => match.status === 'FT')
	const hasNotStarted = matches.some(match => match.status === 'NOT_STARTED')
	const hasUpcoming = matches.some(match => match.status === 'UPCOMING')

	if (hasLive) return 'live'
	if (hasNotStarted) return 'not-started'
	if (hasUpcoming) return 'upcoming'
	if (hasFinished) return 'finished'
	return 'live'
}

/**
 * Once every fixture in the anchored gameweek is finished, the next-fixture
 * rows are the page's primary view. A persisted `finished` tab must not pin
 * the page to the previous gameweek in that transition window.
 */
export function shouldAutoAdvanceToNextLiveMatchesTab(
	matches: readonly Match[]
): boolean {
	const hasUpcoming = matches.some(match => match.status === 'UPCOMING')
	const hasFinished = matches.some(match => match.status === 'FT')
	const hasCurrentMatch = matches.some(
		match =>
			match.status === 'LIVE' ||
			match.status === 'HT' ||
			match.status === 'NOT_STARTED'
	)

	return hasUpcoming && hasFinished && !hasCurrentMatch
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

const liveRevisionGone = (error: unknown): boolean => {
	if (error && typeof error === 'object' && 'code' in error) {
		if ((error as { code?: unknown }).code === 'LIVE_REVISION_GONE') return true
	}
	return String(error).includes('LIVE_REVISION_GONE')
}

const mapFixturePlayer = (row: LiveFixturePerformance): PlayerStat | null => {
	if (!row.player?.team) return null
	return {
		player: row.player.webName,
		element: row.player.id,
		elementType: POSITION_ELEMENT_TYPE[row.player.position],
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
	fixtureIds: number[]
): Promise<LiveFixturePlayersData[]> {
	if (!desk.liveRevision || fixtureIds.length === 0) return []
	const ref: LiveRef = {
		season: desk.season,
		eventId: desk.eventId,
		revision: desk.liveRevision
	}
	const batches = Array.from(
		{ length: Math.ceil(fixtureIds.length / FIXTURE_PLAYER_BATCH_SIZE) },
		(_, index) =>
			fixtureIds.slice(
				index * FIXTURE_PLAYER_BATCH_SIZE,
				(index + 1) * FIXTURE_PLAYER_BATCH_SIZE
			)
	)
	const responses: LiveFixturePlayersBatchResponse[] = new Array(batches.length)
	let nextBatchIndex = 0
	const loadNextBatch = async () => {
		while (true) {
			const batchIndex = nextBatchIndex++
			const batch = batches[batchIndex]
			if (!batch) return
			responses[batchIndex] = await executor<LiveFixturePlayersBatchResponse>(
				buildLiveFixturePlayersBatchQuery(batch.length),
				{
					ref,
					...Object.fromEntries(
						batch.map((fixtureId, index) => [`fixture${index}`, fixtureId])
					)
				},
				{ cache: 'no-store', ...REVISION_RECOVERY_OPTIONS }
			)
		}
	}
	await Promise.all(
		Array.from(
			{ length: Math.min(FIXTURE_PLAYER_BATCH_CONCURRENCY, batches.length) },
			() => loadNextBatch()
		)
	)

	const details: LiveFixturePlayersData[] = []
	for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
		const batch = batches[batchIndex]!
		const response = responses[batchIndex]!
		for (let index = 0; index < batch.length; index += 1) {
			const detail =
				response[`fixture${index}` as keyof LiveFixturePlayersBatchResponse]
			if (
				detail &&
					detail.season === ref.season &&
					detail.eventId === ref.eventId &&
					detail.revision === ref.revision &&
					detail.fixtureId === batch[index]
				) {
				details.push({ ...detail, source: 'LIVE_PUBLICATION' })
			}
		}
	}
	return details
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

	return matches.map(match => ({
		season: desk.season,
		eventId: desk.eventId,
		revision: null,
		source: 'DURABLE_DB' as const,
		fixtureId: match.fixtureId,
		players: performances.filter(performance => {
			const teamId = performance.player?.team?.id
			return teamId === match.homeTeamId || teamId === match.awayTeamId
		})
	}))
}

async function loadFixturePlayers(
	executor: QueryExecutor,
	desk: LiveMatchdayDeskResponse['liveMatchdayDesk']
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
			fixtureIds
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
	options: { includeFixturePlayers?: boolean } = {}
): Promise<LiveMatchdayDeskPayload> {
	const includeFixturePlayers = options.includeFixturePlayers !== false
	const queryDesk = (
		nextRef: LiveRef | null,
		queryOptions?: Pick<QueryExecutorOptions, 'handledErrorCodes'>
	) =>
		executor<LiveMatchdayDeskResponse>(
			GET_LIVE_MATCHDAY_DESK,
			{ ref: nextRef },
			{ ...queryOptions, cache: 'no-store' }
		)
	let recoveredRevision = false
	let desk: LiveMatchdayDeskResponse
	try {
		desk = await queryDesk(ref, ref ? REVISION_RECOVERY_OPTIONS : undefined)
	} catch (error) {
		if (!ref || !liveRevisionGone(error)) throw error
		desk = await queryDesk(null)
		recoveredRevision = true
	}

	const withOptionalFixturePlayers = async (
		payload: LiveMatchdayDeskResponse
	): Promise<LiveMatchdayDeskPayload> => ({
		...payload,
		fixturePlayers: includeFixturePlayers
			? await loadFixturePlayers(executor, payload.liveMatchdayDesk)
			: []
	})

	try {
		return await withOptionalFixturePlayers(desk)
	} catch (error) {
		if (!recoveredRevision && liveRevisionGone(error)) {
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
		homeTeam: {
			id: row.homeTeamId,
			name: row.homeTeamName,
			shortName: row.homeTeamShortName || getTeamShortName(row.homeTeamName),
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
			shortName: row.awayTeamShortName || getTeamShortName(row.awayTeamName),
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

export function transformUpcomingFixtures(
	fixtures: ReadonlyArray<
		| LiveMatchdayDeskRow
		| {
				id: number
				homeTeam: { name: string; shortName: string }
				awayTeam: { name: string; shortName: string }
				homeScore: number | null
				awayScore: number | null
				kickoffTime: string
				minutes?: number
		  }
	>
): Match[] {
	return fixtures.map(fixture => ({
		id: `next-${'fixtureId' in fixture ? fixture.fixtureId : fixture.id}`,
		homeTeam: {
			name:
				'homeTeamName' in fixture
					? fixture.homeTeamName
					: fixture.homeTeam.name,
			shortName:
				'homeTeamName' in fixture
					? fixture.homeTeamShortName || getTeamShortName(fixture.homeTeamName)
					: fixture.homeTeam.shortName ||
						getTeamShortName(fixture.homeTeam.name),
			score: fixture.homeScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		awayTeam: {
			name:
				'awayTeamName' in fixture
					? fixture.awayTeamName
					: fixture.awayTeam.name,
			shortName:
				'awayTeamName' in fixture
					? fixture.awayTeamShortName || getTeamShortName(fixture.awayTeamName)
					: fixture.awayTeam.shortName ||
						getTeamShortName(fixture.awayTeam.name),
			score: fixture.awayScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		status: 'UPCOMING',
		minute: fixture.minutes ?? 0,
		kickoff: fixture.kickoffTime ?? '',
		viewers: 0
	}))
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
	/** Browser refreshes use the cacheable revision-aware GET route. */
	preferHttp?: boolean
	revision?: string | null
	/** Initial RSC can defer the large player section to the browser refresh. */
	includeFixturePlayers?: boolean
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
	if (options.preferHttp && currentEventId && options.revision) {
		const params = new URLSearchParams({
			season: String(getCurrentSeasonKey()),
			eventId: String(currentEventId),
			revision: options.revision,
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
			currentEventId && options.revision
				? {
						season: String(getCurrentSeasonKey()),
						eventId: currentEventId,
						revision: options.revision
					}
				: null
		desk = await loadLiveMatchdayDesk(executor, ref, {
			includeFixturePlayers: options.includeFixturePlayers
		})
	}
	const current = validEventId(desk.liveMatchdayDesk?.eventId) ?? currentEventId
	const snapshot = desk.liveMatchdayDesk
		? {
				eventId: desk.liveMatchdayDesk.eventId,
				revision: hasCoherentLiveRevision(desk.liveMatchdayDesk)
					? desk.liveMatchdayDesk.liveRevision
					: null,
				state: desk.liveMatchdayDesk.windowState ?? desk.liveMatchdayDesk.state,
				publishedAt: hasCoherentLiveRevision(desk.liveMatchdayDesk)
					? desk.liveMatchdayDesk.publishedAt
					: null,
				checkedAt: desk.liveMatchdayDesk.sourceCheckedAt ?? null,
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
			...transformUpcomingFixtures(desk.liveMatchdayDesk?.nextFixtures ?? [])
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
