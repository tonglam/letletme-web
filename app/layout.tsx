import { Footer } from '@/components/footer/Footer'
import { Header } from '@/components/header/Header'
import { ThemeProvider } from '@/components/themeProvider/ThemeProvider'
import { Inter as FontSans } from 'next/font/google'
import './globals.css'

export const metadata = {
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
				</ThemeProvider>
			</body>
		</html>
	)
}
