import type { Metadata } from 'next'
import LoginClient from './LoginClient'

export const metadata: Metadata = {
	title: 'Sign in',
	description: 'Sign in to your LetLetMe FPL analytics account.',
	robots: { index: false, follow: false },
}

export default function LoginPage() {
	return <LoginClient />
}
