import { executeQuery } from '@/lib/graphql-client'
import { GET_CURRENT_AND_NEXT_EVENTS, type EventsResponse } from '@/lib/graphql/queries'
import TeamStatsClient from './TeamStatsClient'

export default async function TeamStatsPage() {
	let currentGameweek = 1
	try {
		const data = await executeQuery<EventsResponse>(
			GET_CURRENT_AND_NEXT_EVENTS,
			undefined,
			{ cache: 'force-cache', next: { revalidate: 300 } },
		)
		currentGameweek = data.current[0]?.id ?? 1
	} catch (err) {
		console.error('[team-stats] RSC fetch failed:', err)
	}
	return <TeamStatsClient currentGameweek={currentGameweek} />
}
