'use client'

import type { ReactNode } from 'react'

/**
 * Shared section chrome for the player desk. Keeping this in one place makes
 * state, evidence, and context read as one product surface instead of three
 * unrelated card systems.
 */
export function PlayerStatsSection({
	id,
	title,
	hint,
	children,
	className
}: {
	id?: string
	title: string
	hint?: string
	children: ReactNode
	className?: string
}) {
	return (
		<section
			id={id}
			aria-labelledby={id ? `${id}-heading` : undefined}
			className={`scroll-mt-36 border-t border-border/60 pt-4 ${className ?? ''}`}
		>
			<div className="mb-3">
				<h2
					id={id ? `${id}-heading` : undefined}
					className="eyebrow sm:text-caption"
				>
					{title}
				</h2>
				{hint ? (
					<p className="mt-0.5 text-caption text-muted-foreground/80">{hint}</p>
				) : null}
			</div>
			{children}
		</section>
	)
}
