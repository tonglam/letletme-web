'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

export function SeasonPhaseRetry() {
	const router = useRouter()
	const t = useTranslations('SeasonState')
	const [isPending, startTransition] = useTransition()

	return (
		<Button
			type="button"
			variant="outline"
			disabled={isPending}
			aria-busy={isPending}
			onClick={() => startTransition(() => router.refresh())}
		>
			{isPending ? t('retrying') : t('retry')}
		</Button>
	)
}
