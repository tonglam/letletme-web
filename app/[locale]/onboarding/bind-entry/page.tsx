import { Card } from '@/components/ui/card'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { getAuth } from '@/lib/auth'
import { Gamepad, Hash } from 'lucide-react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import BindEntryForm from '@/app/onboarding/bind-entry/BindEntryForm'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/onboarding/bind-entry',
		titleKey: 'bindEntryTitle',
		descriptionKey: 'bindEntryDescription',
		noIndex: true,
	})
}

export default async function BindEntryPage({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	const t = await getTranslations('Onboarding')
	const session = await getAuth().api.getSession({ headers: await headers() })

	if (!session) {
		redirect(localizeHref('/auth/login?next=/onboarding/bind-entry', locale))
	}

	// Already bound — skip onboarding
	if (session.user.fplEntryVerifiedAt) {
		redirect(localizeHref('/', locale))
	}

	return (
		<div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-6 flex items-center gap-2">
				<Gamepad className="h-8 w-8 text-primary" />
				<h1 className="text-2xl font-bold">LetLetMe</h1>
			</div>

			<Card className="w-full max-w-md p-6">
				<div className="mb-6 text-center">
					<div className="flex justify-center mb-3">
						<Hash className="h-10 w-10 text-primary" />
					</div>
					<h2 className="text-2xl font-bold tracking-tight">
						{t('title')}
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						{t('description')}
					</p>
				</div>

				<div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground mb-6">
					<p className="font-medium mb-1">{t('findEntryId')}</p>
					<ol className="list-decimal list-inside space-y-1">
						<li>
							{t('stepOne')}
						</li>
						<li>{t('stepTwo')}</li>
						<li>{t('stepThree')}</li>
						<li>
							{t('example')}{' '}
							<span className="font-mono">
								…/entry/<strong>123456</strong>/event/…
							</span>
						</li>
					</ol>
				</div>

				<BindEntryForm />
			</Card>
		</div>
	)
}
