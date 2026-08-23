'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { lazy, Suspense, useState, type ReactNode } from 'react'

const ReportProblemDialog = lazy(() =>
	import('./ReportProblemDialog').then(module => ({
		default: module.ReportProblemDialog
	}))
)

/**
 * Keep the globally rendered entry point small. Form controls, diagnostics,
 * Radix Dialog, and Sonner are requested only after somebody opens the sheet.
 */
export function ReportProblemEntry({
	children,
	className,
	triggerClassName,
	open: controlledOpen,
	onOpenChange
}: {
	children?: ReactNode
	className?: string
	triggerClassName?: string
	open?: boolean
	onOpenChange?: (open: boolean) => void
}) {
	const t = useTranslations('ReportProblem')
	const [internalOpen, setInternalOpen] = useState(false)
	const [activated, setActivated] = useState(Boolean(controlledOpen))
	const open = controlledOpen ?? internalOpen

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) setActivated(true)
		if (controlledOpen === undefined) setInternalOpen(nextOpen)
		onOpenChange?.(nextOpen)
	}

	return (
		<>
			{children ? (
				<span
					className="contents"
					onClick={() => handleOpenChange(true)}
				>
					{children}
				</span>
			) : controlledOpen === undefined ? (
				<button
					type="button"
					aria-haspopup="dialog"
					className={cn(triggerClassName)}
					onClick={() => handleOpenChange(true)}
				>
					{t('entry')}
				</button>
			) : null}
			{activated || open ? (
				<Suspense fallback={null}>
					<ReportProblemDialog
						open={open}
						onOpenChange={handleOpenChange}
						className={className}
					/>
				</Suspense>
			) : null}
		</>
	)
}
