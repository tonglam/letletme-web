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
	multiplier?: number
	pickActive?: boolean
	autoSub?: boolean
	isCaptain: boolean
	isViceCaptain: boolean
}

export interface TournamentEntry {
	id: string
	availability?: 'READY' | 'MISSING'
	rank: number
	previousRank?: number
	teamName: string
	managerName: string
	captainName: string
	captainTeam: string
	captainPoints: number
	gwPoints?: number | null
	gwNetPoints?: number | null
	eventCost?: number
	overallRank?: number
	/** Previous overall rank for delta display. */
	lastOverallRank?: number
	livePoints: number | null
	totalPoints: number | null
	playersPlayed: number
	playersToPlay: number
	/** Squad value in £m as returned by the live GraphQL desk (100.5 → £100.5m). */
	teamValue?: number
	/** Bank / ITB in £m as returned by the live GraphQL desk. */
	bank?: number
	picks: TournamentEntryPick[]
	chips: {
		bench: boolean
		triple: boolean
		wildcard: boolean
		freeHit: boolean
		manager: boolean
	}
	/** True when this row was retained from a previous failed calc batch. */
	stale?: boolean
}

export interface Tournament {
	id: string
	name: string
	leagueType?: string
	groupMode?: string | null
	rosterMode?: string
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
