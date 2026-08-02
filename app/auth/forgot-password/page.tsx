import type { Metadata } from 'next'
import ForgotPasswordClient from './ForgotPasswordClient'

export const metadata: Metadata = {
	title: 'Reset password',
	description: 'Request a password reset for your LetLetMe account.',
	robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
	return <ForgotPasswordClient />
}
