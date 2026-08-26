import {
	executePublicServerQuery,
	withPublicRouteGraphQLIngress
} from '@/lib/graphql-server'
import {
	GET_PRICE_CHANGE_LIVE_BOARD,
	type PriceChangeLiveBoardResponse
} from '@/lib/graphql/operations/price-changes'

export const dynamic = 'force-dynamic'

async function handler(request: Request): Promise<Response> {
	try {
		const revision = new URL(request.url).searchParams.get('revision')
		const result = await executePublicServerQuery<PriceChangeLiveBoardResponse>(
			'market',
			GET_PRICE_CHANGE_LIVE_BOARD,
			{ revision },
			{ cache: 'no-store', timeoutMs: 3_000 }
		)
		return Response.json(result.priceChangeLiveBoard, {
			headers: {
				'Cache-Control': 'no-store',
				ETag: `"${result.priceChangeLiveBoard.revision}"`
			}
		})
	} catch (error) {
		console.warn('[price-changes] live board failed:', error)
		return Response.json(
			{ error: 'PRICE_CHANGE_LIVE_UNAVAILABLE' },
			{ status: 503, headers: { 'Cache-Control': 'no-store' } }
		)
	}
}

export function GET(request: Request): Promise<Response> {
	return withPublicRouteGraphQLIngress(request, () => handler(request))
}
