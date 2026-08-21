import 'server-only'

import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import {
	buildFdrDeskModel,
	DEFAULT_FDR_HORIZON,
	type FdrHorizon
} from '@/lib/fixtures-fdr'
import { loadFixtureWindow } from '@/lib/fixture-window-server'
import {
	loadFixturePlanningGameweekOwnership,
	loadFixturePlanningSignals
} from '@/lib/fixture-planning-seed-server'
import { executePublicServerQuery } from '@/lib/graphql-server'
import type { EventsResponse } from '@/lib/graphql/operations/events'
import {
	GET_PLAYER_STATS_BOOTSTRAP,
	type CoreEventContextData,
	type PlayerStatsBootstrapResponse,
	type PlayerStatsSnapshotStatus
} from '@/lib/graphql/operations/players'
import { loadEntrySquadPicks } from '@/lib/load-entry-squad-picks'
import {
	buildMarketCompareCandidates,
	type MarketCompareCandidate
} from '@/lib/market-compare'
import {
	buildPlayerDirectoryQueryKey,
	type PlayerDirectorySeed,
	type PlayerDirectorySeasonState
} from '@/lib/player-directory-seed'
import type { RequestTiming } from '@/lib/request-timing'
import type { ReviewGameweekAnchorSource } from '@/lib/review-gameweek'
import type { SquadPickSeed } from '@/lib/squad-picks'
import { getVerifiedEntryContext } from '@/lib/session'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'

export type PlayerStatsPersonalSeed = {
	anchorGw: number
	anchorSource: ReviewGameweekAnchorSource
	mySquadPicks: SquadPickSeed[]
	squadState: 'ready' | 'not-published' | 'unbound' | 'unavailable'
	marketCompareCandidates: MarketCompareCandidate[]
	seasonStatsAvailable: boolean
	seasonStatsStatus: PlayerStatsSnapshotStatus
}

export type PlayerStatsBootstrapSeed = {
	context: CoreEventContextData
	statsContext: {
		status: PlayerStatsSnapshotStatus
		revision: string | null
		sourceCheckedAt: string | null
		publishedAt: string | null
		rowCount: number
		expectedRowCount: number
	}
	directorySeed: PlayerDirectorySeed
	events: EventsResponse
}

const PLAYER_DIRECTORY_SEED_SIZE = 20

function measure<T>(
	timing: RequestTiming | undefined,
	stage: string,
	task: () => Promise<T>
): Promise<T> {
	return timing ? timing.measure(stage, task) : task()
}

function reviewContext(
	context: CoreEventContextData,
	statsContext: { status: PlayerStatsSnapshotStatus }
): {
	anchorGw: number | null
	anchorSource: ReviewGameweekAnchorSource
	seasonStatsAvailable: boolean
	seasonStatsStatus: PlayerStatsSnapshotStatus
	seasonState: PlayerDirectorySeasonState
} {
	const seasonStatsAvailable = statsContext.status === 'AVAILABLE'
	const seasonState: PlayerDirectorySeasonState =
		statsContext.status === 'PRESEASON'
			? 'preseason'
			: seasonStatsAvailable
				? 'active'
				: 'unavailable'
	if (context.currentEventId != null) {
		return {
			anchorGw: context.currentEventId,
			anchorSource: 'current',
			seasonStatsAvailable,
			seasonStatsStatus: statsContext.status,
			seasonState
		}
	}
	if (context.nextEventId != null) {
		return {
			anchorGw: context.nextEventId > 1 ? context.nextEventId - 1 : 1,
			anchorSource: 'next-derived',
			seasonStatsAvailable,
			seasonStatsStatus: statsContext.status,
			seasonState
		}
	}
	if (context.latestFinishedEventId != null) {
		return {
			anchorGw: context.latestFinishedEventId,
			anchorSource: 'history',
			seasonStatsAvailable,
			seasonStatsStatus: statsContext.status,
			seasonState
		}
	}
	return {
		anchorGw: null,
		anchorSource: 'none',
		seasonStatsAvailable: false,
		seasonStatsStatus: statsContext.status,
		seasonState: 'unavailable'
	}
}

function eventsFromContext(context: CoreEventContextData): EventsResponse {
	return {
		current:
			context.currentEventId == null ? [] : [{ id: context.currentEventId }],
		next:
			context.nextEventId == null
				? []
				: [
						{
							id: context.nextEventId,
							deadlineTime: context.nextDeadlineTime ?? ''
						}
					]
	}
}

const loadPlayerStatsBootstrapFromOrigin = unstable_cache(
	async (): Promise<PlayerStatsBootstrapSeed> => {
		return coalescePublicSeed('player-stats-bootstrap', async () => {
			console.info('[public graphql cache]', {
				key: 'player-stats-bootstrap',
				workload: 'player-stats',
				cacheResult: 'miss-fill'
			})
			const response =
				await executePublicServerQuery<PlayerStatsBootstrapResponse>(
					'player-stats',
					GET_PLAYER_STATS_BOOTSTRAP,
					{ limit: PLAYER_DIRECTORY_SEED_SIZE },
					{ cache: 'no-store', timeoutMs: 5_000 }
				)
			const bootstrap = response.playerStatsBootstrap
			const review = reviewContext(bootstrap.context, bootstrap.statsContext)
			const anchorGw = review.anchorGw ?? 1
			const sortBy = review.seasonStatsAvailable ? 'total_desc' : 'own_desc'
			return {
				context: bootstrap.context,
				statsContext: bootstrap.statsContext,
				events: eventsFromContext(bootstrap.context),
				directorySeed: {
					teams: [...bootstrap.teams].sort((left, right) =>
						left.shortName.localeCompare(right.shortName)
					),
					teamsState: 'ready',
					players: bootstrap.directory.items,
					playersState: 'ready',
					totalCount: bootstrap.directory.totalCount,
					nextCursor: bootstrap.directory.nextCursor,
					queryKey: buildPlayerDirectoryQueryKey({
						search: null,
						teamId: null,
						position: null,
						maxPrice: null,
						sortBy,
						ownBand: 'ANY'
					}),
					seasonState: review.seasonState,
					anchorGw,
					seasonStatsAvailable: review.seasonStatsAvailable,
					seasonStatsStatus: review.seasonStatsStatus
				}
			}
		})
	},
	['graphql', 'player-stats-bootstrap', 'v1'],
	{ revalidate: RevalidateSeconds.events, tags: [CacheTag.events] }
)

