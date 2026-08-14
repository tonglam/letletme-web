'use client'

import { AuthCard, AuthShell } from '@/components/layout/AuthShell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHydrated } from '@/hooks/use-hydrated'
import { Link } from '@/i18n/navigation'
import { localizeHref, type AppLocale } from '@/i18n/routing'
import { signUp } from '@/lib/auth-client'
import { getAuthErrorKey } from '@/lib/auth-error'
import {
	absoluteAuthUrl,
	onboardingRedirectPath,
	verificationCallbackPath
} from '@/lib/auth-redirects'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

export default function SignupClient() {
	const hydrated = useHydrated()
	const t = useTranslations('Auth')
	const locale = useLocale() as AppLocale
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
			setError(t('errors.passwordMismatch'))
			return
		}
		if (password.length < 10) {
			setError(t('errors.passwordTooShort'))
			return
		}
		setPending(true)
		try {
			const onboardingPath = onboardingRedirectPath('/')
			const { error: err } = await signUp.email({
				name,
				email,
				password,
				callbackURL: absoluteAuthUrl(
					localizeHref(
						verificationCallbackPath(onboardingPath),
						locale
					),
					window.location.origin
				)
			})
			if (err) {
				setError(t(`errors.${getAuthErrorKey(err, 'signupFailed')}`))
				return
			}
			setSent(true)
		} catch (cause) {
			setError(
				t(
					`errors.${getAuthErrorKey(
						cause instanceof Error ? { message: cause.message } : null,
						'signupFailed'
					)}`
				)
			)
		} finally {
			setPending(false)
		}
	}

	return (
		<AuthShell>
			<AuthCard>
				{sent ? (
					<div className="text-center space-y-2">
						<h2 className="text-xl font-bold">{t('checkEmail')}</h2>
						<p className="text-sm text-muted-foreground">
							{t('verificationSent', { email })}
						</p>
						<Link
							href="/auth/login"
							className="mt-4 block text-sm text-primary-ink underline underline-offset-4 hover:no-underline"
						>
							{t('backToLogin')}
						</Link>
					</div>
				) : (
					<>
						<div className="mb-6 text-center">
							<h2 className="font-display text-2xl font-bold tracking-tight">
								{t('createAccount')}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t('signupInstructions')}
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
								<Label htmlFor="name">{t('name')}</Label>
								<Input
									id="name"
									type="text"
									autoComplete="name"
									required
									disabled={!hydrated || pending}
									value={name}
									onChange={e => setName(e.target.value)}
								/>
							</div>
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
							<div className="space-y-1">
								<Label htmlFor="password">{t('password')}</Label>
								<Input
									id="password"
									type="password"
									autoComplete="new-password"
									required
									disabled={!hydrated || pending}
									minLength={10}
									value={password}
									onChange={e => setPassword(e.target.value)}
								/>
								<p className="text-xs text-muted-foreground">
									{t('minimumPassword')}
								</p>
							</div>
							<div className="space-y-1">
								<Label htmlFor="confirm">{t('confirmPassword')}</Label>
								<Input
									id="confirm"
									type="password"
									autoComplete="new-password"
									required
									disabled={!hydrated || pending}
									value={confirm}
									onChange={e => setConfirm(e.target.value)}
								/>
							</div>
							<Button
								type="submit"
								className="w-full"
								disabled={!hydrated || pending}
							>
								{pending ? t('creatingAccount') : t('createAccount')}
							</Button>
						</form>

						<p className="text-center text-sm text-muted-foreground mt-4">
							{t('alreadyAccount')}{' '}
							<Link
								href="/auth/login"
								className="text-primary-ink underline underline-offset-4 hover:no-underline"
							>
								{t('signIn')}
							</Link>
						</p>
					</>
				)}
			</AuthCard>
		</AuthShell>
	)
}
