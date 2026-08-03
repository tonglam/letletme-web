'use client'

import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { useTranslations } from 'next-intl'

export function LivePointsAutoRefreshCountdown({
	enabled,
	onRefresh
}: {
	enabled: boolean
	onRefresh: () => Promise<void>
}) {
	const t = useTranslations('LivePoints')
	return (
		<LiveAutoRefreshCountdown
			enabled={enabled}
			onRefresh={onRefresh}
			renderLabel={seconds => t('nextRefresh', { seconds })}
		/>
	)
}
