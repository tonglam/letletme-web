'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

/**
 * Format capture timestamp in the viewer's local timezone.
 * SSR omits a fixed zone string to avoid server TZ (e.g. Perth/GMT+8) leaking in.
 */
export function MarketLocalUpdated({
	capturedAt,
	dateOnly = false,
	className
}: {
	capturedAt: string
	dateOnly?: boolean
	className?: string
}) {
	const t = useTranslations('Market')
	const format = useFormatter()
	const [label, setLabel] = useState<string | null>(null)

	useEffect(() => {
		const parsed = new Date(capturedAt)
		if (Number.isNaN(parsed.getTime())) {
			setLabel(capturedAt)
			return
		}
		// next-intl inherits the server provider zone unless explicitly overridden.
		// Resolve the viewer zone after hydration for both timestamp variants.
		const formatOptions = dateOnly
			? {
					day: 'numeric' as const,
					month: 'short' as const
				}
			: {
					day: 'numeric' as const,
					month: 'short' as const,
					hour: '2-digit' as const,
					minute: '2-digit' as const,
					second: '2-digit' as const,
					timeZoneName: 'short' as const
				}
		setLabel(format.dateTime(parsed, {
			...formatOptions,
			timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
		}))
	}, [capturedAt, dateOnly, format])

	if (!label) {
		return (
			<time
				dateTime={capturedAt}
				className={`inline-block min-h-5 whitespace-nowrap text-xs text-muted-foreground tabular-nums ${dateOnly ? 'min-w-0' : 'min-w-56'} ${className ?? ''}`}
				suppressHydrationWarning
			>
				{t('lastUpdated', { date: '…' })}
			</time>
		)
	}

	return (
		<time
			dateTime={capturedAt}
			className={`inline-block min-h-5 whitespace-nowrap text-xs text-muted-foreground tabular-nums ${dateOnly ? 'min-w-0' : 'min-w-56'} ${className ?? ''}`}
		>
			{t('lastUpdated', { date: label })}
		</time>
	)
}
