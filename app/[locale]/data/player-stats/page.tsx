import PlayerStatsClient from '@/app/data/player-stats/PlayerStatsClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getCurrentAndNextEvents } from '@/lib/events'

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/data/player-stats',
		titleKey: 'playerStatsTitle',
		descriptionKey: 'playerStatsDescription'
	})
}

export default async function PlayerStatsPage({ params }: PageProps) {
	await getPageLocale(params)
	const events = await getCurrentAndNextEvents()
	const currentGameweek = events?.current[0]?.id
	const eventId = currentGameweek ?? events?.next[0]?.id
	return (
		<PlayerStatsClient
			currentGameweek={currentGameweek}
			eventId={eventId}
		/>
	)
}
