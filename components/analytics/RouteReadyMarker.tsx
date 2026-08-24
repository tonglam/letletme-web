'use client'

import { reportBrowserPerformanceMetric } from '@/lib/analytics/client-vitals'
import type { PlayerStatsCacheStatus } from '@/lib/analytics/performance-correlation'
import {
	measureRouteReadyDuration,
	nextPaintOpportunityTime,
	observeElementPaintTime,
	routeReadyStartTime
} from '@/lib/analytics/route-navigation'
import {
	normalizeMetricPage,
	type AudienceHint
} from '@/lib/analytics/web-vitals'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

type ReadyMetricName =
	| 'FIXTURES_WINDOW_READY'
	| 'LIVE_MATCHDAY_READY'
	| 'LIVE_MATCH_PLAYERS_READY'
	| 'LIVE_COMPETITIONS_LIST_READY'
	| 'LIVE_COMPETITION_BOARD_READY'
	| 'LIVE_COMPETITION_SWITCH_READY'
	| 'COMPETITIONS_BROWSE_READY'
	| 'COMPETITIONS_CREATE_READY'
	| 'COMPETITIONS_MANAGE_READY'
	| 'GAMEWEEK_CONTENT_READY'
	| 'MARKET_CONTENT_READY'
	| 'MARKET_SEARCH_READY'
	| 'MARKET_HISTORY_READY'
	| 'MARKET_AVAILABILITY_READY'
	| 'PLAYER_DIRECTORY_READY'
	| 'PLAYER_DIRECTORY_PAINT'
	| 'PLAYER_DETAIL_READY'
	| 'PLAYER_DETAIL_PAINT'
	| 'PLAYER_COMPARE_READY'
	| 'PLAYER_COMPARE_PAINT'
	| 'PLAYER_DESK_RESPONSE'
	| 'TRENDS_CATALOG_READY'
	| 'TRENDS_DESK_READY'
	| 'TRENDS_SWITCH_READY'
	| 'HOME_TEAM_DESK_READY'
	| 'HOME_LEAGUE_RANKS_READY'
	| 'SESSION_STATE_READY'

export function RouteReadyMarker({
	name,
	ready = true,
	readyKey,
	elementTiming,
	navigationId,
	interactionId,
	cacheStatus,
	audienceHint,
	goodMs = 2_500,
	poorMs = 4_000
}: {
	name: ReadyMetricName
	ready?: boolean
	readyKey?: string
	elementTiming?: string
	navigationId?: string
	interactionId?: string
	cacheStatus?: PlayerStatsCacheStatus
	audienceHint: AudienceHint
	goodMs?: number
	poorMs?: number
}) {
	const pathname = usePathname()
	const reportedIdentity = useRef<string | null>(null)
	const readyIdentity = `${pathname}\u0000${readyKey ?? ''}`

	useEffect(() => {
		if (!ready || reportedIdentity.current === readyIdentity) return
		reportedIdentity.current = readyIdentity
		let cancelled = false
		const effectAt = performance.now()
		const routeStartedAt = routeReadyStartTime(pathname, undefined, readyKey)
		void (async () => {
			const paintedAt = elementTiming
				? await observeElementPaintTime(elementTiming, routeStartedAt)
				: null
			if (cancelled) return
			const readyAt =
				paintedAt ??
				(elementTiming ? await nextPaintOpportunityTime() : effectAt)
			if (cancelled) return
			const value = measureRouteReadyDuration(
				pathname,
				readyAt,
				undefined,
				readyKey
			)
			reportBrowserPerformanceMetric(
				{
					name,
					value,
					delta: value,
					rating:
						value <= goodMs
							? 'good'
							: value <= poorMs
								? 'needs-improvement'
								: 'poor',
					metricId: `${name.toLowerCase()}-${crypto.randomUUID()}`,
					page: normalizeMetricPage(pathname),
					audienceHint,
					navigationId,
					interactionId,
					cacheStatus
				},
				{ always: true }
			)
		})()
		return () => {
			cancelled = true
		}
	}, [
		audienceHint,
		elementTiming,
		interactionId,
		navigationId,
		cacheStatus,
		goodMs,
		name,
		pathname,
		poorMs,
		ready,
		readyIdentity,
		readyKey
	])

	return null
}
