import type { Metadata } from 'next'
import ResetPasswordClient from './ResetPasswordClient'

export const metadata: Metadata = {
	title: 'Choose a new password',
	description: 'Choose a new password for your LetLetMe account.',
	robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
	return <ResetPasswordClient />
}
