import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_ENTRY_EVENT_RESULT,
	type EntryEventResult,
	type EntryEventResultResponse,
} from '@/lib/graphql/operations/entries'
import { getCurrentEntryId, getCurrentSession } from '@/lib/session'
import type { Metadata } from 'next'
import { CalendarX2 } from 'lucide-react'
import { redirect } from 'next/navigation'
import TeamStatsClient from './TeamStatsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
	title: 'My team statistics',
	description: 'Review your FPL squad, gameweek history, chips, and transfers.',
}

export default async function TeamStatsPage() {
	const [session, entryId, events] = await Promise.all([
		getCurrentSession(),
		getCurrentEntryId(),
		getCurrentAndNextEvents(),
	])
	if (!session) redirect('/auth/login?next=/stats/team')
	if (!entryId) redirect('/onboarding/bind-entry')

	const currentGameweek = events?.current[0]?.id

	if (!currentGameweek) {
		return (
			<PageShell>
				<PageState
					icon={CalendarX2}
					title="Team statistics are unavailable"
					description="The current FPL gameweek could not be confirmed. No fallback gameweek has been assumed."
				/>
			</PageShell>
		)
	}

	let initialEntryEventResult: EntryEventResult | null = null
	let initialError: string | null = null
	let initialRequestComplete = false

	try {
		const response = await executeServerQuery<EntryEventResultResponse>(
			GET_ENTRY_EVENT_RESULT,
			{ eventId: currentGameweek, entryId },
			{ cache: 'no-store' },
		)
		initialEntryEventResult = response.entryEventResult ?? null
		initialRequestComplete = true
	} catch (error) {
		console.error('[team stats] Failed to seed current gameweek:', error)
		initialError = 'Team statistics are temporarily unavailable.'
	}

	return (
		<TeamStatsClient
			entryId={entryId}
			currentGameweek={currentGameweek}
			initialEntryEventResult={initialEntryEventResult}
			initialError={initialError}
			initialRequestComplete={initialRequestComplete}
		/>
	)
}
