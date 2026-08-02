import { getCurrentAndNextEvents } from '@/lib/events'
import type { Metadata } from 'next'
import PlayerStatsClient from './PlayerStatsClient'

export const metadata: Metadata = {
	title: 'Player statistics',
	description: 'Compare FPL player performance, form, fixtures, and market data.',
}

export default async function PlayerStatsPage() {
	const events = await getCurrentAndNextEvents()
	return <PlayerStatsClient currentGameweek={events?.current[0]?.id} />
}
