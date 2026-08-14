import { NextResponse } from 'next/server'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { GET_LIVE_CONTEXT, type LiveContextResponse } from '@/lib/graphql/operations/live'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
	try {
		const data = await executePublicServerQuery<LiveContextResponse>(GET_LIVE_CONTEXT, undefined, { cache: 'no-store' })
		const response = NextResponse.json(data)
		response.headers.set('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=5, no-transform')
		if (data.liveContext?.revision) {
			const etag = `"${data.liveContext.revision}"`
			response.headers.set('ETag', etag)
			if (request.headers.get('if-none-match') === etag) {
				return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5, no-transform' } })
			}
		}
		return response
	} catch {
		return NextResponse.json({ error: 'Live context unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
	}
}
