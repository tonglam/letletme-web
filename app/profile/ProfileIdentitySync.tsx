'use client'

import { useRouter } from '@/i18n/navigation'
import { useSession } from '@/lib/auth-client'
import { useEffect, useRef } from 'react'

export function ProfileIdentitySync({ enabled }: { enabled: boolean }) {
	const router = useRouter()
	const { refetch } = useSession()
	const refreshed = useRef(false)

	useEffect(() => {
		if (!enabled || refreshed.current) return
		refreshed.current = true

		void (async () => {
			await refetch({ query: { disableCookieCache: true } })
			router.refresh()
		})()
	}, [enabled, refetch, router])

	return null
}
