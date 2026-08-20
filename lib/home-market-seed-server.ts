import 'server-only'

import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_HOME_MARKET_OWNERSHIP,
	GET_HOME_MARKET_PULSE,
	type HomeMarketOwnershipResponse,
	type HomeMarketPulseResponse
} from '@/lib/graphql/operations/home'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'

const cachePolicy = {
	revalidate: RevalidateSeconds.market,
	tags: [CacheTag.market]
}

const loadHomeMarketPulseFromOrigin = unstable_cache(
	async (): Promise<HomeMarketPulseResponse> =>
		coalescePublicSeed('home-market-pulse', async () => {
			console.info('[public graphql cache]', {
				key: 'home-market-pulse',
				workload: 'market',
				cacheResult: 'miss-fill'
			})
			return executePublicServerQuery<HomeMarketPulseResponse>(
				'market',
				GET_HOME_MARKET_PULSE,
				{ days: 7 },
				{ cache: 'no-store', timeoutMs: 5_000 }
			)
		}),
	['graphql', 'home-market-pulse', 'v1'],
	cachePolicy
)

const loadHomeMarketOwnershipFromOrigin = unstable_cache(
	async (): Promise<HomeMarketOwnershipResponse> =>
		coalescePublicSeed('home-market-ownership', async () => {
			console.info('[public graphql cache]', {
				key: 'home-market-ownership',
				workload: 'market',
				cacheResult: 'miss-fill'
			})
			return executePublicServerQuery<HomeMarketOwnershipResponse>(
				'market',
				GET_HOME_MARKET_OWNERSHIP,
				{},
				{ cache: 'no-store', timeoutMs: 5_000 }
			)
		}),
	['graphql', 'home-market-ownership', 'v1'],
	cachePolicy
)

export const loadHomeMarketPulse = cache(loadHomeMarketPulseFromOrigin)
export const loadHomeMarketOwnership = cache(
	loadHomeMarketOwnershipFromOrigin
)
