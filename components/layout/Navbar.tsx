import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { getCurrentSession, hasSessionCookieHint } from '@/lib/session'
import { GuestNavigationActions } from './GuestNavigationActions'
import { LogoMark, LogoWordmark } from './Logo'
import { NavigationActions } from './NavigationActions'

export async function Navbar() {
	const [t, hasSessionCookie] = await Promise.all([
		getTranslations('Navigation'),
		hasSessionCookieHint()
	])
	const displaySession = hasSessionCookie
		? await getCurrentSession().catch(error => {
				console.warn('[navbar-session] display session unavailable', {
					error: error instanceof Error ? error.name : 'UnknownError'
				})
				return null
			})
		: null

	return (
		<nav
			aria-label={t('primary')}
			className="fascia texture-grain sticky top-0 z-50 border-b-2 border-electric"
		>
			<div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
				<Link
					href="/"
					prefetch={false}
					className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-fascia"
				>
					<LogoMark className="text-electric" />
					<LogoWordmark />
				</Link>

				<div className="flex items-center gap-1.5">
					{displaySession?.user ? (
						<NavigationActions user={displaySession.user} />
					) : (
						<GuestNavigationActions />
					)}
				</div>
			</div>
		</nav>
	)
}
