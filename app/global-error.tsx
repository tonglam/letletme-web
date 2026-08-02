'use client'

import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import { useEffect } from 'react'

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error('[global error boundary]', error)
	}, [error])

	return (
		<html lang="en">
			<body className="min-h-svh bg-background text-foreground antialiased">
				<main className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
					<p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">LetLetMe</p>
					<h1 className="text-3xl font-bold tracking-tight">The app shell could not start</h1>
					<p className="text-muted-foreground">
						Try loading the application again. Your account and tournament data have not been changed.
					</p>
					<Button onClick={reset}>
						<RotateCcw data-icon="inline-start" />
						Reload LetLetMe
					</Button>
				</main>
			</body>
		</html>
	)
}
