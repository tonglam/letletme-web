import 'server-only'

import { CacheTag, publicFetchOptions, RevalidateSeconds } from '@/lib/cache-policy'
import { CORE_AUTHORITY_FETCH_OPTIONS } from '@/lib/core-authority-cache-policy'
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
	type HomeGameweekResponse,
	type HomePublicBootstrap,
	type HomePublicBootstrapGraphQLResponse,
	GET_HOME_PERSONAL_DESK,
	type HomePersonalDeskResponse,
} from '@/lib/graphql/operations/home'
import { cache } from 'react'

function withEventId(
	fixtures: Array<Omit<HomeFixture, 'eventId'>>,
	eventId: number,
): HomeFixture[] {
	return fixtures.map(fixture => ({ ...fixture, eventId }))
}

export const getHomePublicBootstrap = cache(
	async (): Promise<HomePublicBootstrap> => {
		const startedAt = performance.now()
		const response =
			await executePublicServerQuery<HomePublicBootstrapGraphQLResponse>(
				GET_HOME_PUBLIC_BOOTSTRAP,
				undefined,
				CORE_AUTHORITY_FETCH_OPTIONS,
			)
		const { context, fixtures } = response.homePublicBootstrap
		const result = {
			context,
			fixtures:
				context.nextEventId === null
					? []
					: withEventId(fixtures, context.nextEventId),
		}
		console.info('[home-public-bootstrap]', {
			revision: context.revision,
			fixtureCount: result.fixtures.length,
			durationMs: Number((performance.now() - startedAt).toFixed(2)),
		})
		return result
	},
)

export async function getHomeGameweek(
	eventId: number,
): Promise<HomeGameweekResponse> {
	const startedAt = performance.now()
	const response = await executePublicServerQuery<HomeGameweekResponse>(
		GET_HOME_GAMEWEEK,
		{ eventId },
		publicFetchOptions({
			revalidate: RevalidateSeconds.publicStats,
			tags: [CacheTag.gameweekStats, CacheTag.liveScores, CacheTag.transfers],
		}),
	)
	console.info('[home-gameweek]', {
		lifecycle: response.gameweekDesk.lifecycle,
		dreamTeamRows: response.gameweekDesk.dreamTeam.length,
		transferRows:
			response.topTransfersIn.length + response.topTransfersOut.length,
		durationMs: Number((performance.now() - startedAt).toFixed(2)),
	})
	return response
}

export async function loadHomeFixtures(
	eventId: number,
): Promise<HomeFixturesResponse> {
	const response =
		await executePublicServerQuery<HomeEventFixturesGraphQLResponse>(
			GET_HOME_EVENT_FIXTURES,
			{ eventId },
			CORE_AUTHORITY_FETCH_OPTIONS,
		)
	return {
		season: response.coreEventContext.season,
		revision: response.coreEventContext.revision,
		eventId,
		fixtures: withEventId(response.eventFixtures, eventId),
	}
}

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
