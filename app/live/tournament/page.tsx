import { getCurrentEntryId } from '@/lib/session'
import { getCurrentAndNextEvents } from '@/lib/events'
import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_LIVE_POINTS,
	type EntryTournamentsResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse,
} from '@/lib/graphql/operations/tournaments'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import type { Metadata } from 'next'
import { CalendarX2 } from 'lucide-react'
import { Suspense } from 'react'
import TournamentClient from './TournamentClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
	title: 'Live tournaments',
	description: 'Follow live standings and squad exposure across your tournaments.',
}

type PageProps = {
	params: Promise<Record<string, never>>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ searchParams }: PageProps) {
	const resolvedSearchParams = await searchParams
	const [entryId, events] = await Promise.all([
		getCurrentEntryId(),
		getCurrentAndNextEvents(),
	])
	const currentEventId = events?.current[0]?.id

	if (!currentEventId) {
		return (
			<PageShell>
				<PageState
					icon={CalendarX2}
					title="Live tournament data is unavailable"
					description="The current FPL gameweek could not be confirmed. No fallback gameweek has been assumed."
				/>
			</PageShell>
		)
	}
	let initialTournaments: ReturnType<typeof mapEntryTournamentToLiveTournament>[] = []
	let initialSelectedTournamentId = ''
	let initialCurrentRows: TournamentLiveCalcData[] = []
	let initialResultsLoaded = false

	if (entryId) {
		try {
			const tournamentsData = await executeServerQuery<EntryTournamentsResponse>(
				GET_ENTRY_TOURNAMENTS,
				{ entryId },
				{ cache: 'no-store' },
			)
			initialTournaments = tournamentsData.entryTournaments.map(
				mapEntryTournamentToLiveTournament,
			)
			const requestedTournamentId =
				typeof resolvedSearchParams.tournamentId === 'string'
					? resolvedSearchParams.tournamentId
					: ''
			initialSelectedTournamentId =
				initialTournaments.find(tournament => tournament.id === requestedTournamentId)?.id ??
				initialTournaments[0]?.id ??
				''

			const tournamentId = Number(initialSelectedTournamentId)
			if (tournamentId > 0 && currentEventId) {
				const currentResponse = await executeServerQuery<TournamentLivePointsResponse>(
						GET_TOURNAMENT_LIVE_POINTS,
						{ tournamentId, eventId: currentEventId },
						{ cache: 'no-store' },
					)
				initialCurrentRows = currentResponse.calcLivePointsForTournament.results ?? []
				initialResultsLoaded = true
			}
		} catch (err) {
			console.error('Failed to seed live tournament page:', err)
		}
	}

	return (
		<Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-12 text-sm text-muted-foreground">Loading tournaments…</div>}>
			<TournamentClient
				entryId={entryId ?? 0}
				initialTournaments={initialTournaments}
				initialSelectedTournamentId={initialSelectedTournamentId}
				initialEventId={currentEventId}
				initialCurrentRows={initialCurrentRows}
				initialResultsLoaded={initialResultsLoaded}
			/>
		</Suspense>
	)
}
