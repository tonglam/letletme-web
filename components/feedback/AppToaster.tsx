'use client'

import { usePathname } from '@/i18n/navigation'
import { lazy, Suspense, useEffect, useState } from 'react'

const Toaster = lazy(() =>
	import('sonner').then(module => ({ default: module.Toaster }))
)

const TOAST_ROUTES = [
	'/explore/fixtures',
	'/explore/market',
	'/explore/selections',
	'/live',
	'/onboarding',
	'/profile'
] as const

export function AppToaster() {
	const pathname = usePathname()
	const routeEmitsToasts = TOAST_ROUTES.some(route => pathname.startsWith(route))
	const [activated, setActivated] = useState(routeEmitsToasts)

	useEffect(() => {
		if (routeEmitsToasts) setActivated(true)
	}, [routeEmitsToasts])

	// Keep an activated toaster mounted across App Router navigation so a toast
	// emitted immediately before leaving a route is not truncated. A cold Home
	// load stays inactive and does not request the Sonner chunk.
	if (!activated) return null

	return (
		<Suspense fallback={null}>
			<Toaster richColors position="top-center" />
		</Suspense>
	)
}
