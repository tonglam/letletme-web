import { Suspense } from 'react'
import { localizePathname, type AppLocale } from '@/i18n/routing'
import { getLocale, getTranslations } from 'next-intl/server'
import { getCurrentSession, hasSessionCookieHint } from '@/lib/session'
import { GuestNavigationActions, GuestAccountActions } from './GuestNavigationActions'
import { LogoMark, LogoWordmark } from './Logo'
import { NavigationActions } from './NavigationActions'
import { SignOutForm } from './SignOutForm'

export async function Navbar() {
	const [t, hasSessionCookie, locale] = await Promise.all([
		getTranslations('Navigation'),
		hasSessionCookieHint(),
		getLocale()
	])
	const homeHref = localizePathname('/', locale as AppLocale)
	const displaySession = hasSessionCookie
		? getCurrentSession().catch(error => {
				console.warn('[navbar-session] display session unavailable', {
					error: error instanceof Error ? error.name : 'UnknownError'
				})
				return null
			})
		: Promise.resolve(null)

	return (
		<nav
			aria-label={t('primary')}
			className="fascia texture-grain sticky top-0 z-50 border-b-2 border-electric"
		>
			<div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
				<a
					href={homeHref}
					className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-fascia"
				>
					<LogoMark className="text-electric" />
					<LogoWordmark />
				</a>

				<div className="flex items-center gap-1.5">
					<GuestNavigationActions
						desktopAccount={hasSessionCookie ? (
							<Suspense fallback={<AccountPlaceholder homeHref={homeHref} />}>
								<AccountSlot session={displaySession} />
							</Suspense>
						) : undefined}
						mobileAccount={hasSessionCookie ? (
							<Suspense fallback={<AccountPlaceholder homeHref={homeHref} />}>
								<AccountSlot session={displaySession} mobile />
							</Suspense>
						) : undefined}
					/>
				</div>
			</div>
		</nav>
	)
}

async function AccountPlaceholder({ homeHref }: { homeHref: string }) {
	const t = await getTranslations('Navigation')
	return <>
		<span data-account-placeholder className="block h-9 w-36 animate-pulse rounded-md bg-fascia-foreground/10" aria-hidden="true" />
		<noscript>
			<style>{'[data-account-placeholder]{display:none}'}</style>
			<SignOutForm
				label={t('signOut')}
				pendingLabel={t('signingOut')}
				errorLabel={t('signOutFailed')}
				redirectHref={homeHref}
			/>
		</noscript>
	</>
}

async function AccountSlot({ session, mobile = false }: {
	session: ReturnType<typeof getCurrentSession>
	mobile?: boolean
}) {
	const resolved = await session
	return resolved?.user
		? <NavigationActions user={resolved.user} mobile={mobile} />
		: <GuestAccountActions mobile={mobile} />
}
