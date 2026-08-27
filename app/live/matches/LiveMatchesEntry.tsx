'use client'

import { LiveMatchesClient } from '@/app/live/matches/LiveMatchesClient'
import type { Match } from '@/types/match'
import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'

export function LiveMatchesEntry({
	initialMatches,
	initialError,
	currentEventId,
	selectedEventId,
	nextEventId,
	initialSnapshot
}: {
	initialMatches: Match[]
	initialError?: string | null
	currentEventId?: number
	selectedEventId?: number
	nextEventId?: number
	initialSnapshot?: LiveSnapshotStatus | null
}) {
	return (
		<LiveMatchesClient
			initialMatches={initialMatches}
			initialError={initialError}
			currentEventId={currentEventId}
			selectedEventId={selectedEventId}
			nextEventId={nextEventId}
			initialSnapshot={initialSnapshot}
		/>
	)
}