const loadPlayerStatsBootstrapCached = cache(loadPlayerStatsBootstrapFromOrigin)

export async function loadPlayerStatsBootstrap(
	timing?: RequestTiming
): Promise<PlayerStatsBootstrapSeed> {
	return measure(timing, 'bootstrap', loadPlayerStatsBootstrapCached)
}

export async function loadPlayerDirectorySeed(): Promise<PlayerDirectorySeed> {
	return (await loadPlayerStatsBootstrap()).directorySeed
}

async function loadFixtureWindows(anchorGw: number, horizon: FdrHorizon) {
	const finalGw = Math.min(38, anchorGw + horizon - 1)
	const requests: Array<
		Promise<Awaited<ReturnType<typeof loadFixtureWindow>>>
	> = []
	for (let fromGw = anchorGw; fromGw <= finalGw; fromGw += 5) {
		requests.push(loadFixtureWindow(fromGw, Math.min(5, finalGw - fromGw + 1)))
	}
	return Promise.all(requests)
}

export async function loadPlayerStatsPersonalSeed(
	bootstrapPromise: Promise<PlayerStatsBootstrapSeed> = loadPlayerStatsBootstrap(),
	horizon: FdrHorizon = DEFAULT_FDR_HORIZON,
	timing?: RequestTiming
): Promise<PlayerStatsPersonalSeed | null> {
	const sessionPromise = measure(timing, 'session', getVerifiedEntryContext)
	// Keep the speculative authorization lookup from becoming an unhandled
	// rejection if bootstrap fails or has no usable gameweek.
	void sessionPromise.catch(() => undefined)
	const marketPromise = measure(timing, 'market', () =>
		loadFixturePlanningSignals().catch(error => {
			console.error('[player-stats-seed] market signals failed:', error)
			return null
		})
	)
	const gameweekOwnershipPromise = measure(timing, 'market-gameweek', () =>
		loadFixturePlanningGameweekOwnership().catch(error => {
			console.error('[player-stats-seed] gameweek ownership failed:', error)
			return null
		})
	)
	const bootstrap = await bootstrapPromise
	const review = reviewContext(bootstrap.context, bootstrap.statsContext)
	if (review.anchorGw == null || review.anchorGw <= 0) return null

	const fixturePromise = measure(timing, 'fixture', () =>
		loadFixtureWindows(review.anchorGw!, horizon)
	)
	const squadPromise = (async () => {
		const { session, entryId } = await sessionPromise
		if (entryId == null || !session) {
			return { picks: [] as SquadPickSeed[], state: 'unbound' as const }
		}
		return measure(timing, 'squad', () =>
			loadEntrySquadPicks(session, entryId, bootstrap.events).catch(error => {
				console.error('[player-stats-seed] entry picks failed:', error)
				return {
					picks: [] as SquadPickSeed[],
					state: 'unavailable' as const
				}
			})
		)
	})()

	const [windows, market, gameweekOwnership, squadResult] = await Promise.all([
		fixturePromise,
		marketPromise,
		gameweekOwnershipPromise,
		squadPromise
	])
	const fixturesByEvent = new Map<
		number,
		Array<(typeof windows)[number]['fixturesByEvent'][string][number]>
	>()
	const unknownEvents = new Set<number>()
	for (const window of windows) {
		for (const [eventId, fixtures] of Object.entries(window.fixturesByEvent)) {
			fixturesByEvent.set(Number(eventId), fixtures)
		}
		for (const eventId of window.unknownEventIds) unknownEvents.add(eventId)
	}
	const model = buildFdrDeskModel(fixturesByEvent, {
		fromGw: review.anchorGw,
		horizon,
		marketSignals: market
			? {
					mostSelected: market.marketPulse?.mostSelected ?? [],
					transferMovers: market.marketPulse?.transferMovers ?? [],
					gameweekOwnership: gameweekOwnership?.marketOwnershipOverview ?? null,
					rollingOwnership: null
				}
			: gameweekOwnership
				? {
						mostSelected: [],
						transferMovers: [],
						gameweekOwnership:
							gameweekOwnership?.marketOwnershipOverview ?? null,
						rollingOwnership: null
					}
				: null,
		knownTeams: bootstrap.directorySeed.teams,
		unknownEvents
	})

	return {
		anchorGw: review.anchorGw,
		anchorSource: review.anchorSource,
		mySquadPicks: squadResult.picks,
		squadState: squadResult.state,
		marketCompareCandidates: buildMarketCompareCandidates(model),
		seasonStatsAvailable: review.seasonStatsAvailable,
		seasonStatsStatus: review.seasonStatsStatus
	}
}
