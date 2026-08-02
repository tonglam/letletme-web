import { AppToaster } from '@/components/feedback/AppToaster'
import { WebVitalsReporter } from '@/components/analytics/WebVitalsReporter'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Metadata } from 'next'
import { Barlow } from 'next/font/google'
import Script from 'next/script'
import { Suspense } from 'react'
import './globals.css'

const barlow = Barlow({
	subsets: ['latin'],
	weight: '700',
	variable: '--font-barlow',
	display: 'swap',
})

export const metadata: Metadata = {
	applicationName: 'LetLetMe',
	title: {
		default: 'LetLetMe — Fantasy Premier League analytics',
		template: '%s | LetLetMe',
	},
	description:
		'Fantasy Premier League live points, player analytics, and tournament tools in one focused workspace.',
	icons: {
		icon: [{ url: '/favicon.ico' }]
	}
}

const themeBootstrapScript = `
(() => {
	try {
		const storedTheme = window.localStorage.getItem('theme');
		const theme = storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system'
			? storedTheme
			: 'system';
		const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		const resolvedTheme = theme === 'system' ? systemTheme : theme;
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(resolvedTheme);
		document.documentElement.style.colorScheme = resolvedTheme;
	} catch {}
})();
`

export default function RootLayout({
	children
}: {
	children: React.ReactNode
}) {
	return (
		<html
			lang="en"
			className={barlow.variable}
			data-scroll-behavior="smooth"
			suppressHydrationWarning
		>
			<body className="min-h-svh bg-background font-sans text-foreground antialiased">
				<Script
					id="theme-bootstrap"
					strategy="beforeInteractive"
					dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
				/>
				<ThemeProvider
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<TooltipProvider>
						<a
							href="#main-content"
							className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
						>
							Skip to main content
						</a>
						<Navbar />
						<main id="main-content" tabIndex={-1}>
							{children}
						</main>
						<Footer />
						<Suspense>
							<AppToaster />
							<WebVitalsReporter />
						</Suspense>
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}
