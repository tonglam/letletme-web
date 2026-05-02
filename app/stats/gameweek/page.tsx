import { executeQuery } from '@/lib/graphql-client'
import { GET_CURRENT_AND_NEXT_EVENTS, type EventsResponse } from '@/lib/graphql/queries'
import GameweekStatsClient from './GameweekStatsClient'

export default async function GameweekStatsPage() {
	let currentGameweek = 1
	try {
		const data = await executeQuery<EventsResponse>(
			GET_CURRENT_AND_NEXT_EVENTS,
			undefined,
			{ cache: 'force-cache', next: { revalidate: 300 } },
		)
		currentGameweek = data.current[0]?.id ?? 1
	} catch (err) {
		console.error('[gameweek-stats] RSC fetch failed:', err)
	}
	return <GameweekStatsClient currentGameweek={currentGameweek} />
}
