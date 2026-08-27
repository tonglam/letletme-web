'use client'

import { useHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/utils'

export function formatLocalSnapshotTime(
	value: string | null,
	locale: string
): string | null {
	const timestamp = value ? Date.parse(value) : NaN
	if (!Number.isFinite(timestamp)) return null

	return new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		timeZoneName: 'short'
	}).format(new Date(timestamp))
}

export function formatLocalSnapshotDate(
	value: string | null,
	locale: string
): string | null {
	const timestamp = value ? Date.parse(value) : NaN
	if (!Number.isFinite(timestamp)) return null

	return new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	}).format(new Date(timestamp))
}

export function LocalSnapshotTime({
	value,
	label,
	locale,
	className,
	dateOnly = false
}: {
	value: string | null
	label: string
	locale: string
	className?: string
	dateOnly?: boolean
}) {
	const hydrated = useHydrated()
	const formatted =
		hydrated
			? (dateOnly
				? (formatLocalSnapshotDate(value, locale) ?? '—')
				: (formatLocalSnapshotTime(value, locale) ?? '—'))
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
