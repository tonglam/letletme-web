'use client'

import { usePathname } from '@/i18n/navigation'
import { lazy, Suspense } from 'react'

const Toaster = lazy(() =>
	import('sonner').then(module => ({ default: module.Toaster }))
)

const TOAST_ROUTES = ['/explore/fixtures', '/onboarding', '/profile'] as const

export function AppToaster() {
	const pathname = usePathname()
	const enabled = TOAST_ROUTES.some(route => pathname.startsWith(route))

	if (!enabled) return null

	return (
		<Suspense fallback={null}>
			<Toaster richColors position="top-center" />
		</Suspense>
	)
}
