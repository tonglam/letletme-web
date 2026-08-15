import {
	fixtureWindowResponseFromResult,
	parseFixtureWindowParams,
	type FixtureWindowLoadResult,
} from '@/lib/fixture-window'
import { NextResponse } from 'next/server'

export const FIXTURE_WINDOW_PUBLIC_CACHE_CONTROL =
	'public, s-maxage=300, stale-while-revalidate=300, no-transform'
export const FIXTURE_WINDOW_UNCACHEABLE_CONTROL = 'no-store'

export function fixtureWindowCacheHeaders(cacheControl: string) {
	return {
		'Cache-Control': cacheControl,
		'CDN-Cache-Control': cacheControl,
		'Vercel-CDN-Cache-Control': cacheControl,
	}
}

type FixtureWindowLoader = (
	fromGw: number,
	count: number,
) => Promise<FixtureWindowLoadResult>

type FixtureWindowLogger = {
	info: (message: string, detail: Record<string, unknown>) => void
	error: (message: string, detail: Record<string, unknown>) => void
}

const defaultLogger: FixtureWindowLogger = {
	info: (message, detail) => console.info(message, detail),
	error: (message, detail) => console.error(message, detail),
}

export function createFixtureWindowRouteHandler(
	load: FixtureWindowLoader,
	logger: FixtureWindowLogger = defaultLogger,
): (request: Request) => Promise<NextResponse> {
	return async request => {
		const parsed = parseFixtureWindowParams(new URL(request.url).searchParams)
		if (!parsed.ok) {
			return NextResponse.json(
				{ error: parsed.error },
				{
					status: 400,
					headers: fixtureWindowCacheHeaders(FIXTURE_WINDOW_UNCACHEABLE_CONTROL),
				},
			)
		}

		const startedAt = performance.now()
		const { fromGw, count } = parsed
		try {
			const result = await load(fromGw, count)
			const durationMs = Number((performance.now() - startedAt).toFixed(2))
			const detail = {
				fromGw,
				toGw: fromGw + count - 1,
				count,
				outcome: result.outcome,
				path: result.path,
				durationMs,
			}

			if (result.outcome === 'failed') {
				logger.error('[fixtures-window]', detail)
				return NextResponse.json(
					{ error: 'Fixture window is temporarily unavailable' },
					{
						status: 502,
						headers: fixtureWindowCacheHeaders(FIXTURE_WINDOW_UNCACHEABLE_CONTROL),
					},
				)
			}

			logger.info('[fixtures-window]', detail)
			return NextResponse.json(fixtureWindowResponseFromResult(result), {
				status: 200,
				headers: fixtureWindowCacheHeaders(
					result.outcome === 'complete'
						? FIXTURE_WINDOW_PUBLIC_CACHE_CONTROL
						: FIXTURE_WINDOW_UNCACHEABLE_CONTROL,
				),
			})
		} catch (error) {
			logger.error('[fixtures-window]', {
				fromGw,
				toGw: fromGw + count - 1,
				count,
				outcome: 'failed',
				path: 'exception',
				durationMs: Number((performance.now() - startedAt).toFixed(2)),
				error: error instanceof Error ? error.name : 'UnknownError',
			})
			return NextResponse.json(
				{ error: 'Fixture window is temporarily unavailable' },
				{
					status: 502,
					headers: fixtureWindowCacheHeaders(FIXTURE_WINDOW_UNCACHEABLE_CONTROL),
				},
			)
		}
	}
}
