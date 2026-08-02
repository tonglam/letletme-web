import type { Metadata } from 'next'
import VerifyEmailClient from './VerifyEmailClient'

export const metadata: Metadata = {
	title: 'Verify email',
	description: 'Confirm the email address for your LetLetMe account.',
	robots: { index: false, follow: false },
}

export default function VerifyEmailPage() {
	return <VerifyEmailClient />
}
