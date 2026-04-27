'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { Gamepad } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function ResetPasswordForm() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const token = searchParams.get('token') ?? ''

	const [password, setPassword] = useState('')
	const [confirm, setConfirm] = useState('')
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		if (password !== confirm) {
			setError('Passwords do not match')
			return
		}
		if (password.length < 10) {
			setError('Password must be at least 10 characters')
			return
		}
		setPending(true)
		const { error: err } = await authClient.resetPassword({
			newPassword: password,
			token,
		})
		setPending(false)
		if (err) {
			setError(err.message ?? 'Reset failed')
			return
		}
		router.push('/auth/login')
	}

	if (!token) {
		return (
			<Card className="w-full max-w-md p-6 text-center">
				<p className="text-sm text-muted-foreground">
					Invalid or expired reset link.{' '}
					<Link href="/auth/forgot-password" className="text-primary hover:underline">
						Request a new one
					</Link>
				</p>
			</Card>
		)
	}

	return (
		<Card className="w-full max-w-md p-6">
			<div className="mb-6 text-center">
				<h2 className="text-2xl font-bold tracking-tight">New password</h2>
				<p className="text-sm text-muted-foreground">
					Choose a strong password (min 10 characters)
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
					<Label htmlFor="password">Password</Label>
					<Input
						id="password"
						type="password"
						autoComplete="new-password"
						required
						minLength={10}
						value={password}
						onChange={e => setPassword(e.target.value)}
					/>
				</div>
				<div className="space-y-1">
					<Label htmlFor="confirm">Confirm password</Label>
					<Input
						id="confirm"
						type="password"
						autoComplete="new-password"
						required
						value={confirm}
						onChange={e => setConfirm(e.target.value)}
					/>
				</div>
				<Button type="submit" className="w-full" disabled={pending}>
					{pending ? 'Saving…' : 'Set new password'}
				</Button>
			</form>
		</Card>
	)
}

export default function ResetPasswordPage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-6 flex items-center gap-2">
				<Gamepad className="h-8 w-8 text-primary" />
				<h1 className="text-2xl font-bold">LetLetMe</h1>
			</div>
			<Suspense>
				<ResetPasswordForm />
			</Suspense>
		</div>
	)
}
