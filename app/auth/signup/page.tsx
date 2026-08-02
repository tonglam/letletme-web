import type { Metadata } from 'next'
import SignupClient from './SignupClient'

export const metadata: Metadata = {
	title: 'Create account',
	description: 'Create a LetLetMe FPL analytics account.',
	robots: { index: false, follow: false },
}

export default function SignupPage() {
	return <SignupClient />
}
