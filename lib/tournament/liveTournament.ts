import { type EntryTournament } from '@/lib/graphql/queries'
import { type Tournament } from '@/types/tournament'

export const mapEntryTournamentToLiveTournament = (
	tournament: EntryTournament
): Tournament => {
	return {
		id: String(tournament.id),
		name: tournament.name,
		gameweek: 1,
		averagePoints: 0,
		highestPoints: 0,
		totalEntries: tournament.totalTeamNum,
		entries: []
	}
}

export const formatTournamentState = (state: string): string => {
	if (state === 'ACTIVE') {
		return 'Live'
	}
	if (state === 'COMPLETED') {
		return 'Completed'
	}
	if (state === 'PENDING') {
		return 'Pending'
	}
	return state
}
