import 'server-only'

import {
	CORE_AUTHORITY_DATA_CACHE,
	CORE_AUTHORITY_ORIGIN_OPTIONS
} from '@/lib/core-authority-cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	gameweekDeskResponseFromResult,
	loadGameweekDeskWithExecutor,
	type GameweekDeskData,
	type GameweekDeskGraphQLResponse,
	type GameweekDeskLoadResult
} from '@/lib/gameweek-desk'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'

class IncompleteGameweekDeskError extends Error {
	constructor(readonly result: GameweekDeskLoadResult) {
		super('Gameweek desk was incomplete')
		this.name = 'IncompleteGameweekDeskError'
	}
}

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
			if (result.outcome !== 'complete') {
				throw new IncompleteGameweekDeskError(result)
			}
			return gameweekDeskResponseFromResult(result)
		})
	},
	['graphql', 'gameweek-desk', 'v2'],
	CORE_AUTHORITY_DATA_CACHE
)

const loadGameweekDeskCached = cache(loadGameweekDeskFromOrigin)

export async function loadGameweekDesk(eventId?: number): Promise<GameweekDeskData> {
	try {
		return await loadGameweekDeskCached(eventId)
	} catch (error) {
		if (error instanceof IncompleteGameweekDeskError) {
			return gameweekDeskResponseFromResult(error.result)
		}
		throw error
	}
}
