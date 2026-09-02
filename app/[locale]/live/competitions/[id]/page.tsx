import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: LocaleParams<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/live/competitions',
		titleKey: 'competitionStandingsTitle',
		descriptionKey: 'competitionStandingsDescription'
	})
}

/**
 * The old detail desk performed a request-time full-roster calculation. V2
 * makes the publication-backed competition page the only live surface, so a
 * deep link is normalized before any live query is made.
 */
export default async function Page({ params, searchParams }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	const query = await searchParams
	const target = new URLSearchParams({ tournamentId: id })
	const requestedGameweek = typeof query.gw === 'string' ? query.gw : null
	if (requestedGameweek && /^([1-9]|[12]\d|3[0-8])$/.test(requestedGameweek)) {
		target.set('gw', requestedGameweek)
	}
	if (query.created === '1') target.set('created', '1')
	redirect(localizeHref(`/live/competitions?${target.toString()}`, locale))
}
