import { type EntryTournament } from '@/lib/graphql/operations/tournaments'
import { type Tournament } from '@/types/tournament'

export type TournamentGroupFormat = 'none' | 'points' | 'headToHead'

export const mapTournamentGroupFormat = (
	groupMode: string
): TournamentGroupFormat => {
	if (groupMode === 'POINTS_RACES') return 'points'
	if (groupMode === 'BATTLE_RACES') return 'headToHead'
	return 'none'
}

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
		entries: [],
		setupStatus: tournament.setupStatus,
		standingsReadyAt: tournament.standingsReadyAt,
		insightsReadyAt: tournament.insightsReadyAt ?? null,
		setupHasWarnings: tournament.setupHasWarnings,
		warningSummaries: tournament.warningSummaries ?? [],
		setupRepairExhausted: (tournament.warningSummaries ?? []).some(
			summary => summary.repairExhausted === true
		)
	}
}

export const formatTournamentState = (state: string): string => {
	if (state === 'ACTIVE') {
		return 'Live'
	}
	if (state === 'FINISHED') {
		return 'Completed'
	}
	if (state === 'INACTIVE') {
		return 'Paused'
	}
	return state
}
