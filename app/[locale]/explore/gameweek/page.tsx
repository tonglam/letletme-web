import GameweekStatsClient from '@/app/data/gameweek/GameweekStatsClient'
import { CurrentGameweekUnavailable } from '@/components/feedback/CurrentGameweekUnavailable'
import { loadGameweekDesk } from '@/lib/gameweek-desk-server'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'

type PageProps = { params: LocaleParams }

// Gameweek is anchored to the review/current event at request time. Static
// generation can freeze an unavailable/preseason response from build time and
// cannot reflect a newly settled or live GW when the page is opened.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/explore/gameweek',
		titleKey: 'gameweekStatsTitle',
		descriptionKey: 'gameweekStatsDescription'
	})
}

export default async function GameweekStatsPage({ params }: PageProps) {
	await getPageLocale(params)

	let initialDesk
	try {
		initialDesk = await loadGameweekDesk()
	} catch (error) {
		console.error('Failed to load initial gameweek desk:', error)
		return <CurrentGameweekUnavailable />
	}

	return <GameweekStatsClient initialDesk={initialDesk} />
}
