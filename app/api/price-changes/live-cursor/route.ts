import {
	executePublicServerQuery,
	withPublicRouteGraphQLIngress
} from '@/lib/graphql-server'
import {
	GET_PRICE_CHANGE_LIVE_CURSOR,
	type PriceChangeLiveCursorResponse
} from '@/lib/graphql/operations/price-changes'

export const dynamic = 'force-dynamic'

async function handler(): Promise<Response> {
	try {
		const result =
			await executePublicServerQuery<PriceChangeLiveCursorResponse>(
				'market',
				GET_PRICE_CHANGE_LIVE_CURSOR,
				undefined,
				{ cache: 'no-store', timeoutMs: 2_000 }
			)
		return Response.json(result.priceChangeLiveCursor, {
			headers: {
				'Cache-Control':
					'public, max-age=0, s-maxage=1, stale-while-revalidate=1',
				Vary: 'Accept-Encoding'
			}
		})
	} catch (error) {
		console.warn('[price-changes] live cursor failed:', error)
		return Response.json(
			{ error: 'PRICE_CHANGE_LIVE_UNAVAILABLE' },
			{ status: 503, headers: { 'Cache-Control': 'no-store' } }
		)
	}
}

export function GET(request: Request): Promise<Response> {
	return withPublicRouteGraphQLIngress(request, handler)
}
