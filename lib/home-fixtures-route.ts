import type { HomeFixturesResponse } from '@/lib/graphql/operations/home'

export const HOME_FIXTURES_PUBLIC_CACHE_CONTROL =
	'public, s-maxage=300, stale-while-revalidate=300, no-transform'
export const HOME_FIXTURES_LIVE_CACHE_CONTROL =
	'public, s-maxage=10, stale-while-revalidate=20, no-transform'
export const HOME_FIXTURES_NO_STORE = 'no-store'

export type HomeFixtureParamResult =
	{ ok: true; eventId: number } | { ok: false; error: string }

const POSITIVE_INTEGER = /^[1-9]\d*$/

export function parseHomeFixtureEventId(
	searchParams: URLSearchParams
): HomeFixtureParamResult {
	const values = searchParams.getAll('eventId')
	if (values.length !== 1 || !POSITIVE_INTEGER.test(values[0] ?? '')) {
		return { ok: false, error: 'eventId must be provided once as an integer' }
	}
	const eventId = Number(values[0])
	if (eventId < 1 || eventId > 38) {
		return { ok: false, error: 'eventId must be between 1 and 38' }
	}
	return { ok: true, eventId }
}

export function homeFixturesEtag(response: HomeFixturesResponse): string {
	const token =
		`${response.season}-${response.source}-${response.state}-${response.revision}-${response.eventId}`.replace(
			/[^A-Za-z0-9._-]/g,
			'-'
		)
	return `"home-fixtures-${token}"`
}

export function homeFixturesCacheControl(
	response: HomeFixturesResponse
): string {
	if (response.source === 'LIVE' && response.state !== 'UNAVAILABLE') {
		return HOME_FIXTURES_LIVE_CACHE_CONTROL
	}
	if (response.source === 'CORE') return HOME_FIXTURES_PUBLIC_CACHE_CONTROL
	return HOME_FIXTURES_NO_STORE
}

function homeFixturesCacheHeaders(
	response: HomeFixturesResponse
): Record<string, string> {
	const cacheControl = homeFixturesCacheControl(response)
	const headers: Record<string, string> = { 'Cache-Control': cacheControl }
	if (response.state !== 'UNAVAILABLE') {
		// Keep the CDN-specific directives alongside Cache-Control. Vercel may
		// normalize Cache-Control on dynamic functions, while the EdgeOne path
		// reads the standard header.
		headers['CDN-Cache-Control'] = cacheControl
		headers['Vercel-CDN-Cache-Control'] = cacheControl
	}
	return headers
}

type HomeFixturesLoader = (eventId: number) => Promise<HomeFixturesResponse>
type HomeFixturesLogger = {
	info: (message: string, detail: Record<string, unknown>) => void
	error: (message: string, detail: Record<string, unknown>) => void
}

const defaultLogger: HomeFixturesLogger = {
	info: (message, detail) => console.info(message, detail),
	error: (message, detail) => console.error(message, detail)
}

export function createHomeFixturesRouteHandler(
	load: HomeFixturesLoader,
	logger: HomeFixturesLogger = defaultLogger
): (request: Request) => Promise<Response> {
	return async request => {
		const parsed = parseHomeFixtureEventId(new URL(request.url).searchParams)
		if (!parsed.ok) {
			return Response.json(
				{ error: parsed.error },
				{
					status: 400,
					headers: { 'Cache-Control': HOME_FIXTURES_NO_STORE }
				}
			)
		}

		const startedAt = performance.now()
		try {
			const response = await load(parsed.eventId)
			const etag = homeFixturesEtag(response)
			const detail = {
				eventId: parsed.eventId,
				revision: response.revision,
				fixtureCount: response.fixtures.length,
				durationMs: Number((performance.now() - startedAt).toFixed(2))
			}
			logger.info('[home-fixtures]', detail)
			const headers = {
				...homeFixturesCacheHeaders(response),
				ETag: etag
			}
			if (request.headers.get('if-none-match') === etag) {
				return new Response(null, { status: 304, headers })
			}
			return Response.json(response, { status: 200, headers })
		} catch (error) {
			logger.error('[home-fixtures]', {
				eventId: parsed.eventId,
				outcome: 'failed',
				durationMs: Number((performance.now() - startedAt).toFixed(2)),
				error: error instanceof Error ? error.name : 'UnknownError'
			})
			return Response.json(
				{ error: 'Fixtures are temporarily unavailable' },
				{
					status: 502,
					headers: { 'Cache-Control': HOME_FIXTURES_NO_STORE }
				}
			)
		}
	}
}
