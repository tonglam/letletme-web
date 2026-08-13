'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

/**
 * Format capture timestamp in the viewer's local timezone.
 * SSR omits a fixed zone string to avoid server TZ (e.g. Perth/GMT+8) leaking in.
 */
export function MarketLocalUpdated({
	capturedAt,
}: {
	capturedAt: string
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
		// No timeZone option → browser local zone
		setLabel(
			format.dateTime(parsed, {
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
				timeZoneName: 'short',
			}),
		)
	}, [capturedAt, format])

	if (!label) {
		return (
			<time
				dateTime={capturedAt}
				className="inline-block min-h-5 min-w-56 whitespace-nowrap tabular-nums"
				suppressHydrationWarning
			>
				{t('lastUpdated', { date: '…' })}
			</time>
		)
	}

	return (
		<time
			dateTime={capturedAt}
			className="inline-block min-h-5 min-w-56 whitespace-nowrap tabular-nums"
		>
			{t('lastUpdated', { date: label })}
		</time>
	)
}
