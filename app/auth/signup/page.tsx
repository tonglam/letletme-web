'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUp } from '@/lib/auth-client'
import { Gamepad } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SignupPage() {
	const router = useRouter()
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirm, setConfirm] = useState('')
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [sent, setSent] = useState(false)

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
		const { error: err } = await signUp.email({ name, email, password })
		setPending(false)
		if (err) {
			setError(err.message ?? 'Sign up failed')
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
							A verification link has been sent to <strong>{email}</strong>.
							Click it to activate your account.
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
								Create account
							</h2>
							<p className="text-sm text-muted-foreground">
								Sign up with email and password
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
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									type="text"
									autoComplete="name"
									required
									value={name}
									onChange={e => setName(e.target.value)}
								/>
							</div>
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
								<p className="text-xs text-muted-foreground">
									Minimum 10 characters
								</p>
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
								{pending ? 'Creating account…' : 'Create account'}
							</Button>
						</form>

						<p className="text-center text-sm text-muted-foreground mt-4">
							Already have an account?{' '}
							<Link href="/auth/login" className="text-primary hover:underline">
								Sign in
							</Link>
						</p>
					</>
				)}
			</Card>
		</div>
	)
}
