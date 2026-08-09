'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, type ReactNode } from 'react'

/**
 * Single-mount filter stack: collapsed by default on &lt;md, always visible on md+.
 * Avoids duplicating filter state across mobile sheet + desktop trees.
 */
export function MobileCollapsibleFilters({
	children,
	activeCount = 0,
	className,
}: {
	children: ReactNode
	/** Optional badge when ownership/team (or other) filters are active */
	activeCount?: number
	className?: string
}) {
	const t = useTranslations('Filters')
	const [open, setOpen] = useState(false)

	return (
		<div className={cn('mb-6', className)}>
			<div className="md:hidden">
				<Button
					type="button"
					variant="outline"
					className="mb-3 flex h-11 w-full items-center justify-between gap-2"
					aria-expanded={open}
					onClick={() => setOpen(value => !value)}
				>
					<span className="inline-flex items-center gap-2">
						<SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
						{t('advancedFilters')}
						{activeCount > 0 ? (
							<Badge variant="secondary" className="tabular-nums">
								{activeCount}
							</Badge>
						) : null}
					</span>
					<ChevronDown
						className={cn(
							'size-4 shrink-0 text-muted-foreground transition-transform',
							open && 'rotate-180',
						)}
						aria-hidden="true"
					/>
				</Button>
			</div>

			<div className={cn(open ? 'block' : 'hidden', 'md:block')}>{children}</div>
		</div>
	)
}
