import { getCurrentEntryId } from '@/lib/session'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executeQuery } from '@/lib/graphql-client'
import { getServerUserContextHeaders } from '@/lib/server-user-context'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_LIVE_POINTS,
	type EntryTournamentsResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse,
} from '@/lib/graphql/queries'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import { Suspense } from 'react'
import TournamentClient from './TournamentClient'

export const dynamic = 'force-dynamic'

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
	const currentEventId = events?.current[0]?.id ?? 1
	let initialTournaments: ReturnType<typeof mapEntryTournamentToLiveTournament>[] = []
	let initialSelectedTournamentId = ''
	let initialCurrentRows: TournamentLiveCalcData[] = []

	if (entryId) {
		try {
			const authHeaders = await getServerUserContextHeaders()
			const tournamentsData = await executeQuery<EntryTournamentsResponse>(
				GET_ENTRY_TOURNAMENTS,
				{ entryId },
				{ cache: 'no-store', headers: authHeaders },
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
			if (tournamentId > 0) {
				const currentResponse = await executeQuery<TournamentLivePointsResponse>(
					GET_TOURNAMENT_LIVE_POINTS,
					{ tournamentId, eventId: currentEventId },
					{ cache: 'no-store', headers: authHeaders },
				)
				initialCurrentRows = currentResponse.calcLivePointsForTournament.results ?? []
			}
		} catch (err) {
			console.error('Failed to seed live tournament page:', err)
		}
	}

	return (
		<Suspense fallback={<div>Loading...</div>}>
			<TournamentClient
				entryId={entryId ?? 0}
				initialTournaments={initialTournaments}
				initialSelectedTournamentId={initialSelectedTournamentId}
				initialEventId={currentEventId}
				initialCurrentRows={initialCurrentRows}
			/>
		</Suspense>
	)
}
