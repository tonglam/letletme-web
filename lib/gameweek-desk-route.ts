import {
	gameweekDeskCacheHeaders,
	gameweekDeskResponseFromResult,
	GAMEWEEK_DESK_UNCACHEABLE_CONTROL,
	parseGameweekDeskParams,
	type GameweekDeskLoadResult
} from '@/lib/gameweek-desk'
import { NextResponse } from 'next/server'

export { GAMEWEEK_DESK_UNCACHEABLE_CONTROL }

type GameweekDeskLoader = (eventId: number) => Promise<GameweekDeskLoadResult>

type GameweekDeskLogger = {
	info: (message: string, detail: Record<string, unknown>) => void
	error: (message: string, detail: Record<string, unknown>) => void
}

const defaultLogger: GameweekDeskLogger = {
	info: (message, detail) => console.info(message, detail),
	error: (message, detail) => console.error(message, detail)
}

export function createGameweekDeskRouteHandler(
	load: GameweekDeskLoader,
	logger: GameweekDeskLogger = defaultLogger
): (request: Request) => Promise<NextResponse> {
	return async request => {
		const parsed = parseGameweekDeskParams(new URL(request.url).searchParams)
		if (!parsed.ok) {
			return NextResponse.json(
				{ error: parsed.error },
				{
					status: 400,
					headers: { 'Cache-Control': GAMEWEEK_DESK_UNCACHEABLE_CONTROL }
				}
			)
		}
		const startedAt = performance.now()
		try {
			const result = await load(parsed.eventId)
			const detail = {
				eventId: parsed.eventId,
				outcome: result.outcome,
				lifecycle: result.lifecycle,
				overviewState: result.overviewState,
				boardsState: result.boardsState,
				durationMs: Number((performance.now() - startedAt).toFixed(2))
			}
			if (result.outcome === 'failed') {
				logger.error('[gameweek-desk]', detail)
				return NextResponse.json(
					{ error: 'Gameweek desk is temporarily unavailable' },
					{
						status: 502,
						headers: { 'Cache-Control': GAMEWEEK_DESK_UNCACHEABLE_CONTROL }
					}
				)
			}
			logger.info('[gameweek-desk]', detail)
			return NextResponse.json(gameweekDeskResponseFromResult(result), {
				status: 200,
				headers: {
					...(result.outcome === 'complete'
						? gameweekDeskCacheHeaders(result)
						: { 'Cache-Control': GAMEWEEK_DESK_UNCACHEABLE_CONTROL })
				}
			})
		} catch (error) {
			logger.error('[gameweek-desk]', {
				eventId: parsed.eventId,
				outcome: 'failed',
				durationMs: Number((performance.now() - startedAt).toFixed(2)),
				error: error instanceof Error ? error.name : 'UnknownError'
			})
			return NextResponse.json(
				{ error: 'Gameweek desk is temporarily unavailable' },
				{
					status: 502,
					headers: { 'Cache-Control': GAMEWEEK_DESK_UNCACHEABLE_CONTROL }
				}
			)
		}
	}
}
