import 'server-only'

import {
	CacheTag,
	publicFetchOptions,
	RevalidateSeconds
} from '@/lib/cache-policy'
import {
	buildFdrDeskModel,
	DEFAULT_FDR_HORIZON,
	type FdrHorizon
} from '@/lib/fixtures-fdr'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_EVENT_FIXTURES,
	type EventFixturesResponse,
	type Fixture
} from '@/lib/graphql/operations/events'
import {
	GET_TEAMS_FOR_PICKER,
	SEARCH_PLAYERS_FOR_PICKER,
	type PlayerSearchForPickerResponse,
	type TeamsForPickerResponse
} from '@/lib/graphql/operations/players'
import {
	GET_MARKET_PULSE,
	type MarketPulseResponse
} from '@/lib/graphql/operations/market'
import { loadEntrySquadPicks } from '@/lib/load-entry-squad-picks'
import {
	buildMarketCompareCandidates,
	type MarketCompareCandidate
} from '@/lib/market-compare'
import {
	resolveReviewGameweekAnchor,
	type ReviewGameweekAnchorSource
} from '@/lib/review-gameweek'
import type { SquadPickSeed } from '@/lib/squad-picks'
import { getVerifiedEntryContext } from '@/lib/session'
import {
	buildPlayerDirectoryQueryKey,
	type PlayerDirectorySeed,
	type PlayerDirectorySeasonState
} from '@/lib/player-directory-seed'

export type PlayerStatsPersonalSeed = {
	anchorGw: number
	anchorSource: ReviewGameweekAnchorSource
	mySquadPicks: SquadPickSeed[]
	squadState: 'ready' | 'not-published' | 'unbound' | 'unavailable'
	marketCompareCandidates: MarketCompareCandidate[]
	seasonStatsAvailable: boolean
}

const PLAYER_DIRECTORY_SEED_SIZE = 20

const settleDirectoryRequest = <T>(promise: Promise<T>) =>
	promise.then(
		value => ({ status: 'fulfilled' as const, value }),
		reason => ({ status: 'rejected' as const, reason })
	)

function seasonContext(
	events: Awaited<ReturnType<typeof getCurrentAndNextEvents>>
) {
	const review = resolveReviewGameweekAnchor(events)
	const anchorGw = review.anchorGw ?? 1
	const seasonStatsAvailable =
		review.currentGw != null ||
		(review.source === 'next-derived' && anchorGw > 1) ||
		review.source === 'history'
	const seasonState: PlayerDirectorySeasonState = seasonStatsAvailable
		? 'active'
		: events?.next?.length
			? 'preseason'
			: 'unavailable'
	return { anchorGw, seasonStatsAvailable, seasonState }
}

export async function loadPlayerDirectorySeed(): Promise<PlayerDirectorySeed> {
	const eventsPromise = getCurrentAndNextEvents()
	const teamsPromise = executePublicServerQuery<TeamsForPickerResponse>(
		GET_TEAMS_FOR_PICKER,
		undefined,
		publicFetchOptions({
			revalidate: RevalidateSeconds.publicStats,
			tags: [CacheTag.gameweekStats]
		})
	)
	const teamsResultPromise = settleDirectoryRequest(teamsPromise)
	const events = await eventsPromise
	const { seasonStatsAvailable } = seasonContext(events)
	const sortBy = seasonStatsAvailable ? 'total_desc' : 'own_desc'
	const playersPromise =
		executePublicServerQuery<PlayerSearchForPickerResponse>(
			SEARCH_PLAYERS_FOR_PICKER,
			{
				search: null,
				filter: null,
				sort: seasonStatsAvailable ? 'TOTAL_POINTS_DESC' : 'OWNERSHIP_DESC',
				ownershipBand: null,
				limit: PLAYER_DIRECTORY_SEED_SIZE,
				cursor: null
			},
			publicFetchOptions({
				revalidate: RevalidateSeconds.publicStats,
				tags: [CacheTag.gameweekStats]
			})
		)
	const [teamsResult, playersResult] = await Promise.all([
		teamsResultPromise,
		settleDirectoryRequest(playersPromise)
	])
	const context = seasonContext(events)
	if (teamsResult.status === 'rejected') {
		console.error(
			'[player-stats-seed] public team directory failed:',
			teamsResult.reason
		)
	}
	if (playersResult.status === 'rejected') {
		console.error(
			'[player-stats-seed] public player directory failed:',
			playersResult.reason
		)
	}
	const teams =
		teamsResult.status === 'fulfilled' ? teamsResult.value.teams : []
	const players =
		playersResult.status === 'fulfilled'
			? playersResult.value.playersForPicker
			: { items: [], totalCount: 0, nextCursor: null }

	return {
		teams: [...teams].sort((a, b) => a.shortName.localeCompare(b.shortName)),
		teamsState: teamsResult.status === 'fulfilled' ? 'ready' : 'unavailable',
		players: players.items,
		playersState:
			playersResult.status === 'fulfilled' ? 'ready' : 'unavailable',
		totalCount: players.totalCount,
		nextCursor: players.nextCursor,
		queryKey: buildPlayerDirectoryQueryKey({
			search: null,
			teamId: null,
			position: null,
			maxPrice: null,
			sortBy,
			ownBand: 'ANY'
		}),
		seasonState: context.seasonState,
		anchorGw: context.anchorGw,
		seasonStatsAvailable: context.seasonStatsAvailable
	}
}

