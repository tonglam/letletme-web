'use client'

import { useRouter } from '@/i18n/navigation'
import { useEffect } from 'react'

const REFRESH_INTERVAL_MS = 5_000

/**
 * The official post-deadline window is normal lifecycle, not an error. Keep a
 * phase-only page live until the server can render its real destination.
 */
export function SeasonPhaseAutoRefresh() {
	const router = useRouter()

	useEffect(() => {
		let cancelled = false
		const refresh = () => {
			if (cancelled || document.visibilityState === 'hidden') return
			router.refresh()
		}
		const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS)
		return () => {
			cancelled = true
			window.clearInterval(intervalId)
		}
	}, [router])

	return null
}
