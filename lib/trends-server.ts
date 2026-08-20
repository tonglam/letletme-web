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

export async function loadTrendCohorts(
	access: TrendAccess,
	session?: Session | null
): Promise<TrendCohortsResponse['trendCohorts']> {
	const response = access === 'MINE'
		? await executeServerQueryWithSession<TrendCohortsResponse>(
			session ?? null,
			GET_TREND_COHORTS,
			{ access },
			{ cache: 'no-store' }
		)
		: await executePublicServerQuery<TrendCohortsResponse>(
			'public-other',
			GET_TREND_COHORTS,
			{ access },
			{ next: { revalidate: 60, tags: ['trends-catalog'] } }
		)
	return response.trendCohorts
}

export async function loadTrendDesk(
	cohortId: string,
	eventId: number,
	access: TrendAccess,
	session?: Session | null,
	limit = 12
): Promise<TrendDesk> {
	const variables = { cohortId, eventId, limit, access }
	const response = access === 'MINE'
		? await executeServerQueryWithSession<TrendDeskResponse>(session ?? null, GET_TREND_COHORT_SNAPSHOT, variables, { cache: 'no-store' })
		: await executePublicServerQuery<TrendDeskResponse>('public-other', GET_TREND_COHORT_SNAPSHOT, variables, { next: { revalidate: 60, tags: ['trends-publication'] } })
	return response.trendCohortSnapshot
}
