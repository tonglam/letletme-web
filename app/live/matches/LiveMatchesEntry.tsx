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
	initialSnapshot,
	isOfficialUpdating
}: {
	initialMatches: Match[]
	initialError?: string | null
	currentEventId?: number
	selectedEventId?: number
	nextEventId?: number
	initialSnapshot?: LiveSnapshotStatus | null
	isOfficialUpdating?: boolean
}) {
	return (
		<LiveMatchesClient
			initialMatches={initialMatches}
			initialError={initialError}
			currentEventId={currentEventId}
			selectedEventId={selectedEventId}
			nextEventId={nextEventId}
			initialSnapshot={initialSnapshot}
			isOfficialUpdating={isOfficialUpdating}
		/>
	)
}
