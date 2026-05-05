import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { getCurrentAndNextEvents } from '@/lib/events'
import { EventProvider } from '@/lib/event-context'
import { getCurrentSeasonKey } from '@/lib/season'
import type { Metadata } from 'next'
import Script from 'next/script'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
	title: 'LetLetMe - Fantasy Premier League Tool',
	description:
		'The ultimate Fantasy Premier League companion for tracking statistics, tournaments, and live points',
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

export default async function RootLayout({
	children
}: {
	children: React.ReactNode
}) {
	const data = await getCurrentAndNextEvents()
	const currentEventId = data?.current[0]?.id ?? null
	const nextEventId = data?.next[0]?.id ?? null
	const deadlineTime = data?.next[0]?.deadlineTime ?? null
	const seasonKey = getCurrentSeasonKey()

	return (
		<html
			lang="en"
			suppressHydrationWarning
		>
			<body className="font-sans antialiased">
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
					<EventProvider
						currentEventId={currentEventId}
						nextEventId={nextEventId}
						deadlineTime={deadlineTime}
						seasonKey={seasonKey}
						entryId={null}
					>
						<Navbar />
						{children}
						<Footer />
						<Toaster richColors position="top-center" />
					</EventProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}
