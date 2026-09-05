import 'server-only'

import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	PLAYER_STATS_DESK_QUERIES,
	type PlayerStatsDeskGraphQLResponse,
	type PlayerStatsDeskSection
} from '@/lib/graphql/operations/players'
import {
	mergePlayerStatsDeskLoadResults,
	normalizePlayerStatsDeskResult,
	PLAYER_STATS_DESK_MAX_PLAYERS,
	type PlayerStatsDeskLoadResult
} from '@/lib/player-stats-desk'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'

class IncompletePlayerStatsDeskError extends Error {
	constructor(readonly result: PlayerStatsDeskLoadResult) {
		super('Player Stats desk was incomplete')
		this.name = 'IncompletePlayerStatsDeskError'
	}
}

const loadCompletePlayerStatsDeskFromOrigin = async (
	playerIds: number[],
	eventId: number,
	horizon: number,
	section: PlayerStatsDeskSection
): Promise<PlayerStatsDeskLoadResult> => {
	const key = [
		'player-stats-desk',
		section,
		eventId,
		horizon,
		playerIds.join(',')
	].join(':')
	return coalescePublicSeed(key, async () => {
		console.info('[public graphql cache]', {
			key,
			workload: 'player-stats',
			cacheResult: 'miss-fill'
		})
		const response =
			await executePublicServerQuery<PlayerStatsDeskGraphQLResponse>(
				'player-stats',
				PLAYER_STATS_DESK_QUERIES[section],
				{ playerIds, eventId, horizon },
				{ cache: 'no-store', timeoutMs: 5_000 }
			)
		const result = normalizePlayerStatsDeskResult(
			response.playerStatsDesk,
			playerIds,
			section
		)
		if (result.outcome !== 'complete') {
			throw new IncompletePlayerStatsDeskError(result)
		}
		return result
	})
}

const loadCompletePlayerStatsDeskByPlayerFromOrigin = (
	playerId: number,
	eventId: number,
	horizon: number,
	section: PlayerStatsDeskSection
) =>
	loadCompletePlayerStatsDeskFromOrigin([playerId], eventId, horizon, section)

const loadCompletePlayerStatsDeskByPlayer = unstable_cache(
	loadCompletePlayerStatsDeskByPlayerFromOrigin,
	['graphql', 'player-stats-desk', 'v3'],
	{ revalidate: RevalidateSeconds.publicStats, tags: [CacheTag.gameweekStats] }
)

const loadPlayerStatsDeskByPlayerCached = cache(
	loadCompletePlayerStatsDeskByPlayer
)

async function resolvePlayerStatsDesk(
	load: () => Promise<PlayerStatsDeskLoadResult>
): Promise<PlayerStatsDeskLoadResult> {
	try {
		return await load()
	} catch (error) {
		if (error instanceof IncompletePlayerStatsDeskError) return error.result
		throw error
	}
}

export async function loadPlayerStatsDesk(
	playerIds: number[],
	eventId: number,
	horizon: number,
	section: PlayerStatsDeskSection
): Promise<PlayerStatsDeskLoadResult> {
	if (
		playerIds.length < 1 ||
		playerIds.length > PLAYER_STATS_DESK_MAX_PLAYERS ||
		new Set(playerIds).size !== playerIds.length
	) {
		throw new Error('Player Stats desk requires one or two unique players')
	}
	const results = await Promise.all(
		playerIds.map(playerId =>
			resolvePlayerStatsDesk(() =>
				loadPlayerStatsDeskByPlayerCached(playerId, eventId, horizon, section)
			)
		)
	)
	return mergePlayerStatsDeskLoadResults(
		playerIds,
		eventId,
		horizon,
		section,
		results
	)
}

// The public API response already has a shared CDN cache. Bypass the durable
// Next Data Cache here so a CDN fill can never re-cache an almost-expired Data
// Cache entry for another full edge-cache lifetime.
export function loadPlayerStatsDeskForPublicRoute(
	playerIds: number[],
	eventId: number,
	horizon: number,
	section: PlayerStatsDeskSection
): Promise<PlayerStatsDeskLoadResult> {
	return resolvePlayerStatsDesk(() =>
		loadCompletePlayerStatsDeskFromOrigin(playerIds, eventId, horizon, section)
	)
}
