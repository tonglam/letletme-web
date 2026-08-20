'use client'

import { AuthCard, AuthShell } from '@/components/layout/AuthShell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useHydrated } from '@/hooks/use-hydrated'
import { Link, useRouter } from '@/i18n/navigation'
import { localizeHref, type AppLocale } from '@/i18n/routing'
import { getAuthErrorKey } from '@/lib/auth-error'
import { signIn } from '@/lib/auth-client'
import { absoluteAuthUrl, onboardingRedirectPath } from '@/lib/auth-redirects'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

type LoginReason = 'reauth' | null

export default function LoginClient({
	next,
	oauthError,
	reason,
	deskAgent
}: {
	next: string
	oauthError: boolean
	reason: LoginReason
	deskAgent: boolean
}) {
	const router = useRouter()
	const locale = useLocale() as AppLocale
	const t = useTranslations('Auth')
	const hydrated = useHydrated()
	const destination =
		reason === 'reauth' ? next : onboardingRedirectPath(next)

	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(() =>
		oauthError ? t('errors.socialLoginFailed') : null
	)

	const handleEmailLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		setPending(true)
		setError(null)
		try {
			const { error: err } = await signIn.email({ email, password })
			if (err) {
				setError(t(`errors.${getAuthErrorKey(err, 'loginFailed')}`))
				return
			}
			router.push(destination)
			// The navbar is resolved in the persistent server layout. Refresh the
			// destination tree so it observes the new session cookie immediately.
			router.refresh()
		} catch (cause) {
			setError(
				t(
					`errors.${getAuthErrorKey(
						cause instanceof Error ? { message: cause.message } : null,
						'loginFailed'
					)}`
				)
			)
		} finally {
			setPending(false)
		}
	}

	const handleSocial = async (provider: 'google') => {
		setPending(true)
		setError(null)
		try {
			const callbackUrl = absoluteAuthUrl(
				localizeHref(destination, locale),
				window.location.origin
			)
			const errorReason = reason === 'reauth' ? '&reason=reauth' : ''
			const { error: err } = await signIn.social({
				provider,
				callbackURL: callbackUrl,
				newUserCallbackURL: callbackUrl,
				errorCallbackURL: absoluteAuthUrl(
					localizeHref(
						`/auth/login?oauthError=1&next=${encodeURIComponent(next)}${errorReason}${deskAgent ? '&client=desk-agent' : ''}`,
						locale
					),
					window.location.origin
				)
			})
			if (err)
				setError(t(`errors.${getAuthErrorKey(err, 'socialLoginFailed')}`))
		} catch (err) {
			setError(
				t(
					`errors.${getAuthErrorKey(
						err instanceof Error ? { message: err.message } : null,
						'socialLoginFailed'
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
				<div className="mb-6 text-center">
					<h2 className="font-display text-2xl font-bold tracking-tight">
						{reason === 'reauth' ? t('reauthTitle') : t('signIn')}
					</h2>
					<p className="text-sm text-muted-foreground">
						{reason === 'reauth'
							? t('reauthDescription')
							: t('chooseMethod')}
					</p>
				</div>

				{deskAgent && (
					<Alert className="mb-4">
						<AlertDescription>
							<strong className="mb-1 block">{t('deskAgentDisclosureTitle')}</strong>
							{t('deskAgentDisclosure')}
						</AlertDescription>
					</Alert>
				)}

				{error && (
					<Alert
						variant="destructive"
						className="mb-4"
					>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<form
					onSubmit={handleEmailLogin}
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
					<div className="space-y-1">
						<div className="flex items-center justify-between">
							<Label htmlFor="password">{t('password')}</Label>
							<Link
								href="/auth/forgot-password"
								prefetch={false}
								className="text-xs text-primary-ink underline underline-offset-4 hover:no-underline"
							>
								{t('forgotPassword')}
							</Link>
						</div>
						<Input
							id="password"
							type="password"
							autoComplete="current-password"
							required
							disabled={!hydrated || pending}
							value={password}
							onChange={e => setPassword(e.target.value)}
						/>
					</div>
					<Button
						type="submit"
						className="w-full"
						disabled={!hydrated || pending}
					>
						{pending ? t('signingIn') : t('signIn')}
					</Button>
				</form>

				<div className="relative my-6">
					<Separator />
					<span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
						{t('or')}
					</span>
				</div>

				<Button
					variant="outline"
					className="w-full"
					disabled={!hydrated || pending}
					onClick={() => handleSocial('google')}
				>
					<svg
						className="mr-2 h-4 w-4"
						viewBox="0 0 24 24"
					>
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
					{t('continueGoogle')}
				</Button>

				<Separator className="my-6" />

				<p className="text-center text-sm text-muted-foreground">
					{t('noAccount')}{' '}
					<Link
						href="/auth/signup"
						prefetch={false}
						className="text-primary-ink underline underline-offset-4 hover:no-underline"
					>
						{t('signUp')}
					</Link>
				</p>
			</AuthCard>
		</AuthShell>
	)
}
