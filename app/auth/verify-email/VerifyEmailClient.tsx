'use client'

import { AuthCard, AuthShell } from '@/components/layout/AuthShell'
import { Link, useRouter } from '@/i18n/navigation'
import { getSafeInternalHref } from '@/i18n/routing'
import { onboardingRedirectPath } from '@/lib/auth-redirects'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'

function VerifyEmailContent() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const t = useTranslations('Auth')
	const error = searchParams.get('error')
	const next = getSafeInternalHref(
		searchParams.get('next') ?? onboardingRedirectPath('/')
	)

	useEffect(() => {
		if (!error) router.replace(next)
	}, [error, next, router])

	if (error) {
		return (
			<AuthCard className="space-y-2 text-center">
				<h2 className="text-xl font-bold text-destructive">
					{t('verificationFailed')}
				</h2>
				<p className="text-sm text-muted-foreground">
					{t('verificationFailedDescription')}
				</p>
				<Link
					href="/auth/signup"
					className="mt-4 block text-sm text-primary-ink underline underline-offset-4 hover:no-underline"
				>
					{t('signUpAgain')}
				</Link>
			</AuthCard>
		)
	}

	return (
		<AuthCard className="space-y-2 text-center">
			<h2 className="text-xl font-bold">{t('emailVerified')}</h2>
			<p className="text-sm text-muted-foreground">
				{t('emailVerifiedDescription')}
			</p>
			<Link
				href="/auth/login"
				className="mt-4 block text-sm text-primary-ink underline underline-offset-4 hover:no-underline"
			>
				{t('signIn')}
			</Link>
		</AuthCard>
	)
}

export default function VerifyEmailClient() {
	return (
		<AuthShell>
			<Suspense>
				<VerifyEmailContent />
			</Suspense>
		</AuthShell>
	)
}
