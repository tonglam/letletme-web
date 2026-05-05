import { getCurrentAndNextEvents } from '@/lib/events'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_SELECTION_STATS,
	type EntryTournamentsResponse,
	type TournamentSelectionStatsResponse,
	type TournamentStatPlayer,
} from '@/lib/graphql/queries'
import { getCurrentEntryId } from '@/lib/session'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import SelectionsClient from './SelectionsClient'

interface StatsResult {
	selection: TournamentStatPlayer[]
	captain: TournamentStatPlayer[]
	transferIn: TournamentStatPlayer[]
	transferOut: TournamentStatPlayer[]
}

export const dynamic = 'force-dynamic'

export default async function SelectionsPage() {
	const [entryId, events] = await Promise.all([
		getCurrentEntryId(),
		getCurrentAndNextEvents(),
	])
	const currentGameweek = events?.current[0]?.id ?? 1

	let initialTournaments: ReturnType<typeof mapEntryTournamentToLiveTournament>[] = []
	let initialStats: StatsResult | null = null

	if (entryId) {
		try {
			const tournamentsData = await executeQuery<EntryTournamentsResponse>(
				GET_ENTRY_TOURNAMENTS,
				{ entryId },
				{ cache: 'no-store' },
			)
			initialTournaments = tournamentsData.entryTournaments.map(
				mapEntryTournamentToLiveTournament,
			)

			const firstTournamentId = Number(initialTournaments[0]?.id)
			if (firstTournamentId > 0) {
				const statsData = await executeQuery<TournamentSelectionStatsResponse>(
					GET_TOURNAMENT_SELECTION_STATS,
					{ tournamentId: firstTournamentId, eventId: currentGameweek, limit: 10 },
					{ cache: 'no-store' },
				)
				const stats = statsData.tournamentSelectionStats
				initialStats = {
					selection: stats?.mostSelectedPlayers ?? [],
					captain: stats?.captainSelect ?? [],
					transferIn: stats?.mostTransferIn ?? [],
					transferOut: stats?.mostTransferOut ?? [],
				}
			}
		} catch (err) {
			console.error('Failed to seed tournament selections:', err)
		}
	}

	return (
		<SelectionsClient
			initialTournaments={initialTournaments}
			initialSelectedTournamentId={initialTournaments[0]?.id ?? ''}
			initialStats={initialStats}
			initialGameweek={currentGameweek}
		/>
	)
}
