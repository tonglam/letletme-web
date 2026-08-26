'use client'

import dynamic from 'next/dynamic'
import type { Match } from '@/types/match'
import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'

// The dynamic import lives behind a Client Component boundary.  Next can
// therefore omit the heavy match card/tab graph when the server rendered
// preseason branch never mounts this entry.
const LiveMatchesClient = dynamic(
	() =>
		import('@/app/live/matches/LiveMatchesClient').then(
			mod => mod.LiveMatchesClient
		),
	{ ssr: true }
)

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
