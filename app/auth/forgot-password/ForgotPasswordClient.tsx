'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHydrated } from '@/hooks/use-hydrated'
import { Link } from '@/i18n/navigation'
import { localizeHref, type AppLocale } from '@/i18n/routing'
import { authClient } from '@/lib/auth-client'
import { getAuthErrorKey } from '@/lib/auth-error'
import { absoluteAuthUrl } from '@/lib/auth-redirects'
import { Gamepad } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

export default function ForgotPasswordClient() {
	const hydrated = useHydrated()
	const locale = useLocale() as AppLocale
	const t = useTranslations('Auth')
	const [email, setEmail] = useState('')
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [sent, setSent] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setPending(true)
		try {
			const { error: err } = await authClient.requestPasswordReset({
				email,
				redirectTo: absoluteAuthUrl(
					localizeHref('/auth/reset-password', locale),
					window.location.origin
				)
			})
			if (err) {
				setError(t(`errors.${getAuthErrorKey(err, 'resetEmailFailed')}`))
				return
			}
			setSent(true)
		} catch (cause) {
			setError(
				t(
					`errors.${getAuthErrorKey(
						cause instanceof Error ? { message: cause.message } : null,
						'resetEmailFailed'
					)}`
				)
			)
		} finally {
			setPending(false)
		}
	}

	return (
		<div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-6 flex items-center gap-2">
				<Gamepad className="h-8 w-8 text-primary" />
				<h1 className="text-2xl font-bold">LetLetMe</h1>
			</div>

			<Card className="w-full max-w-md p-6">
				{sent ? (
					<div className="text-center space-y-2">
						<h2 className="text-xl font-bold">{t('checkEmail')}</h2>
						<p className="text-sm text-muted-foreground">
							{t('forgotSent', { email })}
						</p>
						<Link
							href="/auth/login"
							className="mt-4 block text-sm text-primary underline underline-offset-4 hover:no-underline"
						>
							{t('backToLogin')}
						</Link>
					</div>
				) : (
					<>
						<div className="mb-6 text-center">
							<h2 className="text-2xl font-bold tracking-tight">
								{t('resetPassword')}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t('resetInstructions')}
							</p>
						</div>

						{error && (
							<Alert
								variant="destructive"
								className="mb-4"
							>
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<form
							onSubmit={handleSubmit}
							className="space-y-4"
							aria-busy={!hydrated || pending}
						>
							<div className="space-y-1">
								<Label htmlFor="email">{t('email')}</Label>
								<Input
									id="email"
									type="email"
									autoComplete="email"
									required
									disabled={!hydrated || pending}
									value={email}
									onChange={e => setEmail(e.target.value)}
								/>
							</div>
							<Button
								type="submit"
								className="w-full"
								disabled={!hydrated || pending}
							>
								{pending ? t('sending') : t('sendResetLink')}
							</Button>
						</form>

						<p className="text-center text-sm text-muted-foreground mt-4">
							<Link
								href="/auth/login"
								className="text-primary underline underline-offset-4 hover:no-underline"
							>
								{t('backToLogin')}
							</Link>
						</p>
					</>
				)}
			</Card>
		</div>
	)
}
