'use client'

import { LiveMatchesClient } from '@/app/live/matches/LiveMatchesClient'
import type { LiveMatchdayStatus } from '@/lib/live-matches'
import type { Match } from '@/types/match'

export function LiveMatchesEntry({
	initialMatches,
	initialError,
	currentEventId,
	selectedEventId,
	initialSnapshot
}: {
	initialMatches: Match[]
	initialError?: string | null
	currentEventId?: number
	selectedEventId?: number
	initialSnapshot?: LiveMatchdayStatus | null
}) {
	return (
		<LiveMatchesClient
			initialMatches={initialMatches}
			initialError={initialError}
			currentEventId={currentEventId}
			selectedEventId={selectedEventId}
			initialSnapshot={initialSnapshot}
		/>
	)
}
