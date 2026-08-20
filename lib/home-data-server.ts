import 'server-only'

import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import type { Session } from '@/lib/auth'
import { getVerifiedEntryContext } from '@/lib/session'
import {
	GET_HOME_EVENT_FIXTURES,
	GET_HOME_GAMEWEEK,
	GET_HOME_PUBLIC_BOOTSTRAP,
	type HomeEventFixturesGraphQLResponse,
	type HomeFixture,
	type HomeFixturesResponse,
	type HomeGameweek,
	type HomeGameweekResponse,
	type HomePublicBootstrap,
	type HomePublicBootstrapGraphQLResponse,
	GET_HOME_PERSONAL_DESK,
	type HomePersonalDeskResponse,
} from '@/lib/graphql/operations/home'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'

function withEventId(
	fixtures: Array<Omit<HomeFixture, 'eventId'>>,
	eventId: number,
): HomeFixture[] {
	return fixtures.map(fixture => ({ ...fixture, eventId }))
}

const getHomePublicBootstrapFromOrigin = unstable_cache(
	async (): Promise<HomePublicBootstrap> => {
		return coalescePublicSeed('home-public-bootstrap', async () => {
			const startedAt = performance.now()
			const response =
				await executePublicServerQuery<HomePublicBootstrapGraphQLResponse>(
					'home',
					GET_HOME_PUBLIC_BOOTSTRAP,
					undefined,
					{ cache: 'no-store', timeoutMs: 5_000 }
				)
			const { context, fixtures } = response.homePublicBootstrap
			const result = {
				context,
				fixtures:
					context.nextEventId === null
						? []
						: withEventId(fixtures, context.nextEventId)
			}
			console.info('[home-public-bootstrap]', {
				revision: context.revision,
				fixtureCount: result.fixtures.length,
				durationMs: Number((performance.now() - startedAt).toFixed(2)),
				cacheResult: 'miss-fill'
			})
			return result
		})
	},
	['graphql', 'home-public-bootstrap', 'v1'],
	{ revalidate: RevalidateSeconds.events, tags: [CacheTag.events] }
)

export const getHomePublicBootstrap = cache(getHomePublicBootstrapFromOrigin)

const getHomeGameweekFromOrigin = unstable_cache(
	async (eventId: number): Promise<HomeGameweek> =>
		coalescePublicSeed(`home-gameweek:${eventId}`, async () => {
			const startedAt = performance.now()
			const response = await executePublicServerQuery<HomeGameweekResponse>(
				'gameweek',
				GET_HOME_GAMEWEEK,
				{ eventId },
				{ cache: 'no-store', timeoutMs: 5_000 }
			)
			const gameweek = response.homeGameweek
			console.info('[home-gameweek]', {
				lifecycle: gameweek.gameweekDesk.lifecycle,
				dreamTeamRows: gameweek.gameweekDesk.dreamTeam.length,
				transfersState: gameweek.transfersState,
				transferRows:
					gameweek.topTransfersIn.length + gameweek.topTransfersOut.length,
				durationMs: Number((performance.now() - startedAt).toFixed(2)),
				cacheResult: 'miss-fill'
			})
			return gameweek
		}),
	['graphql', 'home-gameweek', 'v1'],
	{
		revalidate: RevalidateSeconds.publicStats,
		tags: [CacheTag.gameweekStats, CacheTag.liveScores, CacheTag.transfers]
	}
)

export const getHomeGameweek = cache(getHomeGameweekFromOrigin)

const loadHomeFixturesFromOrigin = unstable_cache(
	async (eventId: number): Promise<HomeFixturesResponse> =>
		coalescePublicSeed(`home-fixtures:${eventId}`, async () => {
			const response =
				await executePublicServerQuery<HomeEventFixturesGraphQLResponse>(
					'fixtures',
					GET_HOME_EVENT_FIXTURES,
					{ eventId },
					{ cache: 'no-store', timeoutMs: 5_000 }
				)
			return {
				season: response.coreEventContext.season,
				revision: response.coreEventContext.revision,
				eventId,
				fixtures: withEventId(response.eventFixtures, eventId)
			}
		}),
	['graphql', 'home-fixtures', 'v1'],
	{ revalidate: RevalidateSeconds.publicStats, tags: [CacheTag.fixtures] }
)

export const loadHomeFixtures = cache(loadHomeFixturesFromOrigin)

export async function getHomeVerifiedEntryContext() {
	const startedAt = performance.now()
	const context = await getVerifiedEntryContext()
	console.info('[home-session]', {
		hint: true,
		authorized: Boolean(context.session?.user),
		bound: context.entryId !== null,
		freshLookupMs: Number((performance.now() - startedAt).toFixed(2))
	})
	return context
}

export async function loadHomePersonalDesk(session: Session | null) {
	const startedAt = performance.now()
	try {
		const response =
			await executeServerQueryWithSession<HomePersonalDeskResponse>(
				session,
				GET_HOME_PERSONAL_DESK,
				undefined,
				{ cache: 'no-store', timeoutMs: 1_500 }
			)
		console.info('[home-personal-desk]', {
			state: response.homePersonalDesk.state,
			leagueRowCount: response.homePersonalDesk.leagueRanks.length,
			durationMs: Number((performance.now() - startedAt).toFixed(2))
		})
		return response
	} catch (error) {
		console.error('[home-personal-desk] compact desk fetch failed', {
			error: error instanceof Error ? error.name : 'UnknownError',
			durationMs: Number((performance.now() - startedAt).toFixed(2))
		})
		return null
	}
}
