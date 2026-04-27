import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
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

export default function RootLayout({
	children
}: {
	children: React.ReactNode
}) {
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
						<Navbar />
					{children}
					<Footer />
					<Toaster richColors position="top-center" />
				</ThemeProvider>
			</body>
		</html>
	)
}
