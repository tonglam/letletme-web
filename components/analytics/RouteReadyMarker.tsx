'use client'

import { reportBrowserPerformanceMetric } from '@/lib/analytics/client-vitals'
import { measureRouteReadyDuration } from '@/lib/analytics/route-navigation'
import {
	normalizeMetricPage,
	type AudienceHint
} from '@/lib/analytics/web-vitals'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

type ReadyMetricName =
	| 'FIXTURES_WINDOW_READY'
	| 'GAMEWEEK_CONTENT_READY'
	| 'MARKET_CONTENT_READY'
	| 'MARKET_SEARCH_READY'
	| 'MARKET_HISTORY_READY'
	| 'MARKET_AVAILABILITY_READY'
	| 'PLAYER_DIRECTORY_READY'
	| 'PLAYER_DETAIL_READY'
	| 'PLAYER_COMPARE_READY'
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
	audienceHint,
	goodMs = 2_500,
	poorMs = 4_000
}: {
	name: ReadyMetricName
	ready?: boolean
	readyKey?: string
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
		const value = measureRouteReadyDuration(
			pathname,
			performance.now(),
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
				audienceHint
			},
			{ always: true }
		)
	}, [audienceHint, goodMs, name, pathname, poorMs, ready, readyIdentity, readyKey])

	return null
}
