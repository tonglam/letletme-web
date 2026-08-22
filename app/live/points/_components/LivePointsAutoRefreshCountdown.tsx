'use client'

import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { useTranslations } from 'next-intl'

export function LivePointsAutoRefreshCountdown({
	enabled,
	onRefresh,
	nextRefreshAt
}: {
	enabled: boolean
	onRefresh: () => Promise<void>
	nextRefreshAt?: string | null
}) {
	const t = useTranslations('LivePoints')
	return (
		<LiveAutoRefreshCountdown
			enabled={enabled}
			onRefresh={onRefresh}
			nextRefreshAt={nextRefreshAt}
			renderLabel={seconds => t('nextRefresh', { seconds })}
		/>
	)
}
