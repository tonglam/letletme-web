import { getCurrentAndNextEvents } from '@/lib/events'
import TeamStatsClient from './TeamStatsClient'

export default async function TeamStatsPage() {
	const data = await getCurrentAndNextEvents()
	const currentGameweek = data?.current[0]?.id ?? 1

	return <TeamStatsClient currentGameweek={currentGameweek} />
}
