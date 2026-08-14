'use client'

import { lazy, Suspense } from 'react'

const Toaster = lazy(() =>
	import('sonner').then(module => ({ default: module.Toaster }))
)

export function AppToaster() {
	return (
		<Suspense fallback={null}>
			<Toaster richColors position="top-center" />
		</Suspense>
	)
}
