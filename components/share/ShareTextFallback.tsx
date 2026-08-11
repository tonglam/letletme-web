'use client'

import { Button } from '@/components/ui/button'

export function ShareTextFallback({
	text,
	message,
	fieldLabel,
	closeLabel,
	onClose
}: {
	text: string
	message: string
	fieldLabel: string
	closeLabel: string
	onClose: () => void
}) {
	return (
		<div
			className="mt-3 space-y-2 rounded-lg border border-border/80 bg-muted/30 p-3"
			role="status"
		>
			<p className="text-xs text-muted-foreground">{message}</p>
			<textarea
				aria-label={fieldLabel}
				className="min-h-40 w-full resize-y rounded-md border border-border bg-background p-2 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring"
				onFocus={event => event.currentTarget.select()}
				readOnly
				rows={8}
				value={text}
			/>
			<div className="flex justify-end">
				<Button type="button" size="sm" variant="ghost" onClick={onClose}>
					{closeLabel}
				</Button>
			</div>
		</div>
	)
}
