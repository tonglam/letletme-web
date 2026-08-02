import { LogoMark } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { getAuth } from '@/lib/auth'
import { ExternalLink, Hash } from 'lucide-react'
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

	return (
		<div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center bg-muted/30 p-4">
			<div className="mb-6 flex items-center gap-2">
				<LogoMark className="size-10 text-plum dark:text-electric" />
				<h1 className="font-display text-2xl font-bold uppercase tracking-[0.06em]">LetLetMe</h1>
			</div>

			<Card className="w-full max-w-md p-6">
				<div className="mb-6 text-center">
					<div className="flex justify-center mb-3">
						<Hash className="h-10 w-10 text-primary-ink" />
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
							{t.rich('stepOne', {
								fpl: chunks => (
									<a
										href="https://fantasy.premierleague.com/"
										target="_blank"
										rel="noopener noreferrer"
										className="font-medium text-primary-ink underline underline-offset-4 hover:no-underline"
									>
										{chunks}
									</a>
								),
							})}
						</li>
						<li>{t('stepTwo')}</li>
						<li>{t('stepThree')}</li>
						<li>
							{t('example')}{' '}
							<span className="font-mono">
								&quot;entry&quot;: <strong>123456</strong>
							</span>
						</li>
					</ol>
					<Button variant="outline" size="sm" className="mt-3 w-full" asChild>
						<a
							href="https://fantasy.premierleague.com/api/me/"
							target="_blank"
							rel="noopener noreferrer"
						>
							<ExternalLink data-icon="inline-start" />
							{t('openFplPage')}
						</a>
					</Button>
					<p className="mt-2">{t('noteIfNull')}</p>
				</div>

				<BindEntryForm />
			</Card>
		</div>
	)
}
