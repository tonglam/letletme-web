import { PlayerOption } from '@/types/common'

export interface PlayerStats {
	// Basic info
	player: PlayerOption
	gameweek: number

	// Match data
	matchesPlayed: number
	minutes: number

	// Attacking stats
	goals: number
	assists: number
	expectedGoals: number
	expectedAssists: number
	shotsTotal: number
	shotsOnTarget: number
	bigChancesCreated: number
	keyPasses: number

	// Defensive stats
	cleanSheets: number
	goalsConceded: number
	tackles: number
	interceptions: number
	clearances: number
	blocks: number

	// FPL stats
	points: number
	bonus: number
	priceChange: number
	selectedBy: number
	form: number
	influenceScore: number
	creativityScore: number
	threatScore: number

	// Advanced metrics
	xGPerShot: number
	xGOutperformance: number
	shotsPerGame: number
	tacklesPerGame: number
	minutesPerGoal: number
	pointsPerGame: number
	xAPerGame: number
	chanceCreationRate: number
	passCompletionRate: number
	defensiveActions: number
	defensiveActionsPerGame: number
	valueForMoney: number

	// Season totals
	seasonGoals: number
	seasonAssists: number
	seasonCleanSheets: number
	seasonPoints: number
	seasonBonusPoints: number
	seasonAppearances: number
	seasonMinutes: number

	// Historical data
	priceHistory: number[]
	pointsHistory: number[]
	formHistory: number[]
	ownershipHistory: number[]
}

// Additional player stats types from other components
export interface DreamTeamPlayer {
	name: string
	position: string
	team: string
	points: number
	price: number
	ownedBy: number
	stats: {
		goals: number
		assists: number
		cleanSheets: number
		saves?: number
		bonusPoints: number
	}
}

export interface HaulPlayer {
	name: string
	position: string
	team: string
	points: number
	ownedBy: number
	captainedBy: number
	stats: {
		goals: number
		assists: number
		cleanSheets: number
		bonusPoints: number
	}
}

export interface CaptainStat {
	player: string
	team: string
	count: number
	percentage: number
	averagePoints: number
}
