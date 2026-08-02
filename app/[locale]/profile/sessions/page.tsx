import SessionControls from '@/app/profile/sessions/SessionControls'
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
	const session = await getAuthorizationSession(await headers())
	if (!session) {
		redirect(localizeHref('/auth/login?next=/profile/sessions', locale))
	}

	return (
		<div className="container mx-auto max-w-3xl px-4 py-8">
			<Button
				asChild
				variant="ghost"
				className="mb-4 -ml-3"
			>
				<Link href="/profile">
					<ArrowLeft className="mr-2 h-4 w-4" />
					{t('backToProfile')}
				</Link>
			</Button>

			<div className="mb-6">
				<h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					{t('intro', { email: session.user.email })}
				</p>
			</div>

			<SessionControls />
		</div>
	)
}
