import {
	executePublicServerQuery,
	withPublicRouteGraphQLIngress
} from '@/lib/graphql-server'
import { GraphQLRequestError } from '@/lib/graphql-client'
import {
	GET_PRICE_CHANGE_LIVE_BOARD,
	type PriceChangeLiveBoardResponse
} from '@/lib/graphql/operations/price-changes'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function handler(request: Request): Promise<Response> {
	try {
		const params = new URL(request.url).searchParams
		const revision = params.get('revision')
		const sourceHash = params.get('sourceHash')
		const result = await executePublicServerQuery<PriceChangeLiveBoardResponse>(
			'market',
			GET_PRICE_CHANGE_LIVE_BOARD,
			{ revision, sourceHash },
			{ cache: 'no-store', timeoutMs: 3_000 }
		)
		return Response.json(result.priceChangeLiveBoard, {
			headers: {
				'Cache-Control': 'no-store',
				ETag: `"${result.priceChangeLiveBoard.revision}:${result.priceChangeLiveBoard.sourceHash ?? ''}"`
			}
		})
	} catch (error) {
		if (error instanceof GraphQLRequestError && error.code === 'REQUEST_TIMEOUT') {
			return Response.json(
				{ error: 'PRICE_CHANGE_LIVE_TIMEOUT' },
				{ status: 504, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } }
			)
		}
		if (error instanceof GraphQLRequestError && error.code === 'REQUEST_CANCELLED') {
			return Response.json(
				{ error: 'PRICE_CHANGE_LIVE_CANCELLED' },
				{ status: 499, headers: { 'Cache-Control': 'no-store' } }
			)
		}
		console.warn('[price-changes] live board failed:', error)
		const headers = new Headers({ 'Cache-Control': 'no-store' })
		if (error instanceof GraphQLRequestError)
			headers.set('Retry-After', String(Math.max(1, error.retryAfterSeconds ?? 30)))
		return Response.json(
			{ error: 'DEPENDENCY_UNAVAILABLE' },
			{ status: 503, headers }
		)
	}
}

export function GET(request: Request): Promise<Response> {
	return withPublicRouteGraphQLIngress(request, () => handler(request))
}
