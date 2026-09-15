'use client'

import { reportBrowserPerformanceMetric } from '@/lib/analytics/client-vitals'
import {
	measureRouteReadyDuration,
	routeReadyMeasurementKind
} from '@/lib/analytics/route-navigation'
import { normalizeMetricPage } from '@/lib/analytics/web-vitals'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function HomePersonalHydratedMarker({ enabled }: { enabled: boolean }) {
	const pathname = usePathname()
	const reportedIdentity = useRef<string | null>(null)

	useEffect(() => {
		if (!enabled || reportedIdentity.current === pathname) return
		const reportWhenReady = () => {
			if (
				reportedIdentity.current === pathname ||
				!document.querySelector('[data-home-personal-ready]')
			)
				return false
			reportedIdentity.current = pathname
			const measurementKind = routeReadyMeasurementKind(pathname)
			const measuredValue = measureRouteReadyDuration(pathname)
			const value = measuredValue ?? 0
			const missingStart = measuredValue === null
			reportBrowserPerformanceMetric(
				{
					name: 'HOME_PERSONAL_HYDRATED',
					value,
					delta: value,
					rating:
						!missingStart && value <= 3_000
							? 'good'
							: !missingStart && value <= 4_000
								? 'needs-improvement'
								: 'poor',
					metricId: `home-personal-${crypto.randomUUID()}`,
					page: normalizeMetricPage(pathname),
					audienceHint: 'session-hint',
					measurementKind,
					result: missingStart ? 'unavailable' : 'ok',
					reasonCode: missingStart ? 'unavailable' : 'none'
				},
				{ always: true }
			)
			return true
		}

		if (reportWhenReady()) return
		const observer = new MutationObserver(() => {
			if (reportWhenReady()) observer.disconnect()
		})
		observer.observe(document.body, { childList: true, subtree: true })
		return () => observer.disconnect()
	}, [enabled, pathname])

	return null
}
