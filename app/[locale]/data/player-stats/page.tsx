import PlayerStatsClient from '@/app/data/player-stats/PlayerStatsClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import {
	PLAYER_STATS_MOCK_EVENT_ID,
	PLAYER_STATS_UI_MOCK_ENABLED,
} from '@/lib/dev/player-stats-ui-mock'
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

	// TEMP UI mock — seed GW without isCurrent event
	if (PLAYER_STATS_UI_MOCK_ENABLED) {
		return <PlayerStatsClient currentGameweek={PLAYER_STATS_MOCK_EVENT_ID} />
	}

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
