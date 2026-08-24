'use client'

import { Button, type ButtonProps } from '@/components/ui/button'
import { MessageCircleWarning } from 'lucide-react'

import { ReportProblemEntry } from './ReportProblemEntry'

type ReportProblemButtonProps = {
	label: string
	className?: string
	variant?: ButtonProps['variant']
	size?: ButtonProps['size']
}

/**
 * Keep the trigger element inside the client boundary. Server components can
 * pass the label safely, while ReportProblemEntry can still decorate the
 * actual button with its dialog state and accessibility attributes.
 */
export function ReportProblemButton({
	label,
	className,
	variant,
	size
}: ReportProblemButtonProps) {
	return (
		<ReportProblemEntry>
			{variant ? (
				<Button
					type="button"
					variant={variant}
					size={size}
					className={className}
				>
					<MessageCircleWarning
						aria-hidden="true"
						data-icon="inline-start"
					/>
					{label}
				</Button>
			) : (
				<button
					type="button"
					className={className}
				>
					<MessageCircleWarning
						aria-hidden="true"
						className="size-4"
					/>
					{label}
				</button>
			)}
		</ReportProblemEntry>
	)
}
