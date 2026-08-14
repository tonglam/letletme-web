'use client'

import dynamic from 'next/dynamic'
import { usePathname } from '@/i18n/navigation'

const Toaster = dynamic(
	() => import('sonner').then(module => module.Toaster),
	{ ssr: false },
)

const TOAST_ROUTES = ['/explore/fixtures', '/onboarding', '/profile'] as const

export function AppToaster() {
	const pathname = usePathname()
	const enabled = TOAST_ROUTES.some(route => pathname.startsWith(route))

	if (!enabled) return null

	return <Toaster richColors position="top-center" />
}
