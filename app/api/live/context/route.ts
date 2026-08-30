import { NextResponse } from 'next/server'
import {
	executePublicServerQuery,
	withPublicRouteGraphQLIngress
} from '@/lib/graphql-server'
import {
	GET_LIVE_CONTEXT,
	type LiveContextResponse
} from '@/lib/graphql/operations/live'

export const dynamic = 'force-dynamic'

async function handleGet(request: Request) {
	try {
		const data = await executePublicServerQuery<LiveContextResponse>(
			'gameweek',
			GET_LIVE_CONTEXT,
			undefined,
			{ cache: 'no-store' }
		)
		const response = NextResponse.json(data)
		response.headers.set(
			'Cache-Control',
			'public, s-maxage=5, stale-while-revalidate=5, no-transform'
		)
		// Lifecycle transitions intentionally do not create a live publication
		// revision. Include the anchor/window/core identity in the validator so a
		// 304 cannot hide BETWEEN_GAMEWEEKS, LIVE_ACTIVE, or other state changes.
		const contextTag = [
			data.coreEventContext?.revision ?? 'none',
			data.liveContext?.anchorEventId ?? 'none',
			data.liveContext?.nextEventId ?? 'none',
			data.liveContext?.scoreCoreRevision ?? 'none',
			data.liveContext?.windowState ?? 'none',
			data.liveContext?.dataAvailability ?? 'none'
		].join(':')
		if (data.liveContext || data.coreEventContext?.revision) {
			const etag = `"live-${contextTag}"`
			response.headers.set('ETag', etag)
			if (request.headers.get('if-none-match') === etag) {
				return new Response(null, {
					status: 304,
					headers: {
						ETag: etag,
						'Cache-Control':
							'public, s-maxage=5, stale-while-revalidate=5, no-transform'
					}
				})
			}
		}
		return response
	} catch {
		return NextResponse.json(
			{ error: 'Live context unavailable' },
			{ status: 503, headers: { 'Cache-Control': 'no-store' } }
		)
	}
}

export function GET(request: Request) {
	return withPublicRouteGraphQLIngress(request, () => handleGet(request))
}
