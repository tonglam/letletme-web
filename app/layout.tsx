import './globals.css'
import { Inter as FontSans } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

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
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
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
