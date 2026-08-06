'use client'

import { LogoMark, LogoWordmark } from '@/components/layout/Logo'
import { Card } from '@/components/ui/card'
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
			<Card className="w-full max-w-md p-6 text-center space-y-2">
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
			</Card>
		)
	}

	return (
		<Card className="w-full max-w-md p-6 text-center space-y-2">
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
		</Card>
	)
}

export default function VerifyEmailClient() {
	return (
		<div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-6 flex items-center gap-2">
				<LogoMark className="size-10 text-plum dark:text-electric" />
				<h1>
					<LogoWordmark className="text-2xl" />
				</h1>
			</div>
			<Suspense>
				<VerifyEmailContent />
			</Suspense>
		</div>
	)
}
