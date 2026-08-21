import { type LiveEntryTournament } from '@/lib/graphql/operations/tournaments'
import { type Tournament } from '@/types/tournament'
import { isTournamentInsightsRepairExhausted } from './lifecycle'

export type TournamentGroupFormat = 'none' | 'points' | 'headToHead'

export const mapTournamentGroupFormat = (
	groupMode: string
): TournamentGroupFormat => {
	if (groupMode === 'POINTS_RACES') return 'points'
	if (groupMode === 'BATTLE_RACES') return 'headToHead'
	return 'none'
}

export const mapEntryTournamentToLiveTournament = (
	tournament: LiveEntryTournament
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
		setupRepairExhausted: isTournamentInsightsRepairExhausted(
			tournament.warningSummaries
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
