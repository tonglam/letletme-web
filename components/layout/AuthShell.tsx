import { LogoMark, LogoWordmark } from '@/components/layout/Logo'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * Centered auth page shell — brand mark above a single card.
 * Shared by login / signup / password reset / email verification.
 */
export function AuthShell({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-6 flex items-center gap-2">
				<LogoMark className="size-10" />
				<h1>
					<LogoWordmark className="text-2xl" />
				</h1>
			</div>
			{children}
		</div>
	)
}

export function AuthCard({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<Card className={cn('w-full max-w-md p-6 shadow-sm', className)}>
			{children}
		</Card>
	)
}
