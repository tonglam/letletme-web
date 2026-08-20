import 'server-only'

import {
	CORE_AUTHORITY_DATA_CACHE,
	CORE_AUTHORITY_ORIGIN_OPTIONS
} from '@/lib/core-authority-cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	loadGameweekDeskWithExecutor,
	type GameweekDeskData,
	type GameweekDeskGraphQLResponse
} from '@/lib/gameweek-desk'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'

const loadGameweekDeskFromOrigin = unstable_cache(
	async (eventId?: number): Promise<GameweekDeskData> => {
		const key = `gameweek-desk:${eventId ?? 'current'}`
		return coalescePublicSeed(key, async () => {
			console.info('[public graphql cache]', {
				key,
				workload: 'gameweek',
				cacheResult: 'miss-fill'
			})
			const result = await loadGameweekDeskWithExecutor(
				eventId,
				(query, variables) =>
					executePublicServerQuery<GameweekDeskGraphQLResponse>(
						'gameweek',
						query,
						variables,
						CORE_AUTHORITY_ORIGIN_OPTIONS
					)
			)
			if (result.outcome === 'failed') {
				throw new Error('Gameweek desk is temporarily unavailable')
			}
			const { outcome: _outcome, ...data } = result
			return data
		})
	},
	['graphql', 'gameweek-desk', 'v2'],
	CORE_AUTHORITY_DATA_CACHE
)

const loadGameweekDeskCached = cache(loadGameweekDeskFromOrigin)

export async function loadGameweekDesk(eventId?: number): Promise<GameweekDeskData> {
	return loadGameweekDeskCached(eventId)
}
