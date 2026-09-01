import { NextResponse } from 'next/server'
import {
	executePublicServerQuery,
	withPublicRouteGraphQLIngress
} from '@/lib/graphql-server'
import {
	loadLiveMatchdayV3,
	parseLiveMatchesRequestParams,
	type QueryExecutor
} from '@/lib/live-matches'

export const dynamic = 'force-dynamic'

async function handleGet(request: Request) {
	const startedAt = performance.now()
	if (request.headers.get('X-LetLetMe-Contract') !== 'live-matches-v3') {
		return NextResponse.json(
			{ error: 'CLIENT_UPGRADE_REQUIRED' },
			{ status: 426, headers: { 'Cache-Control': 'no-store' } }
		)
	}
	const params = new URL(request.url).searchParams
	const parsed = parseLiveMatchesRequestParams(params)
	if (!parsed.ok) {
		return NextResponse.json(
			{ error: parsed.error },
			{ status: parsed.status, headers: { 'Cache-Control': 'no-store' } }
		)
	}
	const { eventId } = parsed
	try {
		const upstreamStartedAt = performance.now()
		const executor: QueryExecutor = (query, variables, options) =>
			executePublicServerQuery('gameweek', query, variables, options)
		const data = await loadLiveMatchdayV3(executor, eventId)
		const upstreamDurationMs = performance.now() - upstreamStartedAt
		const snapshot = data.liveMatchday.snapshot
		if (snapshot && eventId !== undefined && snapshot.eventId !== eventId) {
			return NextResponse.json(
				{ error: 'LIVE_MATCHDAY_EVENT_MISMATCH' },
				{ status: 409, headers: { 'Cache-Control': 'no-store' } }
			)
		}
		const response = NextResponse.json(data)
		response.headers.set(
			'Cache-Control',
			'private, no-store, max-age=0, must-revalidate, no-transform'
		)
		response.headers.set('CDN-Cache-Control', 'no-store')
		const requestId = request.headers.get('X-Request-Id')
		if (requestId && /^[A-Za-z0-9._:-]{1,128}$/.test(requestId)) {
			response.headers.set('X-Request-Id', requestId)
		}
		response.headers.set(
			'Server-Timing',
			`graphql;dur=${upstreamDurationMs.toFixed(1)}, web;dur=${(performance.now() - startedAt).toFixed(1)}`
		)
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
