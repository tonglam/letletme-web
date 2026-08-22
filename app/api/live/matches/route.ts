import { NextResponse } from 'next/server'
import {
	executePublicServerQuery,
	withPublicRouteGraphQLIngress
} from '@/lib/graphql-server'
import { GET_LIVE_MATCHDAY_DESK, type LiveMatchdayDeskResponse } from '@/lib/graphql/operations/live'

export const dynamic = 'force-dynamic'

async function handleGet(request: Request) {
	const params = new URL(request.url).searchParams
	const season = params.get('season')
	const eventId = Number(params.get('eventId'))
	const revision = params.get('revision')
	if (!/^\d{4}$/.test(season ?? '') || !Number.isSafeInteger(eventId) || eventId <= 0 || !revision) return NextResponse.json({ error: 'Invalid live revision' }, { status: 400 })
	try {
		const data = await executePublicServerQuery<LiveMatchdayDeskResponse>('gameweek', GET_LIVE_MATCHDAY_DESK, { ref: { season, eventId, revision } }, { cache: 'no-store' })
		const response = NextResponse.json(data)
		response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate, no-transform')
		response.headers.set('CDN-Cache-Control', 'no-store')
		return response
	} catch (error) {
		const message = error instanceof Error ? error.message : ''
		const status = message.includes('LIVE_REVISION_GONE') ? 409 : 503
		return NextResponse.json({ error: status === 409 ? 'LIVE_REVISION_GONE' : 'Live matches unavailable' }, { status, headers: { 'Cache-Control': 'no-store' } })
	}
}

export function GET(request: Request) {
	return withPublicRouteGraphQLIngress(request, () => handleGet(request))
}
