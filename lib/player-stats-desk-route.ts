import {
	parsePlayerStatsDeskParams,
	playerStatsDeskResponseFromResult,
	type PlayerStatsDeskLoadResult
} from '@/lib/player-stats-desk'
import { NextResponse } from 'next/server'

export const PLAYER_STATS_DESK_PUBLIC_CACHE_CONTROL =
	'public, s-maxage=300, stale-while-revalidate=300, no-transform'
export const PLAYER_STATS_DESK_UNCACHEABLE_CONTROL = 'no-store'

type PlayerStatsDeskLoader = (
	playerIds: number[],
	eventId: number,
	horizon: number,
	section: 'overview' | 'context' | 'recent' | 'production' | 'process'
) => Promise<PlayerStatsDeskLoadResult>

type PlayerStatsDeskLogger = {
	info: (message: string, detail: Record<string, unknown>) => void
	error: (message: string, detail: Record<string, unknown>) => void
}

const defaultLogger: PlayerStatsDeskLogger = {
	info: (message, detail) => console.info(message, detail),
	error: (message, detail) => console.error(message, detail)
}

export function createPlayerStatsDeskRouteHandler(
	load: PlayerStatsDeskLoader,
	logger: PlayerStatsDeskLogger = defaultLogger
): (request: Request) => Promise<NextResponse> {
	return async request => {
		const parsed = parsePlayerStatsDeskParams(new URL(request.url).searchParams)
		if (!parsed.ok) {
			return NextResponse.json(
				{ error: parsed.error },
				{
					status: 400,
					headers: { 'Cache-Control': PLAYER_STATS_DESK_UNCACHEABLE_CONTROL }
				}
			)
		}
		const startedAt = performance.now()
		try {
			const result = await load(
				parsed.playerIds,
				parsed.eventId,
				parsed.horizon,
				parsed.section
			)
			const detail = {
				count: parsed.playerIds.length,
				section: parsed.section,
				outcome: result.outcome,
				durationMs: Number((performance.now() - startedAt).toFixed(2))
			}
			if (result.outcome === 'failed') {
				logger.error('[player-stats-desk]', detail)
				return NextResponse.json(
					{ error: 'Player stats are temporarily unavailable' },
					{
						status: 502,
						headers: {
							'Cache-Control': PLAYER_STATS_DESK_UNCACHEABLE_CONTROL
						}
					}
				)
			}
			logger.info('[player-stats-desk]', detail)
			return NextResponse.json(playerStatsDeskResponseFromResult(result), {
				status: 200,
				headers: {
					'Cache-Control':
						result.outcome === 'complete'
							? PLAYER_STATS_DESK_PUBLIC_CACHE_CONTROL
							: PLAYER_STATS_DESK_UNCACHEABLE_CONTROL
				}
			})
		} catch (error) {
			logger.error('[player-stats-desk]', {
				count: parsed.playerIds.length,
				section: parsed.section,
				outcome: 'failed',
				durationMs: Number((performance.now() - startedAt).toFixed(2)),
				error: error instanceof Error ? error.name : 'UnknownError'
			})
			return NextResponse.json(
				{ error: 'Player stats are temporarily unavailable' },
				{
					status: 502,
					headers: { 'Cache-Control': PLAYER_STATS_DESK_UNCACHEABLE_CONTROL }
				}
			)
		}
	}
}
