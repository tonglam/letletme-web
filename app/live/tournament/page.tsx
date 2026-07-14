import { getCurrentEntryId } from '@/lib/session'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executeServerQuery } from '@/lib/graphql-server'
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
	let initialPreviousRows: TournamentLiveCalcData[] = []

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
			if (tournamentId > 0) {
				const previousEventId = currentEventId > 1 ? currentEventId - 1 : null
				const [currentResponse, previousResponse] = await Promise.all([
					executeServerQuery<TournamentLivePointsResponse>(
						GET_TOURNAMENT_LIVE_POINTS,
						{ tournamentId, eventId: currentEventId },
						{ cache: 'no-store' },
					),
					previousEventId
						? executeServerQuery<TournamentLivePointsResponse>(
								GET_TOURNAMENT_LIVE_POINTS,
								{ tournamentId, eventId: previousEventId },
								{ cache: 'no-store' },
							).catch(() => null)
						: Promise.resolve(null),
				])
				initialCurrentRows = currentResponse.calcLivePointsForTournament.results ?? []
				initialPreviousRows =
					previousResponse?.calcLivePointsForTournament.results ?? []
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
				initialPreviousRows={initialPreviousRows}
			/>
		</Suspense>
	)
}
