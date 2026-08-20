import 'server-only'

import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	PLAYER_STATS_DESK_QUERIES,
	type PlayerStatsDeskGraphQLResponse,
	type PlayerStatsDeskSection
} from '@/lib/graphql/operations/players'
import {
	normalizePlayerStatsDeskResult,
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

const loadCompletePlayerStatsDesk = unstable_cache(
	async (
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
	},
	['graphql', 'player-stats-desk', 'v1'],
	{ revalidate: RevalidateSeconds.publicStats, tags: [CacheTag.gameweekStats] }
)

const loadPlayerStatsDeskCached = cache(loadCompletePlayerStatsDesk)

export async function loadPlayerStatsDesk(
	playerIds: number[],
	eventId: number,
	horizon: number,
	section: PlayerStatsDeskSection
): Promise<PlayerStatsDeskLoadResult> {
	try {
		return await loadPlayerStatsDeskCached(
			playerIds,
			eventId,
			horizon,
			section
		)
	} catch (error) {
		if (error instanceof IncompletePlayerStatsDeskError) return error.result
		throw error
	}
}
