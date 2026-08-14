'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

export function PersonalDeskRetry() {
	const router = useRouter()
	const t = useTranslations('Home')
	const [isPending, startTransition] = useTransition()

	return (
		<Button
			type="button"
			variant="outline"
			disabled={isPending}
			aria-busy={isPending}
			onClick={() => startTransition(() => router.refresh())}
		>
			{isPending ? t('personalRetrying') : t('personalRetry')}
		</Button>
	)
}
