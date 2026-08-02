'use client'

import { normalizeMetricPage } from '@/lib/analytics/web-vitals'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'

const getSampleRate = () => {
	const configured = Number(process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE)
	if (!Number.isFinite(configured)) return process.env.NODE_ENV === 'production' ? 0.25 : 1
	return Math.min(1, Math.max(0, configured))
}

const getDeviceGroup = () => {
	if (window.innerWidth < 640) return 'mobile'
	if (window.innerWidth < 1024) return 'tablet'
	return 'desktop'
}

const shouldSample = (metricId: string, page: string) => {
	const sampleRate = getSampleRate()
	if (sampleRate <= 0) return false
	if (sampleRate >= 1) return true

	let hash = 2166136261
	for (const character of `${metricId}:${page}`) {
		hash ^= character.charCodeAt(0)
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0) / 2 ** 32 < sampleRate
}

export function WebVitalsReporter() {
	const pathname = usePathname()
	const page = normalizeMetricPage(pathname)

	useReportWebVitals(metric => {
		if (!shouldSample(metric.id, page)) return

		const payload = JSON.stringify({
			name: metric.name,
			value: metric.value,
			delta: metric.delta,
			rating: metric.rating,
			metricId: metric.id,
			page,
			device: getDeviceGroup(),
		})

		if (navigator.sendBeacon) {
			const accepted = navigator.sendBeacon(
				'/api/vitals',
				new Blob([payload], { type: 'application/json' }),
			)
			if (accepted) return
		}

		void fetch('/api/vitals', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: payload,
			keepalive: true,
		})
	})

	return null
}
