import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface PageShellProps {
	children: ReactNode
	className?: string
}

export default function PageShell({ children, className }: PageShellProps) {
	return (
		<div className={cn('min-h-[calc(100svh-4rem)] bg-background', className)}>
			{children}
		</div>
	)
}
