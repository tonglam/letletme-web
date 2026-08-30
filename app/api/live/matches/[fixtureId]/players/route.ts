import { NextResponse } from 'next/server'
import {
	executePublicServerQuery,
	withPublicRouteGraphQLIngress
} from '@/lib/graphql-server'
import { GET_LIVE_FIXTURE_PLAYERS } from '@/lib/graphql/operations/live'

export const dynamic = 'force-dynamic'

async function handleGet(
	request: Request,
	context: { params: Promise<{ fixtureId: string }> }
) {
	const params = new URL(request.url).searchParams
	const season = params.get('season')
	const eventId = Number(params.get('eventId'))
	const scoreCoreRevision = params.get('scoreCoreRevision')
	const fixtureId = Number((await context.params).fixtureId)
	if (!/^\d{4}$/.test(season ?? '') || !Number.isSafeInteger(eventId) || eventId <= 0 || !scoreCoreRevision || !Number.isSafeInteger(fixtureId) || fixtureId <= 0) return NextResponse.json({ error: 'Invalid live score revision' }, { status: 400 })
	try {
		const data = await executePublicServerQuery('gameweek', GET_LIVE_FIXTURE_PLAYERS, { ref: { season, eventId, scoreCoreRevision }, fixtureId }, { cache: 'no-store' })
		return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400, no-transform' } })
	} catch (error) {
		const status = String(error).includes('LIVE_SCORE_REVISION_GONE') ? 409 : 503
		return NextResponse.json({ error: status === 409 ? 'LIVE_SCORE_REVISION_GONE' : 'Fixture players unavailable' }, { status, headers: { 'Cache-Control': 'no-store' } })
	}
}

export function GET(
	request: Request,
	context: { params: Promise<{ fixtureId: string }> }
) {
	return withPublicRouteGraphQLIngress(request, () => handleGet(request, context))
}
