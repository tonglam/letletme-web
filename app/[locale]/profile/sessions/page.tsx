import SessionControls from '@/app/profile/sessions/SessionControls'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { getAuthorizationSession } from '@/lib/auth'
import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/profile/sessions',
		titleKey: 'sessionsTitle',
		descriptionKey: 'sessionsDescription',
		noIndex: true
	})
}

export default async function SessionsPage({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	const t = await getTranslations('Sessions')
	const profileT = await getTranslations('Profile')
	const session = await getAuthorizationSession(await headers())
	if (!session) {
		redirect(localizeHref('/auth/login?next=/profile/sessions', locale))
	}

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<Button asChild variant="ghost" className="-ml-3 mb-2">
					<Link href="/profile">
						<ArrowLeft className="mr-2 size-4" aria-hidden="true" />
						{t('backToProfile')}
					</Link>
				</Button>

				<StatsPageHeader
					eyebrow={profileT('security')}
					title={t('title')}
				/>
				<p className="-mt-4 mb-6 text-sm text-muted-foreground">
					{t('intro', { email: session.user.email })}
				</p>

				<SessionControls />
			</div>
		</PageShell>
	)
}
