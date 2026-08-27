import 'server-only'

import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_HOME_MARKET_DESK,
	GET_HOME_MARKET_OWNERSHIP,
	GET_HOME_MARKET_PULSE,
	type HomeMarketDeskResponse,
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

const loadHomeMarketDeskFromOrigin = unstable_cache(
	async (): Promise<HomeMarketDeskResponse> =>
		coalescePublicSeed('home-market-desk', async () => {
			const startedAt = performance.now()
			const response = await executePublicServerQuery<HomeMarketDeskResponse>(
				'market',
				GET_HOME_MARKET_DESK,
				undefined,
				{
					cache: 'no-store',
					// This aggregate powers an optional Suspense section. Keep the
					// standard public-read deadline so a cold GraphQL/DB read is not
					// incorrectly treated as unavailable after only two seconds.
					timeoutMs: 5_000,
					suppressErrorLog: true
				}
			)
			console.info('[home-market-desk]', {
				revision: response.homeMarketDesk.revision,
				ownershipState: response.homeMarketDesk.ownershipState,
				priceChangesState: response.homeMarketDesk.priceChangesState,
				availabilityState: response.homeMarketDesk.availabilityState,
				durationMs: Number((performance.now() - startedAt).toFixed(2))
			})
			return response
		}),
	['graphql', 'home-market-desk', 'v2'],
	cachePolicy
)

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
				{ cache: 'no-store', timeoutMs: 8_000 }
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
				{ cache: 'no-store', timeoutMs: 8_000 }
			)
		}),
	['graphql', 'home-market-ownership', 'v1'],
	cachePolicy
)

export const loadHomeMarketPulse = cache(loadHomeMarketPulseFromOrigin)
export const loadHomeMarketOwnership = cache(loadHomeMarketOwnershipFromOrigin)
export const loadHomeMarketDesk = cache(loadHomeMarketDeskFromOrigin)
