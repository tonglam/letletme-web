'use client'

import { reportBrowserPerformanceMetric } from '@/lib/analytics/client-vitals'
import {
	normalizeMetricPage,
	type AudienceHint
} from '@/lib/analytics/web-vitals'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

type ReadyMetricName =
	| 'MARKET_CONTENT_READY'
	| 'PLAYER_DIRECTORY_READY'
	| 'PLAYER_DETAIL_READY'
	| 'SESSION_STATE_READY'

export function RouteReadyMarker({
	name,
	ready = true,
	audienceHint,
	goodMs = 2_500,
	poorMs = 4_000
}: {
	name: ReadyMetricName
	ready?: boolean
	audienceHint: AudienceHint
	goodMs?: number
	poorMs?: number
}) {
	const pathname = usePathname()
	const reported = useRef(false)

	useEffect(() => {
		if (!ready || reported.current) return
		reported.current = true
		const value = performance.now()
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
	}, [audienceHint, goodMs, name, pathname, poorMs, ready])

	return null
}
