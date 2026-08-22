'use client'

import { PageState } from '@/components/feedback/PageState'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export function PlayerStatsUnavailable() {
	const router = useRouter()
	const t = useTranslations('PlayerStats')
	const common = useTranslations('Common')

	return (
		<PageState
			icon={AlertTriangle}
			title={t('title')}
			description={t('directoryLoading')}
			actions={
				<Button
					type="button"
					onClick={() => router.refresh()}
				>
					<RotateCcw data-icon="inline-start" />
					{common('tryAgain')}
				</Button>
			}
			role="alert"
		/>
	)
}
