'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { Gamepad } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState('')
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [sent, setSent] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setPending(true)
		const { error: err } = await authClient.requestPasswordReset({
			email,
			redirectTo: '/auth/reset-password',
		})
		setPending(false)
		if (err) {
			setError(err.message ?? 'Failed to send reset email')
			return
		}
		setSent(true)
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-6 flex items-center gap-2">
				<Gamepad className="h-8 w-8 text-primary" />
				<h1 className="text-2xl font-bold">LetLetMe</h1>
			</div>

			<Card className="w-full max-w-md p-6">
				{sent ? (
					<div className="text-center space-y-2">
						<h2 className="text-xl font-bold">Check your email</h2>
						<p className="text-sm text-muted-foreground">
							If <strong>{email}</strong> is registered, a password reset link
							has been sent. Check your inbox.
						</p>
						<Link
							href="/auth/login"
							className="text-sm text-primary hover:underline block mt-4"
						>
							Back to login
						</Link>
					</div>
				) : (
					<>
						<div className="mb-6 text-center">
							<h2 className="text-2xl font-bold tracking-tight">
								Reset password
							</h2>
							<p className="text-sm text-muted-foreground">
								Enter your email and we&apos;ll send a reset link
							</p>
						</div>

						{error && (
							<Alert
								variant="destructive"
								className="mb-4 bg-red-50 text-red-800 border-red-200"
							>
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-1">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									autoComplete="email"
									required
									value={email}
									onChange={e => setEmail(e.target.value)}
								/>
							</div>
							<Button type="submit" className="w-full" disabled={pending}>
								{pending ? 'Sending…' : 'Send reset link'}
							</Button>
						</form>

						<p className="text-center text-sm text-muted-foreground mt-4">
							<Link href="/auth/login" className="text-primary hover:underline">
								Back to login
							</Link>
						</p>
					</>
				)}
			</Card>
		</div>
	)
}
