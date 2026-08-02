import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface PageStateProps {
	icon: LucideIcon
	title: string
	description: string
	actions?: ReactNode
	className?: string
}

export function PageState({
	icon: Icon,
	title,
	description,
	actions,
	className,
}: PageStateProps) {
	return (
		<div className={cn('mx-auto flex min-h-[55svh] w-full max-w-4xl items-center px-4 py-12', className)}>
			<Card className="mx-auto w-full max-w-xl overflow-hidden">
				<CardHeader className="items-center pb-3 text-center">
					<div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink">
						<Icon aria-hidden="true" className="size-6" />
					</div>
					<CardTitle asChild className="text-2xl">
						<h1>{title}</h1>
					</CardTitle>
					<CardDescription className="max-w-md text-base leading-relaxed">
						{description}
					</CardDescription>
				</CardHeader>
				<CardContent />
				{actions ? (
					<CardFooter className="justify-center gap-3">{actions}</CardFooter>
				) : null}
			</Card>
		</div>
	)
}
