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
	GET_LIVE_MATCHDAY,
	type LiveMatchdayDelivery,
	type LiveMatchdayDeliveryState,
	type LiveMatchdayFixture,
	type LiveMatchdayPlayer,
	type LiveMatchdayResponse,
	type LiveMatchdaySnapshot,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import { executeQuery } from '@/lib/graphql-client'
import { getCurrentSeasonKey } from '@/lib/season'
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

export type LiveMatchdayV2Payload = LiveMatchdayResponse

const statValue = (
	player: LiveMatchdayPlayer,
	identifiers: readonly string[]
): number => {
	const normalized = new Set(
		identifiers.map(identifier => identifier.toLowerCase())
	)
	const stat = player.stats.find(item =>
		normalized.has(item.identifier.toLowerCase())
	)
	return stat?.value ?? 0
}

const positionElementType: Record<LiveMatchdayPlayer['position'], number> = {
	GOALKEEPER: 1,
	DEFENDER: 2,
	MIDFIELDER: 3,
	FORWARD: 4
}

const matchdayDeliveryToLiveDelivery = (
	delivery: LiveMatchdayDelivery
): NonNullable<LiveSnapshotStatus['delivery']> => ({
	state: delivery.state === 'PENDING' ? 'UNAVAILABLE' : delivery.state,
	servedFrom: delivery.servedFrom ?? 'UNAVAILABLE',
	reasonCodes: delivery.reasonCodes
})

const deliveryStateToAvailability = (
	state: LiveMatchdayDeliveryState
): NonNullable<LiveSnapshotStatus['dataAvailability']> =>
	state === 'PENDING' ? 'UNAVAILABLE' : state

const mapLiveMatchdayPlayer = (player: LiveMatchdayPlayer): PlayerStat => ({
	player: player.webName,
	element: player.id,
	elementType: positionElementType[player.position],
	minutes: statValue(player, ['minutes', 'mins']),
	goals: statValue(player, ['goals', 'goals_scored', 'goalsScored']),
	assists: statValue(player, ['assists']),
	cleanSheets: statValue(player, ['clean_sheets', 'cleanSheets']),
	goalsConceded: statValue(player, ['goals_conceded', 'goalsConceded']),
	ownGoals: statValue(player, ['own_goals', 'ownGoals']),
	penalties_saved: statValue(player, ['penalties_saved', 'penaltiesSaved']),
	penalties_missed: statValue(player, ['penalties_missed', 'penaltiesMissed']),
	yellow_cards: statValue(player, ['yellow_cards', 'yellowCards']),
	red_cards: statValue(player, ['red_cards', 'redCards']),
	saves: statValue(player, ['saves']),
	bonus_points: statValue(player, ['bonus']),
	bps: statValue(player, ['bps']),
	defensiveContribution: statValue(player, [
		'defensive_contribution',
		'defensiveContribution'
	]),
	totalPoints: player.totalPoints
})

const matchdaySnapshotToLiveStatus = (
	snapshot: LiveMatchdaySnapshot,
	result: LiveMatchdayResponse['liveMatchday']
): LiveSnapshotStatus => {
	const scoreRevision = snapshot.revisions.scoreState
	const detailRevision = snapshot.revisions.playerDetail
	const contentUpdatedAt = [
		snapshot.times.deskContentUpdatedAt,
		snapshot.times.detailContentUpdatedAt
	]
		.filter((value): value is string => Boolean(value))
		.sort((left, right) => Date.parse(right) - Date.parse(left))[0]
	const dataAvailability =
		result.availability === 'READY'
			? deliveryStateToAvailability(result.delivery.state)
			: 'UNAVAILABLE'
	return {
		season: snapshot.season,
		eventId: snapshot.eventId,
		scoreCoreRevision: scoreRevision,
		state: snapshot.state,
		windowState: snapshot.state,
		dataAvailability,
		publishedAt: snapshot.times.deskPublishedAt,
		sourceCheckedAt: snapshot.times.deskSourceCheckedAt,
		contentUpdatedAt: contentUpdatedAt ?? snapshot.times.deskContentUpdatedAt,
		nextRefreshAt: snapshot.times.nextRefreshAt,
		revisions: {
			publicationId: snapshot.revisions.deskPublicationId,
			generation: snapshot.revisions.deskGeneration,
			lifecycle: snapshot.revisions.lifecycle,
			fixtureIdentity: snapshot.revisions.fixtureIdentity,
			scoreCore: scoreRevision,
			displayStats: detailRevision ?? scoreRevision,
			explain: detailRevision ?? scoreRevision,
			picksBase: null,
			officialAdjustment: null,
			previousTotals: null,
			finalResult: null,
			rules: 'live-matches-v2',
			algorithm: 'live-matches-v2',
			input:
				snapshot.revisions.detailPublicationId ??
				snapshot.revisions.deskPublicationId
		},
		times: {
			sourceCheckedAt: snapshot.times.deskSourceCheckedAt,
			contentUpdatedAt: snapshot.times.deskContentUpdatedAt,
			publishedAt: snapshot.times.deskPublishedAt,
			checkpointedAt: null,
			servedAt: snapshot.times.servedAt,
			staleAt:
				snapshot.times.deskStaleAt ??
				snapshot.times.nextRefreshAt ??
				snapshot.times.servedAt,
			nextRefreshAt: snapshot.times.nextRefreshAt
		},
		delivery: matchdayDeliveryToLiveDelivery(result.delivery)
	}
}

