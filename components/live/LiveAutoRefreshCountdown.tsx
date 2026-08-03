'use client'

import { LIVE_AUTO_REFRESH_SECONDS } from '@/lib/live-refresh'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

export function LiveAutoRefreshCountdown({
	enabled,
	onRefresh,
	renderLabel
}: {
	enabled: boolean
	onRefresh: () => Promise<void>
	renderLabel: (seconds: number) => ReactNode
}) {
	const [countdown, setCountdown] = useState<number | null>(null)
	const refreshInFlightRef = useRef(false)
	const onRefreshRef = useRef(onRefresh)
	const wasEnabledRef = useRef(enabled)

	useEffect(() => {
		onRefreshRef.current = onRefresh
	}, [onRefresh])

	useEffect(() => {
		const resumed = enabled && !wasEnabledRef.current
		wasEnabledRef.current = enabled

		if (!enabled) {
			const resetTimer = window.setTimeout(() => setCountdown(null), 0)
			return () => window.clearTimeout(resetTimer)
		}

		const runRefresh = () => {
			if (refreshInFlightRef.current) return
			refreshInFlightRef.current = true
			void onRefreshRef.current().finally(() => {
				refreshInFlightRef.current = false
			})
		}

		let refreshDeadline = Date.now() + LIVE_AUTO_REFRESH_SECONDS * 1000
		const initialTimer = window.setTimeout(
			() => setCountdown(LIVE_AUTO_REFRESH_SECONDS),
			0
		)
		if (resumed) runRefresh()

		const intervalId = window.setInterval(() => {
			const remaining = Math.max(
				0,
				Math.ceil((refreshDeadline - Date.now()) / 1000)
			)
			if (remaining === 0) {
				refreshDeadline = Date.now() + LIVE_AUTO_REFRESH_SECONDS * 1000
				runRefresh()
				setCountdown(LIVE_AUTO_REFRESH_SECONDS)
				return
			}
			setCountdown(remaining)
		}, 1000)

		return () => {
			window.clearTimeout(initialTimer)
			window.clearInterval(intervalId)
		}
	}, [enabled])

	if (!enabled || countdown === null) return null

	return (
		<span className="text-xs text-muted-foreground">
			{renderLabel(countdown)}
		</span>
	)
}
