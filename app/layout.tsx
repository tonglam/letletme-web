import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { executeQuery } from '@/lib/graphql-client'
import { GET_CURRENT_AND_NEXT_EVENTS, type EventsResponse } from '@/lib/graphql/queries'
import { EventProvider } from '@/lib/event-context'
import type { Metadata } from 'next'
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

export default async function RootLayout({
	children
}: {
	children: React.ReactNode
}) {
	let currentEventId: number | null = null
	let nextEventId: number | null = null
	let deadlineTime: string | null = null
	try {
		const data = await executeQuery<EventsResponse>(
			GET_CURRENT_AND_NEXT_EVENTS,
			undefined,
			{ cache: 'force-cache', next: { revalidate: 300 } },
		)
		currentEventId = data.current[0]?.id ?? null
		nextEventId = data.next[0]?.id ?? null
		deadlineTime = data.next[0]?.deadlineTime ?? null
	} catch (err) {
		console.error('[layout] Failed to fetch current event:', err)
	}

	return (
		<html
			lang="en"
			suppressHydrationWarning
		>
			<body className="font-sans antialiased">
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<EventProvider
						currentEventId={currentEventId}
						nextEventId={nextEventId}
						deadlineTime={deadlineTime}
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
