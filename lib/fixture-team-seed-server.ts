import 'server-only'

import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_TEAMS_FOR_PICKER,
	type TeamsForPickerResponse
} from '@/lib/graphql/operations/players'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'

const loadFixtureTeamsFromOrigin = unstable_cache(
	async (): Promise<TeamsForPickerResponse> =>
		coalescePublicSeed('fixture-team-directory', async () => {
			console.info('[public graphql cache]', {
				key: 'fixture-team-directory',
				workload: 'fixtures',
				cacheResult: 'miss-fill'
			})
			return executePublicServerQuery<TeamsForPickerResponse>(
				'fixtures',
				GET_TEAMS_FOR_PICKER,
				{},
				{ cache: 'no-store', timeoutMs: 5_000 }
			)
		}),
	['graphql', 'fixture-team-directory', 'v1'],
	{ revalidate: RevalidateSeconds.publicStats, tags: [CacheTag.fixtures] }
)

export const loadFixtureTeams = cache(loadFixtureTeamsFromOrigin)
