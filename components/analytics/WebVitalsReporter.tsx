'use client'

import {
	reportBrowserPerformanceMetric,
	reportBrowserRuntimeError,
	resolveAudienceHint,
	resolveNavigationId
} from '@/lib/analytics/client-vitals'
import { normalizeMetricPage } from '@/lib/analytics/web-vitals'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'
import { useCallback, useEffect, useRef } from 'react'

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0]

export function WebVitalsReporter() {
	const pathname = usePathname()
	const pageRef = useRef(normalizeMetricPage(pathname))
	const page = normalizeMetricPage(pathname)
	useEffect(() => {
		pageRef.current = page
	}, [page])

	const reportWebVital = useCallback<ReportWebVitalsCallback>(metric => {
		const page = pageRef.current
		reportBrowserPerformanceMetric({
			name: metric.name,
			value: metric.value,
			delta: metric.delta,
			rating: metric.rating,
			metricId: metric.id,
			page,
			audienceHint: resolveAudienceHint(),
			navigationId: resolveNavigationId()
		})
	}, [])

	useReportWebVitals(reportWebVital)

	useEffect(() => {
		const reportRuntimeError = () => reportBrowserRuntimeError()
		window.addEventListener('error', reportRuntimeError)
		window.addEventListener('unhandledrejection', reportRuntimeError)
		return () => {
			window.removeEventListener('error', reportRuntimeError)
			window.removeEventListener('unhandledrejection', reportRuntimeError)
		}
	}, [])

	return null
}
