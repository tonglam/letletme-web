'use client'

// Values mirror app/globals.css tokens — keep in sync.
// This boundary renders its own <html>, replacing the root layout, so
// globals.css/Tailwind are NOT loaded here: everything below is inline styles.
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
			<body
				style={{
					minHeight: '100svh',
					margin: 0,
					background: 'hsl(288 56% 8%)',
					color: 'hsl(48 33% 96%)',
					fontFamily: 'ui-sans-serif, system-ui, sans-serif',
					WebkitFontSmoothing: 'antialiased',
				}}
			>
				<main
					style={{
						margin: '0 auto',
						display: 'flex',
						minHeight: '100svh',
						maxWidth: '28rem',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '1.25rem',
						padding: '0 1.5rem',
						textAlign: 'center',
					}}
				>
					<p
						style={{
							margin: 0,
							fontSize: '0.875rem',
							fontWeight: 600,
							textTransform: 'uppercase',
							letterSpacing: '0.14em',
						}}
					>
						<span style={{ color: 'hsl(152 100% 50%)' }}>L</span>
						et
						<span style={{ color: 'hsl(152 100% 50%)' }}>L</span>
						et
						<span style={{ color: 'hsl(152 100% 50%)' }}>M</span>
						e
					</p>
					<h1
						style={{
							margin: 0,
							fontSize: '1.875rem',
							lineHeight: 1.2,
							fontWeight: 700,
							letterSpacing: '-0.025em',
							fontFamily: 'system-ui, sans-serif',
						}}
					>
						The app shell could not start / 应用无法启动
					</h1>
					<p style={{ margin: 0, color: 'hsl(48 33% 96% / 0.65)' }}>
						Try loading the application again. Your data has not been changed.<br />
						请重新加载应用，你的数据未受影响。
					</p>
					<button
						type="button"
						onClick={reset}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '0.5rem',
							minHeight: '44px',
							padding: '0 1rem',
							border: 'none',
							borderRadius: '0.5rem',
							background: 'hsl(152 100% 50%)',
							color: 'hsl(288 100% 11%)',
							fontSize: '0.875rem',
							fontWeight: 600,
							cursor: 'pointer',
						}}
					>
						<RotateCcw data-icon="inline-start" />
						Reload LetLetMe / 重新加载
					</button>
				</main>
			</body>
		</html>
	)
}
