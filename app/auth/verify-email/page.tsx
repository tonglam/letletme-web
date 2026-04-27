'use client'

import { Card } from '@/components/ui/card'
import { Gamepad } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function VerifyEmailContent() {
	const searchParams = useSearchParams()
	const error = searchParams.get('error')

	if (error) {
		return (
			<Card className="w-full max-w-md p-6 text-center space-y-2">
				<h2 className="text-xl font-bold text-destructive">
					Verification failed
				</h2>
				<p className="text-sm text-muted-foreground">
					The link may have expired or already been used.
				</p>
				<Link
					href="/auth/signup"
					className="text-sm text-primary hover:underline block mt-4"
				>
					Sign up again
				</Link>
			</Card>
		)
	}

	return (
		<Card className="w-full max-w-md p-6 text-center space-y-2">
			<h2 className="text-xl font-bold">Email verified</h2>
			<p className="text-sm text-muted-foreground">
				Your email has been confirmed. You can now sign in.
			</p>
			<Link
				href="/auth/login"
				className="text-sm text-primary hover:underline block mt-4"
			>
				Sign in
			</Link>
		</Card>
	)
}

export default function VerifyEmailPage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-6 flex items-center gap-2">
				<Gamepad className="h-8 w-8 text-primary" />
				<h1 className="text-2xl font-bold">LetLetMe</h1>
			</div>
			<Suspense>
				<VerifyEmailContent />
			</Suspense>
		</div>
	)
}
