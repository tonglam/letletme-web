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
					<p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
						<span style={{ color: 'hsl(152 100% 50%)' }}>L</span>
						et
						<span style={{ color: 'hsl(152 100% 50%)' }}>L</span>
						et
						<span style={{ color: 'hsl(152 100% 50%)' }}>M</span>
						e
					</p>
					<h1 className="text-3xl font-bold tracking-tight">The app shell could not start / 应用无法启动</h1>
					<p className="text-muted-foreground">
						Try loading the application again. Your data has not been changed.<br />
						请重新加载应用，你的数据未受影响。
					</p>
					<Button onClick={reset}>
						<RotateCcw data-icon="inline-start" />
						Reload LetLetMe / 重新加载
					</Button>
				</main>
			</body>
		</html>
	)
}
