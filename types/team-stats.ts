import { Team } from '@/types/common'

export interface TeamStats {
	team: string
	teamShort: Team
	gameweek: number

	// General team stats
	gamesPlayed: number
	wins: number
	draws: number
	losses: number
	goalsScored: number
	goalsConceded: number
	cleanSheets: number
	points: number

	// Possession and shooting
	possession: number
	shots: number
	shotsOnTarget: number
	shotsAccuracy: number
	corners: number

	// Expected goals
	xG: number
	xGA: number
	xGD: number

	// Fantasy stats
	topScorer: {
		name: string
		goals: number
	}
	topAssister: {
		name: string
		assists: number
	}
	mostCaptained: {
		name: string
		captaincy: number
	}
	mostSelected: {
		name: string
		selection: number
	}

	// Players
	players: TeamPlayer[]

	// Upcoming fixtures
	fixtures: TeamFixture[]
}

export interface TeamPlayer {
	name: string
	position: 'GKP' | 'DEF' | 'MID' | 'FWD'
	goals: number
	assists: number
	cleanSheets: number
	minutesPlayed: number
	points: number
	price: number
	form: number
}

export interface TeamFixture {
	gameweek: number
	opponent: Team
	isHome: boolean
	difficulty: 1 | 2 | 3 | 4 | 5
}

// Additional team-related types from other components
export interface TopPerformer {
	rank: number
	teamName: string
	managerName: string
	points: number
	captain: {
		name: string
		team: string
		points: number
	}
}

export interface Standing {
	rank: number
	previousRank: number
	teamName: string
	managerName: string
	gameweekPoints: number
	totalPoints: number
}

export interface PointsHistoryItem {
	gameweek: number
	points: number
	averagePoints: number
	highestPoints: number
	rank: number
	rankChange: number
}
