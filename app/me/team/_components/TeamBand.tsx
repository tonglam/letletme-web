import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * Lightweight band label for page narrative — not a card, just orientation.
 */
export function TeamBand({
	id,
	label,
	description,
	children,
	className,
}: {
	id?: string
	label: string
	description?: string
	children: ReactNode
	className?: string
}) {
	return (
		<section
			id={id}
			className={cn('scroll-mt-20', className)}
			aria-labelledby={id ? `${id}-label` : undefined}
		>
			<header className="mb-4 border-b border-border/60 pb-3 sm:mb-5">
				<p
					id={id ? `${id}-label` : undefined}
					className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-plum dark:text-electric/90"
				>
					{label}
				</p>
				{description ? (
					<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
						{description}
					</p>
				) : null}
			</header>
			{children}
		</section>
	)
}
