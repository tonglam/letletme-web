'use client'

import { PageState } from '@/components/feedback/PageState'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error('[error boundary]', error)
	}, [error])

	return (
		<PageState
			icon={AlertTriangle}
			title="This page could not be loaded"
			description="The rest of LetLetMe is still available. Try this request again, or return to the dashboard."
			actions={
				<>
					<Button onClick={reset}>
						<RotateCcw data-icon="inline-start" />
						Try again
					</Button>
					<Button variant="outline" asChild>
						<Link href="/">Dashboard</Link>
					</Button>
				</>
			}
		/>
	)
}