const mapLiveMatchdayFixture = (fixture: LiveMatchdayFixture): Match => {
	const players = fixture.players.map(player => ({
		mapped: mapLiveMatchdayPlayer(player),
		team:
			player.teamId === fixture.homeTeamId
				? fixture.homeTeamShortName
				: fixture.awayTeamShortName,
		teamId: player.teamId
	}))
	const homePlayers = players
		.filter(player => player.teamId === fixture.homeTeamId)
		.map(player => player.mapped)
	const awayPlayers = players
		.filter(player => player.teamId === fixture.awayTeamId)
		.map(player => player.mapped)
	return {
		id: String(fixture.fixtureId),
		eventId: fixture.eventId,
		homeTeam: {
			id: fixture.homeTeamId,
			name: fixture.homeTeamName,
			shortName: fixture.homeTeamShortName,
			score: fixture.homeScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: homePlayers
		},
		awayTeam: {
			id: fixture.awayTeamId,
			name: fixture.awayTeamName,
			shortName: fixture.awayTeamShortName,
			score: fixture.awayScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: awayPlayers
		},
		status:
			fixture.finished || fixture.finishedProvisional
				? 'FT'
				: fixture.started
					? 'LIVE'
					: 'NOT_STARTED',
		minute: fixture.minutes,
		kickoff: fixture.kickoffTime ?? '',
		viewers: 0,
		provisional: fixture.finishedProvisional,
		bonusPoints: players
			.filter(player => (player.mapped.bonus_points ?? 0) > 0)
			.map(player => ({
				player: player.mapped.player,
				team: player.team,
				points: player.mapped.bonus_points ?? 0
			})),
		bps: players
			.filter(player => player.mapped.bps != null)
			.map(player => ({
				player: player.mapped.player,
				team: player.team,
				score: player.mapped.bps ?? 0
			}))
			.sort((left, right) => right.score - left.score)
			.slice(0, 5)
	}
}

export function transformLiveMatchdayV2(
	snapshot: LiveMatchdaySnapshot
): Match[] {
	return snapshot.matches.map(mapLiveMatchdayFixture)
}

export function validateLiveMatchdayV2(
	payload: LiveMatchdayV2Payload
): LiveMatchdayV2Payload {
	if (!payload || typeof payload !== 'object' || !payload.liveMatchday) {
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	}
	const result = payload.liveMatchday
	const snapshot = result.snapshot
	if (result.availability === 'READY' && !snapshot) {
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	}
	if (!snapshot) return payload
	if (
		!snapshot.season ||
		!Number.isSafeInteger(snapshot.eventId) ||
		snapshot.eventId <= 0 ||
		!snapshot.revisions.deskPublicationId ||
		!Number.isSafeInteger(snapshot.revisions.deskGeneration) ||
		snapshot.revisions.deskGeneration <= 0 ||
		!snapshot.revisions.scoreState ||
		!snapshot.times.deskSourceCheckedAt ||
		!snapshot.times.deskContentUpdatedAt ||
		!snapshot.times.deskPublishedAt ||
		!Array.isArray(snapshot.matches)
	) {
		throw new Error('LIVE_MATCHDAY_INCOHERENT')
	}
	const fixtureIds = new Set<number>()
	for (const fixture of snapshot.matches) {
		if (
			fixture.eventId !== snapshot.eventId ||
			!Number.isSafeInteger(fixture.fixtureId) ||
			fixture.fixtureId <= 0 ||
			fixtureIds.has(fixture.fixtureId) ||
			!Number.isSafeInteger(fixture.homeTeamId) ||
			!Number.isSafeInteger(fixture.awayTeamId) ||
			fixture.homeTeamId <= 0 ||
			fixture.awayTeamId <= 0 ||
			fixture.homeTeamId === fixture.awayTeamId ||
			!Array.isArray(fixture.players)
		) {
			throw new Error('LIVE_MATCHDAY_INCOHERENT')
		}
		fixtureIds.add(fixture.fixtureId)
		const playerIds = new Set<number>()
		for (const player of fixture.players) {
			if (
				!Number.isSafeInteger(player.id) ||
				player.id <= 0 ||
				playerIds.has(player.id) ||
				(player.teamId !== fixture.homeTeamId &&
					player.teamId !== fixture.awayTeamId) ||
				!Number.isFinite(player.totalPoints) ||
				!Array.isArray(player.stats)
			) {
				throw new Error('LIVE_MATCHDAY_INCOHERENT')
			}
			playerIds.add(player.id)
			for (const stat of player.stats) {
				if (
					!stat.identifier ||
					!Number.isFinite(stat.value) ||
					!Number.isFinite(stat.points) ||
					(stat.pointsModification !== null &&
						!Number.isFinite(stat.pointsModification))
				) {
					throw new Error('LIVE_MATCHDAY_INCOHERENT')
				}
			}
		}
	}
	return payload
}

