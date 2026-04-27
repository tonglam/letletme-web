'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { signIn } from '@/lib/auth-client'
import { Gamepad } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function LoginForm() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const raw = searchParams.get('next') ?? '/'
	const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'

	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleEmailLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		setPending(true)
		setError(null)
		const { error: err } = await signIn.email({ email, password })
		setPending(false)
		if (err) {
			setError(err.message ?? 'Login failed')
			return
		}
		router.push(next)
	}

	const handleSocial = async (provider: 'google') => {
		setError(null)
		try {
			await signIn.social({ provider, callbackURL: next })
		} catch (err) {
			setError(err instanceof Error ? err.message : `${provider} sign-in failed`)
		}
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-6 flex items-center gap-2">
				<Gamepad className="h-8 w-8 text-primary" />
				<h1 className="text-2xl font-bold">LetLetMe</h1>
			</div>

			<Card className="w-full max-w-md p-6">
				<div className="mb-6 text-center">
					<h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
					<p className="text-sm text-muted-foreground">
						Choose a method to continue
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

				<form onSubmit={handleEmailLogin} className="space-y-4">
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
						<div className="flex items-center justify-between">
							<Label htmlFor="password">Password</Label>
							<Link
								href="/auth/forgot-password"
								className="text-xs text-primary hover:underline"
							>
								Forgot password?
							</Link>
						</div>
						<Input
							id="password"
							type="password"
							autoComplete="current-password"
							required
							value={password}
							onChange={e => setPassword(e.target.value)}
						/>
					</div>
					<Button type="submit" className="w-full" disabled={pending}>
						{pending ? 'Signing in…' : 'Sign in'}
					</Button>
				</form>

				<div className="relative my-6">
					<Separator />
					<span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
						or
					</span>
				</div>

				<Button
					variant="outline"
					className="w-full"
					onClick={() => handleSocial('google')}
				>
					<svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
						<path
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							fill="#4285F4"
						/>
						<path
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							fill="#34A853"
						/>
						<path
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							fill="#FBBC05"
						/>
						<path
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							fill="#EA4335"
						/>
					</svg>
					Continue with Google
				</Button>

				<Separator className="my-6" />

				<p className="text-center text-sm text-muted-foreground">
					Don&apos;t have an account?{' '}
					<Link href="/auth/signup" className="text-primary hover:underline">
						Sign up
					</Link>
				</p>
			</Card>
		</div>
	)
}

export default function LoginPage() {
	return (
		<Suspense>
			<LoginForm />
		</Suspense>
	)
}
