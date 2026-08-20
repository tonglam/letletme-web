import 'server-only'

import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_MARKET_OWNERSHIP_DAY,
	GET_MARKET_OWNERSHIP_OVERVIEW,
	GET_MARKET_PULSE_SUMMARY,
	type MarketOwnershipDayResponse,
	type MarketOwnershipOverviewResponse,
	type MarketOwnershipPeriod,
	type MarketPulseSummaryResponse
} from '@/lib/graphql/operations/market'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'

const dataCache = {
	revalidate: RevalidateSeconds.market,
	tags: [CacheTag.market]
}
const originOptions = { cache: 'no-store' as const, timeoutMs: 2_000 }

const loadMarketPulseFromOrigin = unstable_cache(
	async (days: number): Promise<MarketPulseSummaryResponse> => {
		const key = `market-pulse:${days}`
		return coalescePublicSeed(key, async () => {
			console.info('[public graphql cache]', {
				key,
				workload: 'market',
				cacheResult: 'miss-fill'
			})
			return executePublicServerQuery<MarketPulseSummaryResponse>(
				'market',
				GET_MARKET_PULSE_SUMMARY,
				{ days },
				originOptions
			)
		})
	},
	['graphql', 'market-pulse', 'v1'],
	dataCache
)

const loadMarketOwnershipOverviewFromOrigin = unstable_cache(
	async (
		period: MarketOwnershipPeriod
	): Promise<MarketOwnershipOverviewResponse> => {
		const key = `market-ownership:${period}`
		return coalescePublicSeed(key, async () => {
			console.info('[public graphql cache]', {
				key,
				workload: 'market',
				cacheResult: 'miss-fill'
			})
			return executePublicServerQuery<MarketOwnershipOverviewResponse>(
				'market',
				GET_MARKET_OWNERSHIP_OVERVIEW,
				{ period, limit: 10 },
				originOptions
			)
		})
	},
	['graphql', 'market-ownership-overview', 'v1'],
	dataCache
)

const loadMarketOwnershipDayFromOrigin = unstable_cache(
	async (date: string): Promise<MarketOwnershipDayResponse> => {
		const key = `market-ownership-day:${date}`
		return coalescePublicSeed(key, async () => {
			console.info('[public graphql cache]', {
				key,
				workload: 'market',
				cacheResult: 'miss-fill'
			})
			return executePublicServerQuery<MarketOwnershipDayResponse>(
				'market',
				GET_MARKET_OWNERSHIP_DAY,
				{ date, limit: 10 },
				originOptions
			)
		})
	},
	['graphql', 'market-ownership-day', 'v1'],
	dataCache
)

export const loadMarketPulseSummary = cache(loadMarketPulseFromOrigin)
export const loadMarketOwnershipOverview = cache(
	loadMarketOwnershipOverviewFromOrigin
)
export const loadMarketOwnershipDay = cache(loadMarketOwnershipDayFromOrigin)
