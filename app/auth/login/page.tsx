'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/auth-context'
import { Gamepad, Github, Twitter } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
	const { login, isLoading, error } = useAuth()
	const router = useRouter()
	const [loginError, setLoginError] = useState<string | null>(null)

	const handleLogin = async (provider: 'github' | 'twitter') => {
		setLoginError(null)

		try {
			await login(provider)
			router.push('/live/points')
		} catch (error) {
			console.error('Login failed:', error)
			setLoginError(error instanceof Error ? error.message : 'Login failed')
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
					<h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
					<p className="text-sm text-muted-foreground">
						Choose a login method to continue
					</p>
				</div>

				<div className="space-y-4">
					{(loginError || error) && (
						<Alert
							variant="destructive"
							className="bg-red-50 text-red-800 border-red-200"
						>
							<AlertDescription>{loginError || error}</AlertDescription>
						</Alert>
					)}

					<Button
						onClick={() => handleLogin('github')}
						className="w-full flex items-center gap-2"
						disabled={isLoading}
					>
						<Github className="h-4 w-4" />
						Continue with GitHub
					</Button>

					<Button
						onClick={() => handleLogin('twitter')}
						className="w-full flex items-center gap-2"
						disabled={isLoading}
					>
						<Twitter className="h-4 w-4" />
						Continue with Twitter
					</Button>
				</div>

				<div className="mt-6">
					<Separator className="my-4" />
					<div className="text-center text-sm">
						<p>
							Don't have an account?{' '}
							<Link
								href="/auth/register"
								className="text-primary hover:underline"
							>
								Register
							</Link>
						</p>
					</div>
				</div>
			</Card>
		</div>
	)
}
