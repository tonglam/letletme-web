'use client'

import { usePathname } from '@/i18n/navigation'
import { lazy, Suspense, useEffect, useState } from 'react'

const Toaster = lazy(() =>
	import('sonner').then(module => ({ default: module.Toaster }))
)

const TOAST_ROUTES = [
	'/competitions',
	'/explore',
	'/live',
	'/my-fpl',
	'/onboarding',
	'/profile'
] as const

export function AppToaster() {
	const pathname = usePathname()
	const routeEmitsToasts =
		pathname === '/' || TOAST_ROUTES.some(route => pathname.startsWith(route))
	const [activated, setActivated] = useState(routeEmitsToasts)

	useEffect(() => {
		if (routeEmitsToasts) setActivated(true)
	}, [routeEmitsToasts])

	// Keep an activated toaster mounted across App Router navigation so a toast
	// emitted immediately before leaving a route is not truncated. Home and the
	// feature route groups are activated because they expose share actions.
	if (!activated) return null

	return (
		<Suspense fallback={null}>
			<Toaster richColors position="top-center" />
		</Suspense>
	)
}
