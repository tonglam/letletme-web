import 'server-only'

import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK,
	GET_FIXTURE_PLANNING_SIGNALS,
	type FixturePlanningOwnershipResponse,
	type FixturePlanningSignalsResponse
} from '@/lib/graphql/operations/market'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'

const loadFixturePlanningSignalsFromOrigin = unstable_cache(
	async (): Promise<FixturePlanningSignalsResponse> => {
		return coalescePublicSeed('fixture-planning-signals', async () => {
			console.info('[public graphql cache]', {
				key: 'fixture-planning-signals',
				workload: 'market',
				cacheResult: 'miss-fill'
			})
			return executePublicServerQuery<FixturePlanningSignalsResponse>(
				'market',
				GET_FIXTURE_PLANNING_SIGNALS,
				{},
				{ cache: 'no-store', timeoutMs: 5_000 }
			)
		})
	},
	['graphql', 'fixture-planning-signals', 'v1'],
	{ revalidate: RevalidateSeconds.market, tags: [CacheTag.market] }
)

const loadFixturePlanningOwnershipFromOrigin = unstable_cache(
	async (): Promise<FixturePlanningOwnershipResponse> => {
		return coalescePublicSeed(
			'fixture-planning-gameweek-ownership',
			async () => {
				console.info('[public graphql cache]', {
					key: 'fixture-planning-gameweek-ownership',
					workload: 'market',
					cacheResult: 'miss-fill'
				})
				return executePublicServerQuery<FixturePlanningOwnershipResponse>(
					'market',
					GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK,
					{},
					{ cache: 'no-store', timeoutMs: 5_000 }
				)
			}
		)
	},
	['graphql', 'fixture-planning-gameweek-ownership', 'v1'],
	{ revalidate: RevalidateSeconds.market, tags: [CacheTag.market] }
)

export const loadFixturePlanningSignals = cache(
	loadFixturePlanningSignalsFromOrigin
)
export const loadFixturePlanningGameweekOwnership = cache(
	loadFixturePlanningOwnershipFromOrigin
)
