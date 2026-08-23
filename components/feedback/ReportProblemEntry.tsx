'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import {
	lazy,
	Suspense,
	useRef,
	useState,
	type MouseEvent as ReactMouseEvent,
	type ReactNode
} from 'react'

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
	const triggerRef = useRef<HTMLElement | null>(null)
	const open = controlledOpen ?? internalOpen

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) setActivated(true)
		if (controlledOpen === undefined) setInternalOpen(nextOpen)
		onOpenChange?.(nextOpen)
	}
	const handleTriggerClick = (event: ReactMouseEvent<HTMLElement>) => {
		const clickedTarget =
			event.target instanceof Element
				? event.target.closest<HTMLElement>(
						'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
					)
				: null
		const activeTarget =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null
		triggerRef.current = clickedTarget ?? activeTarget ?? event.currentTarget
		handleOpenChange(true)
	}
	const restoreTriggerFocus = () => {
		const trigger = triggerRef.current
		if (!trigger?.isConnected) return false
		trigger.focus({ preventScroll: true })
		return document.activeElement === trigger
	}

	return (
		<>
			{children ? (
				<span
					className="contents"
					onClick={handleTriggerClick}
				>
					{children}
				</span>
			) : controlledOpen === undefined ? (
				<button
					type="button"
					aria-haspopup="dialog"
					className={cn(triggerClassName)}
					onClick={handleTriggerClick}
				>
					{t('entry')}
				</button>
			) : null}
			{activated || open ? (
				<Suspense fallback={null}>
					<ReportProblemDialog
						open={open}
						onOpenChange={handleOpenChange}
						onRestoreFocus={restoreTriggerFocus}
						className={className}
					/>
				</Suspense>
			) : null}
		</>
	)
}
