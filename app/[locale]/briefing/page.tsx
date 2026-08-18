import { redirect as nextRedirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { getPageLocale, type LocaleParams } from '@/i18n/page'
import { localizePathname } from '@/i18n/routing'
import { isBriefingPublicEnabled } from '@/lib/briefing-public'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export default async function BriefingPage({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	if (!isBriefingPublicEnabled()) notFound()
	nextRedirect(localizePathname('/briefing/week', locale))
}
