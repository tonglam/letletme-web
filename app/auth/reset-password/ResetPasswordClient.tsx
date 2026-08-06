'use client'

import { LogoMark, LogoWordmark } from '@/components/layout/Logo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHydrated } from '@/hooks/use-hydrated'
import { Link, useRouter } from '@/i18n/navigation'
import { authClient } from '@/lib/auth-client'
import { getAuthErrorKey } from '@/lib/auth-error'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function ResetPasswordForm() {
	const router = useRouter()
	const t = useTranslations('Auth')
	const hydrated = useHydrated()
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
			setError(t('errors.passwordMismatch'))
			return
		}
		if (password.length < 10) {
			setError(t('errors.passwordTooShort'))
			return
		}
		setPending(true)
		const { error: err } = await authClient.resetPassword({
			newPassword: password,
			token,
		})
		setPending(false)
		if (err) {
			setError(t(`errors.${getAuthErrorKey(err, 'resetFailed')}`))
			return
		}
		router.push('/auth/login')
	}

	if (!token) {
		return (
			<Card className="w-full max-w-md p-6 text-center">
				<p className="text-sm text-muted-foreground">
					{t('invalidResetLink')}{' '}
					<Link href="/auth/forgot-password" className="text-primary-ink underline underline-offset-4 hover:no-underline">
						{t('requestNewLink')}
					</Link>
				</p>
			</Card>
		)
	}

	return (
		<Card className="w-full max-w-md p-6">
			<div className="mb-6 text-center">
				<h2 className="text-2xl font-bold tracking-tight">{t('newPassword')}</h2>
				<p className="text-sm text-muted-foreground">
					{t('strongPassword')}
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

			<form onSubmit={handleSubmit} className="space-y-4" aria-busy={!hydrated || pending}>
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
				<Button type="submit" className="w-full" disabled={!hydrated || pending}>
					{pending ? t('saving') : t('setNewPassword')}
				</Button>
			</form>
		</Card>
	)
}

export default function ResetPasswordClient() {
	return (
		<div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-6 flex items-center gap-2">
				<LogoMark className="size-10 text-plum dark:text-electric" />
				<h1>
					<LogoWordmark className="text-2xl" />
				</h1>
			</div>
			<Suspense>
				<ResetPasswordForm />
			</Suspense>
		</div>
	)
}
