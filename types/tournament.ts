import type {
	TournamentSetupStatus,
	TournamentSetupWarningSummary
} from '@/lib/graphql/operations/tournaments'

export interface TournamentEntryPick {
	element: number
	webName: string
	teamShortName: string
	teamName: string
	elementTypeName: string
	position: number
	isCaptain: boolean
	isViceCaptain: boolean
}

export interface TournamentEntry {
	id: string
	rank: number
	previousRank?: number
	teamName: string
	managerName: string
	captainName: string
	captainTeam: string
	captainPoints: number
	gwPoints?: number
	gwNetPoints?: number
	eventCost?: number
	overallRank?: number
	/** Previous overall rank for delta display. */
	lastOverallRank?: number
	livePoints: number
	totalPoints: number
	playersPlayed: number
	playersToPlay: number
	/** Squad value in tenths of £m (1005 → £100.5m). */
	teamValue?: number
	/** Bank / ITB in tenths of £m. */
	bank?: number
	picks: TournamentEntryPick[]
	chips: {
		bench: boolean
		triple: boolean
		wildcard: boolean
		freeHit: boolean
	}
	/** True when this row was retained from a previous failed calc batch. */
	stale?: boolean
}

export interface Tournament {
	id: string
	name: string
	entries: TournamentEntry[]
	gameweek: number
	averagePoints: number
	highestPoints: number
	totalEntries: number
	setupStatus: TournamentSetupStatus
	standingsReadyAt: string | null
	insightsReadyAt?: string | null
	setupHasWarnings: boolean
	warningSummaries?: TournamentSetupWarningSummary[]
	setupRepairExhausted?: boolean
}