export async function loadLiveMatchdayV2(
	executor: QueryExecutor,
	eventId?: number | null
): Promise<LiveMatchdayV2Payload> {
	const payload = await executor<LiveMatchdayV2Payload>(
		GET_LIVE_MATCHDAY,
		{ eventId: eventId ?? null },
		{ cache: 'no-store' }
	)
	return validateLiveMatchdayV2(payload)
}

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

type CoreFixture = Omit<HomeFixture, 'eventId'>

/**
 * Once the published matchday is terminal, the next event's core fixture
 * schedule is the only safe source for the upcoming view.
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
		status: fixture.finished ? 'FT' : fixture.started ? 'LIVE' : 'NOT_STARTED',
		minute: 0,
		kickoff: fixture.kickoffTime ?? '',
		viewers: 0
	}))
}

const shouldLoadNextEventFixtures = (
	snapshot: LiveMatchdaySnapshot | null | undefined,
	currentEventId: number | null,
	nextEventId: number | null
): boolean => {
	if (
		!snapshot ||
		!currentEventId ||
		!nextEventId ||
		currentEventId === nextEventId
	)
		return false
	if (snapshot.state === 'FINALIZED') return true
	return (
		snapshot.matches.length > 0 &&
		snapshot.matches.every(
			fixture => fixture.finished || fixture.finishedProvisional
		)
	)
}

async function loadNextEventMatches(
	executor: QueryExecutor,
	currentEventId: number | null,
	nextEventId: number | null,
	snapshot: LiveMatchdaySnapshot | null | undefined
): Promise<Match[]> {
	if (!shouldLoadNextEventFixtures(snapshot, currentEventId, nextEventId))
		return []
	try {
		const response = await executor<HomeEventFixturesGraphQLResponse>(
			GET_HOME_EVENT_FIXTURES,
			{ eventId: nextEventId },
			{ cache: 'no-store' }
		)
		return transformCoreFixturesToMatches(nextEventId!, response.eventFixtures)
	} catch (error) {
		// Upcoming fixtures are an enhancement to a settled publication. A
		// failed core read must not erase the current event or its LKG.
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
	/** Browser refreshes use the V2 publication GET route. */
	preferHttp?: boolean
	signal?: AbortSignal
}

const validEventId = (value: unknown): number | null =>
	typeof value === 'number' && Number.isInteger(value) && value > 0
		? value
		: null

const LIVE_MATCHES_CONTRACT_HEADER = 'X-LetLetMe-Contract'
const LIVE_MATCHES_CONTRACT_VERSION = 'live-matches-v2'

export async function getLiveMatchesSnapshot(
	nextEventId: number | null,
	executor: QueryExecutor = executeQuery,
	currentEventId: number | null = null,
	options: LiveMatchesLoadOptions = {}
): Promise<LiveMatchesSnapshot> {
	let payload: LiveMatchdayV2Payload
	if (options.preferHttp && currentEventId) {
		const params = new URLSearchParams({
			season: String(getCurrentSeasonKey()),
			eventId: String(currentEventId)
		})
		const response = await fetch(`/api/live/matches?${params.toString()}`, {
			cache: 'no-store',
			headers: {
				[LIVE_MATCHES_CONTRACT_HEADER]: LIVE_MATCHES_CONTRACT_VERSION
			},
			signal: options.signal
		})
		if (!response.ok) {
			throw new Error(`Live matches request failed (${response.status})`)
		}
		payload = validateLiveMatchdayV2(
			(await response.json()) as LiveMatchdayV2Payload
		)
	} else {
		payload = await loadLiveMatchdayV2(executor, currentEventId)
	}

	const result = payload.liveMatchday
	const matchday = result.snapshot
	if (currentEventId && matchday && matchday.eventId !== currentEventId) {
		throw new Error('LIVE_MATCHDAY_EVENT_MISMATCH')
	}
	const current = validEventId(matchday?.eventId) ?? currentEventId
	const resolvedNextEventId = validEventId(matchday?.nextEventId) ?? nextEventId
	const nextMatches = await loadNextEventMatches(
		executor,
		current,
		resolvedNextEventId,
		matchday
	)
	const snapshot = matchday
		? matchdaySnapshotToLiveStatus(matchday, result)
		: null

	return {
		matches: [
			...(matchday ? transformLiveMatchdayV2(matchday) : []),
			...nextMatches
		],
		snapshot,
		currentEventId: current,
		nextEventId: resolvedNextEventId,
		windowState: matchday?.state,
		dataAvailability:
			result.availability === 'READY' ? result.delivery.state : 'UNAVAILABLE',
		nextRefreshAt: matchday?.times.nextRefreshAt ?? null
	}
}

export { GET_CURRENT_AND_NEXT_EVENTS }
export type { EventsResponse }
