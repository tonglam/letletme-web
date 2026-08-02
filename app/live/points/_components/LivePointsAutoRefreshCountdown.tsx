'use client'

import { useEffect, useRef, useState } from 'react'
import { LIVE_POINTS_AUTO_REFRESH_SECONDS } from '../_lib/live-points-model'

export function LivePointsAutoRefreshCountdown({
	enabled,
	onRefresh,
}: {
	enabled: boolean
	onRefresh: () => Promise<void>
}) {
	const [countdown, setCountdown] = useState<number | null>(null)
	const refreshInFlightRef = useRef(false)
	const onRefreshRef = useRef(onRefresh)

	useEffect(() => {
		onRefreshRef.current = onRefresh
	}, [onRefresh])

	useEffect(() => {
		if (!enabled) {
			const resetTimer = window.setTimeout(() => setCountdown(null), 0)
			return () => window.clearTimeout(resetTimer)
		}

		const initialTimer = window.setTimeout(
			() => setCountdown(LIVE_POINTS_AUTO_REFRESH_SECONDS),
			0,
		)
		const intervalId = window.setInterval(() => {
			setCountdown((previous) => {
				if (previous === null || previous <= 1) {
					if (!refreshInFlightRef.current) {
						refreshInFlightRef.current = true
						void onRefreshRef.current().finally(() => {
							refreshInFlightRef.current = false
						})
					}
					return LIVE_POINTS_AUTO_REFRESH_SECONDS
				}
				return previous - 1
			})
		}, 1000)

		return () => {
			window.clearTimeout(initialTimer)
			window.clearInterval(intervalId)
		}
	}, [enabled])

	if (!enabled || countdown === null) return null

	return <span className="text-xs text-muted-foreground">Next refresh in {countdown}s</span>
}