async function fetchEventFixtures(eventId: number): Promise<Fixture[]> {
	const response = await executePublicServerQuery<EventFixturesResponse>(
		GET_EVENT_FIXTURES,
		{ eventId },
		publicFetchOptions({
			revalidate: RevalidateSeconds.publicStats,
			tags: [CacheTag.fixtures, CacheTag.events]
		})
	)
	return response.eventFixtures ?? []
}

export async function loadPlayerStatsPersonalSeed(
	horizon: FdrHorizon = DEFAULT_FDR_HORIZON
): Promise<PlayerStatsPersonalSeed | null> {
	const [events, { session, entryId }] = await Promise.all([
		getCurrentAndNextEvents(),
		getVerifiedEntryContext()
	])
	const review = resolveReviewGameweekAnchor(events)
	const anchorGw = review.anchorGw
	if (anchorGw == null || anchorGw <= 0) return null
	const seasonStatsAvailable =
		review.currentGw != null ||
		(review.source === 'next-derived' && anchorGw > 1) ||
		review.source === 'history'

	const eventIds = Array.from(
		{ length: horizon },
		(_, i) => anchorGw + i
	).filter(id => id >= 1 && id <= 38)

	const [fixtureListsResult, market, squadResult] = await Promise.all([
		Promise.allSettled(eventIds.map(id => fetchEventFixtures(id))),
		executePublicServerQuery<MarketPulseResponse>(
			GET_MARKET_PULSE,
			{ days: 14 },
			publicFetchOptions({
				revalidate: RevalidateSeconds.market,
				tags: [CacheTag.market]
			})
		).catch(err => {
			console.error('[player-stats-seed] market pulse failed:', err)
			return null
		}),
		entryId != null && session
			? loadEntrySquadPicks(session, entryId, events)
					.catch(err => {
						console.error('[player-stats-seed] entry picks failed:', err)
						return {
							picks: [] as SquadPickSeed[],
							state: 'unavailable' as const
						}
					})
			: Promise.resolve({
					picks: [] as SquadPickSeed[],
					state: 'unbound' as const
				})
	])

	const fixturesByEvent = new Map<number, Fixture[]>()
	eventIds.forEach((id, i) => {
		const result = fixtureListsResult[i]
		fixturesByEvent.set(id, result?.status === 'fulfilled' ? result.value : [])
		if (result?.status === 'rejected') {
			console.error(
				`[player-stats-seed] fixtures for GW${id} failed:`,
				result.reason
			)
		}
	})

	const marketPulse = market?.marketPulse ?? null
	const model = buildFdrDeskModel(fixturesByEvent, {
		fromGw: anchorGw,
		horizon,
		marketPulse
	})

	return {
		anchorGw,
		anchorSource: review.source,
		mySquadPicks: squadResult.picks,
		squadState: squadResult.state,
		marketCompareCandidates: buildMarketCompareCandidates(model),
		seasonStatsAvailable
	}
}
