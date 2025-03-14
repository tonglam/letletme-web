import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { AuthProvider } from '@/lib/auth-context'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
	subsets: ['latin'],
	display: 'swap',
	preload: false,
	adjustFontFallback: false
})

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
			<body className={inter.className}>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<AuthProvider>
						<Navbar />
						{children}
						<Footer />
					</AuthProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}
