import 'server-only'

import { CacheTag, publicFetchOptions, RevalidateSeconds } from '@/lib/cache-policy'
import {
	loadFixtureWindowWithExecutor,
	type FixtureWindowLoadResult,
} from '@/lib/fixture-window'
import { executePublicServerQuery } from '@/lib/graphql-server'

export async function loadFixtureWindow(
	fromGw: number,
	count: number,
): Promise<FixtureWindowLoadResult> {
	return loadFixtureWindowWithExecutor(fromGw, count, (query, variables) =>
		executePublicServerQuery<unknown>(
			query,
			variables,
			publicFetchOptions({
				revalidate: RevalidateSeconds.publicStats,
				tags: [CacheTag.fixtures, CacheTag.events],
			}),
		),
	)
}
