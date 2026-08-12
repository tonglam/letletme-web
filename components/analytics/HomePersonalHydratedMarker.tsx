'use client'

import { reportBrowserPerformanceMetric } from '@/lib/analytics/client-vitals'
import { normalizeMetricPage } from '@/lib/analytics/web-vitals'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function HomePersonalHydratedMarker({ enabled }: { enabled: boolean }) {
	const pathname = usePathname()
	const reported = useRef(false)

	useEffect(() => {
		if (!enabled || reported.current) return
		const reportWhenReady = () => {
			if (
				reported.current ||
				!document.querySelector('[data-home-personal-ready]')
			)
				return false
			reported.current = true
			const value = performance.now()
			reportBrowserPerformanceMetric(
				{
					name: 'HOME_PERSONAL_HYDRATED',
					value,
					delta: value,
					rating:
						value <= 3_000
							? 'good'
							: value <= 4_000
								? 'needs-improvement'
								: 'poor',
					metricId: `home-personal-${crypto.randomUUID()}`,
					page: normalizeMetricPage(pathname),
					audienceHint: 'session-hint'
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
