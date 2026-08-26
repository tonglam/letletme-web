'use client'

import { useHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/utils'

export function LocalSnapshotTime({
	value,
	label,
	locale,
	className
}: {
	value: string | null
	label: string
	locale: string
	className?: string
}) {
	const hydrated = useHydrated()
	const timestamp = value ? Date.parse(value) : NaN
	const formatted =
		hydrated && Number.isFinite(timestamp)
			? new Intl.DateTimeFormat(locale, {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
					timeZoneName: 'short'
				}).format(new Date(timestamp))
			: '—'

	return (
		<time
			dateTime={value ?? undefined}
			suppressHydrationWarning
			className={cn(
				'whitespace-nowrap text-xs text-muted-foreground',
				className
			)}
		>
			{label} {formatted}
		</time>
	)
}
