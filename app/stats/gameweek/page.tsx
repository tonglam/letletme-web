import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { getCurrentAndNextEvents } from '@/lib/events'
import { fetchOverallGameweekStats } from '@/lib/gameweek-overall-stats'
import { executePublicServerQuery } from '@/lib/graphql-server'
import type { Metadata } from 'next'
import { CalendarX2 } from 'lucide-react'
import GameweekStatsClient from './GameweekStatsClient'

export const metadata: Metadata = {
	title: 'Gameweek statistics',
	description: 'Explore overall FPL gameweek performance, transfers, and dream-team data.',
}

export default async function GameweekStatsPage() {
	const data = await getCurrentAndNextEvents()
	const currentGameweek = data?.current[0]?.id

	if (!currentGameweek) {
		return (
			<PageShell>
				<PageState
					icon={CalendarX2}
					title="Gameweek data is unavailable"
					description="The current FPL gameweek could not be confirmed. No fallback gameweek has been assumed."
				/>
			</PageShell>
		)
	}

	let initialOverallStats: Awaited<ReturnType<typeof fetchOverallGameweekStats>> | null = null

	try {
		initialOverallStats = await fetchOverallGameweekStats(currentGameweek, {
			cache: 'force-cache',
			next: { revalidate: 300 },
		}, executePublicServerQuery)
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
