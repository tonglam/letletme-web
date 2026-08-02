import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_LIVE_POINTS,
	type LiveCalcData,
	type LiveCalcDataResponse,
} from '@/lib/graphql/operations/live'
import { getCurrentEntryId } from '@/lib/session'
import { CalendarX2 } from 'lucide-react'
import type { Metadata } from 'next'
import LivePointsClient from './LivePointsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
	title: 'Live points',
	description: 'Track an FPL entry as the gameweek unfolds.',
}

export default async function LivePointsPage() {
	const [entryId, events] = await Promise.all([
		getCurrentEntryId(),
		getCurrentAndNextEvents(),
	])
	const currentEventId = events?.current[0]?.id
	let initialLiveData: LiveCalcData | undefined

	if (!currentEventId) {
		return (
			<PageShell>
				<PageState
					icon={CalendarX2}
					title="Live gameweek data is unavailable"
					description="The current FPL gameweek could not be confirmed. No fallback gameweek has been assumed."
				/>
			</PageShell>
		)
	}

	if (entryId) {
		try {
			const response = await executeServerQuery<LiveCalcDataResponse>(
				GET_LIVE_POINTS,
				{ eventId: currentEventId, entryId },
				{ cache: 'no-store' },
			)
			initialLiveData = response.calcLivePointsByEntry
		} catch (error) {
			console.error('[live points] Failed to seed current entry:', error)
		}
	}

	return (
		<LivePointsClient
			initialEntryId={entryId ?? 0}
			initialEventId={currentEventId}
			initialLiveData={initialLiveData}
		/>
	)
}
