import 'server-only'

import {
	GET_TREND_COHORT_SNAPSHOT,
	GET_TREND_COHORTS,
	type TrendAccess,
	type TrendCohortsResponse,
	type TrendDesk,
	type TrendDeskResponse
} from '@/lib/graphql/operations/trends'
import {
	executePublicServerQuery,
	executeServerQueryWithSession
} from '@/lib/graphql-server'
import type { Session } from '@/lib/auth'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'

const loadPublicCatalog = cache(unstable_cache(
	() => coalescePublicSeed('trends:PUBLIC:catalog:v1', () =>
		executePublicServerQuery<TrendCohortsResponse>(
			'interactive', GET_TREND_COHORTS, { access: 'PUBLIC' },
			{ cache: 'no-store', timeoutMs: 5_000 }
		)
	),
	['graphql', 'trends', 'PUBLIC', 'catalog', 'v1'],
	{ revalidate: 60, tags: ['trends-catalog'] }
))

const loadPublicDesk = cache(unstable_cache(
	(cohortId: string, eventId: number, limit: number) =>
		coalescePublicSeed(`trends:PUBLIC:desk:v1:${JSON.stringify([cohortId, eventId, limit])}`, () =>
			executePublicServerQuery<TrendDeskResponse>(
				'interactive', GET_TREND_COHORT_SNAPSHOT,
				{ cohortId, eventId, limit, access: 'PUBLIC' },
				{ cache: 'no-store', timeoutMs: 5_000 }
			)
		),
	['graphql', 'trends', 'PUBLIC', 'desk', 'v1'],
	{ revalidate: 60, tags: ['trends-publication'] }
))

export async function loadTrendCohorts(
	access: TrendAccess,
	session?: Session | null
): Promise<TrendCohortsResponse['trendCohorts']> {
	const response = access === 'MINE'
		? await executeServerQueryWithSession<TrendCohortsResponse>(
			session ?? null, GET_TREND_COHORTS, { access }, { cache: 'no-store' }
		)
		: await loadPublicCatalog()
	return response.trendCohorts
}

export async function loadTrendDesk(
	cohortId: string,
	eventId: number,
	access: TrendAccess,
	session?: Session | null,
	limit = 12
): Promise<TrendDesk> {
	const response = access === 'MINE'
		? await executeServerQueryWithSession<TrendDeskResponse>(
			session ?? null, GET_TREND_COHORT_SNAPSHOT,
			{ cohortId, eventId, limit, access }, { cache: 'no-store' }
		)
		: await loadPublicDesk(cohortId, eventId, limit)
	return response.trendCohortSnapshot
}
