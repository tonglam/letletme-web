import { NextResponse } from 'next/server'
import {
	executePublicServerQuery,
	withPublicRouteGraphQLIngress
} from '@/lib/graphql-server'
import { loadLiveMatchdayDesk, type QueryExecutor } from '@/lib/live-matches'

export const dynamic = 'force-dynamic'

async function handleGet(request: Request) {
	const params = new URL(request.url).searchParams
	const season = params.get('season')
	const eventId = Number(params.get('eventId'))
	const scoreCoreRevision = params.get('scoreCoreRevision')
	const includeFixturePlayers = params.get('includePlayers') !== '0'
	if (
		!/^\d{4}$/.test(season ?? '') ||
		!Number.isSafeInteger(eventId) ||
		eventId <= 0 ||
		!scoreCoreRevision
	)
		return NextResponse.json(
			{ error: 'Invalid live score revision' },
			{ status: 400 }
		)
	try {
		const executor: QueryExecutor = (query, variables, options) =>
			executePublicServerQuery('gameweek', query, variables, options)
		const data = await loadLiveMatchdayDesk(
			executor,
			{
				season: season!,
				eventId,
				scoreCoreRevision
			},
			{
				includeFixturePlayers,
				onFixturePlayerFailure: failure => {
					console.warn('[live-matches] fixture player section unavailable', {
						season: failure.season,
						eventId: failure.eventId,
						scoreCoreRevision: failure.scoreCoreRevision,
						stage: failure.stage,
						fixtureIds: failure.fixtureIds,
						code: failure.code
					})
				}
			}
		)
		const response = NextResponse.json(data)
		response.headers.set(
			'Cache-Control',
			'private, no-store, max-age=0, must-revalidate, no-transform'
		)
		response.headers.set('CDN-Cache-Control', 'no-store')
		return response
	} catch (error) {
		return NextResponse.json(
			{ error: 'Live matches unavailable' },
			{ status: 503, headers: { 'Cache-Control': 'no-store' } }
		)
	}
}

export function GET(request: Request) {
	return withPublicRouteGraphQLIngress(request, () => handleGet(request))
}
