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
}: {
	capturedAt: string
	dateOnly?: boolean
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
		// No timeZone option → browser local zone. The market page uses the
		// compact date-only variant in its page header; other consumers keep the
		// precise capture timestamp.
		const formatOptions = dateOnly
			? {
					day: 'numeric' as const,
					month: 'short' as const,
				}
			: {
					day: 'numeric' as const,
					month: 'short' as const,
					hour: '2-digit' as const,
					minute: '2-digit' as const,
					second: '2-digit' as const,
					timeZoneName: 'short' as const,
				}
		setLabel(
			format.dateTime(parsed, formatOptions),
		)
	}, [capturedAt, dateOnly, format])

	if (!label) {
		return (
			<time
				dateTime={capturedAt}
				className={`inline-block min-h-5 whitespace-nowrap tabular-nums ${dateOnly ? 'min-w-0' : 'min-w-56'}`}
				suppressHydrationWarning
			>
				{t('lastUpdated', { date: '…' })}
			</time>
		)
	}

	return (
		<time
			dateTime={capturedAt}
			className={`inline-block min-h-5 whitespace-nowrap tabular-nums ${dateOnly ? 'min-w-0' : 'min-w-56'}`}
		>
			{t('lastUpdated', { date: label })}
		</time>
	)
}
