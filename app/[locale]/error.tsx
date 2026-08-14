'use client'

import { PageState } from '@/components/feedback/PageState'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

export default function ErrorPage({
	error,
	reset
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	const common = useTranslations('Common')

	useEffect(() => {
		console.error('[error boundary]', error)
	}, [error])

	return (
		<PageState
			icon={AlertTriangle}
			title={common('pageLoadErrorTitle')}
			description={common('pageLoadErrorDescription')}
			actions={
				<>
					<Button onClick={reset}>
						<RotateCcw data-icon="inline-start" />
						{common('tryAgain')}
					</Button>
					<Button
						variant="outline"
						asChild
					>
						<Link href="/">{common('dashboard')}</Link>
					</Button>
				</>
			}
		/>
	)
}
