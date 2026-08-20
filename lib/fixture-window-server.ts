import 'server-only'

import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import {
	loadFixtureWindowWithExecutor,
	type FixtureWindowLoadResult,
} from '@/lib/fixture-window'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'

class IncompleteFixtureWindowError extends Error {
	constructor(readonly result: FixtureWindowLoadResult) {
		super('Fixture window was incomplete')
		this.name = 'IncompleteFixtureWindowError'
	}
}

const loadCompleteFixtureWindowFromOrigin = async (
	fromGw: number,
	count: number,
): Promise<FixtureWindowLoadResult> => {
	const key = `fixture-window:${fromGw}:${count}`
	return coalescePublicSeed(key, async () => {
		console.info('[public graphql cache]', {
			key,
			workload: 'fixtures',
			cacheResult: 'miss-fill'
		})
		const result = await loadFixtureWindowWithExecutor(
			fromGw,
			count,
			(query, variables) =>
				executePublicServerQuery<unknown>(
					'fixtures',
					query,
					variables,
					{ cache: 'no-store', timeoutMs: 5_000 }
				)
		)
		if (result.outcome !== 'complete') {
			throw new IncompleteFixtureWindowError(result)
		}
		return result
	})
}

const loadCompleteFixtureWindow = unstable_cache(
	loadCompleteFixtureWindowFromOrigin,
	['graphql', 'fixture-window', 'v1'],
	{ revalidate: RevalidateSeconds.publicStats, tags: [CacheTag.fixtures, CacheTag.events] },
)

const loadFixtureWindowCached = cache(loadCompleteFixtureWindow)

export async function loadFixtureWindow(
	fromGw: number,
	count: number,
): Promise<FixtureWindowLoadResult> {
	try {
		return await loadFixtureWindowCached(fromGw, count)
	} catch (error) {
		if (error instanceof IncompleteFixtureWindowError) return error.result
		throw error
	}
}

/** The public API already owns the shared CDN TTL, so it must bypass Data Cache. */
export async function loadFixtureWindowForPublicRoute(
	fromGw: number,
	count: number,
): Promise<FixtureWindowLoadResult> {
	try {
		return await loadCompleteFixtureWindowFromOrigin(fromGw, count)
	} catch (error) {
		if (error instanceof IncompleteFixtureWindowError) return error.result
		throw error
	}
}
