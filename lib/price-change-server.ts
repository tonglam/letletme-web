import 'server-only'

import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_PRICE_CHANGE_BOARD,
	type PriceChangeBoardResponse
} from '@/lib/graphql/operations/price-changes'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'

const dataCache = {
	revalidate: RevalidateSeconds.priceChanges,
	tags: [CacheTag.priceChanges]
}

const loadFromOrigin = unstable_cache(
	async (): Promise<PriceChangeBoardResponse> =>
		coalescePublicSeed('price-change-board', () =>
			executePublicServerQuery<PriceChangeBoardResponse>(
				'market',
				GET_PRICE_CHANGE_BOARD,
				undefined,
				{ cache: 'no-store', timeoutMs: 5_000 }
			)
		),
	['graphql', 'price-change-board', 'v1'],
	dataCache
)

export const loadPriceChangeBoard = cache(loadFromOrigin)
