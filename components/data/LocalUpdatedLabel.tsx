'use client'

import { useFormatter } from 'next-intl'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

type LocalUpdatedLabelProps = {
	value: string | null
	prefix: string
	fallback: ReactNode
}

/**
 * Render a data freshness timestamp in the browser's timezone without making
 * the server guess the viewer's timezone during hydration.
 */
export function LocalUpdatedLabel({
	value,
	prefix,
	fallback
}: LocalUpdatedLabelProps) {
	const format = useFormatter()
	const [label, setLabel] = useState<string | null>(null)

	useEffect(() => {
		if (!value) {
			setLabel(null)
			return
		}

		const parsed = new Date(value)
		if (Number.isNaN(parsed.getTime())) {
			setLabel(null)
			return
		}

		const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		setLabel(
			format.dateTime(parsed, {
				dateStyle: 'medium',
				timeStyle: 'medium',
				timeZone: browserTimeZone
			})
		)
	}, [format, value])

	if (!value || !label) return <>{fallback}</>

	return (
		<time
			dateTime={value}
			className="whitespace-nowrap tabular-nums"
		>
			{prefix} {label}
		</time>
	)
}
