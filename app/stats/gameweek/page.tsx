import { getCurrentAndNextEvents } from '@/lib/events'
import { fetchOverallGameweekStats } from '@/lib/gameweek-overall-stats'
import GameweekStatsClient from './GameweekStatsClient'

export default async function GameweekStatsPage() {
	const data = await getCurrentAndNextEvents()
	const currentGameweek = data?.current[0]?.id ?? 1
	let initialOverallStats: Awaited<ReturnType<typeof fetchOverallGameweekStats>> | null = null

	try {
		initialOverallStats = await fetchOverallGameweekStats(currentGameweek, {
			cache: 'force-cache',
			next: { revalidate: 300 },
		})
	} catch (err) {
		console.error('Failed to load initial gameweek overview:', err)
	}

	return (
		<GameweekStatsClient
			currentGameweek={currentGameweek}
			initialOverallStats={initialOverallStats}
		/>
	)
}
