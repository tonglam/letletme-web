import { Footer } from '@/components/footer/Footer'
import { Header } from '@/components/header/Header'
import { BottomNavBar } from '@/components/navbar/BottomNavBar'
import { ThemeProvider } from '@/components/provider/ThemeProvider'
import { ClerkProvider } from '@clerk/nextjs'
import { Metadata } from 'next'
import { Inter as FontSans } from 'next/font/google'
import './globals.css'

export const metadata: Metadata = {
	title: 'Let Let Me',
	description: 'Let Let Me Fpl Tools'
}

export const fontSans = FontSans({
	subsets: ['latin'],
	variable: '--font-sans'
})

export default function RootLayout({
	children
}: {
	children: React.ReactNode
}) {
	return (
		<ClerkProvider>
			<html lang="en">
				<head />
				<body>
					<ThemeProvider
						attribute="class"
						defaultTheme="light"
						enableSystem
						disableTransitionOnChange
					>
						<Header />
						{children}
						<Footer />
						<BottomNavBar />
					</ThemeProvider>
				</body>
			</html>
		</ClerkProvider>
	)
}
