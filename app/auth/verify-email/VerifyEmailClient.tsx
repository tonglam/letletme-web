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
					className="mt-4 block text-sm text-primary underline underline-offset-4 hover:no-underline"
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
				className="mt-4 block text-sm text-primary underline underline-offset-4 hover:no-underline"
			>
				Sign in
			</Link>
		</Card>
	)
}

export default function VerifyEmailClient() {
	return (
		<div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center bg-muted/30 p-4">
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
