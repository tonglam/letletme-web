import { Player } from '@/types/player'

type Position = 'GKP' | 'DEF' | 'MID' | 'FWD'

// Sort players by position order: GKP, DEF, MID, FWD
const positionOrder = { GKP: 1, DEF: 2, MID: 3, FWD: 4 }

// Helper function to generate complete player stats
const generatePlayerStats = (
	baseStats: Partial<Player['stats']>,
	position: Position
): Player['stats'] => {
	const defaultStats: Player['stats'] = {
		minutes: 0,
		goals: 0,
		assists: 0,
		cleanSheets: 0,
		yellowCards: 0,
		redCards: 0,
		points: 0,
		bonusPoints: 0,
		expectedGoals: 0,
		expectedAssists: 0,
		expectedGoalInvolvements: 0,
		expectedGoalsConceded: position === 'GKP' || position === 'DEF' ? 1.5 : 0,
		saves: position === 'GKP' ? 3 : 0,
		savePenalty: position === 'GKP' ? 0 : 0
	}

	return { ...defaultStats, ...baseStats }
}

// Starting XI
const unsortedStartingPlayers: Player[] = [
	{
		id: '1',
		name: 'Onana',
		team: 'Manchester United',
		teamShort: 'MUN',
		position: 'GKP',
		stats: generatePlayerStats(
			{
				minutes: 90,
				saves: 3,
				points: 3,
				expectedGoalsConceded: 1.2
			},
			'GKP'
		),
		playingStatus: 'FINISHED'
	},
	{
		id: '2',
		name: 'Trippier',
		team: 'Newcastle United',
		teamShort: 'NEW',
		position: 'DEF',
		stats: generatePlayerStats(
			{
				minutes: 90,
				cleanSheets: 1,
				points: 6,
				bonusPoints: 2,
				expectedGoalsConceded: 0.8,
				expectedGoals: 0.1,
				expectedAssists: 0.3,
				expectedGoalInvolvements: 0.4
			},
			'DEF'
		),
		playingStatus: 'FINISHED'
	},
	{
		id: '3',
		name: 'Gvardiol',
		team: 'Manchester City',
		teamShort: 'MCI',
		position: 'DEF',
		stats: generatePlayerStats(
			{
				minutes: 90,
				cleanSheets: 0,
				points: 2,
				expectedGoalsConceded: 1.2,
				expectedGoals: 0.1,
				expectedAssists: 0.1,
				expectedGoalInvolvements: 0.2
			},
			'DEF'
		),
		playingStatus: 'PLAYING'
	},
	{
		id: '4',
		name: 'Muñoz',
		team: 'Crystal Palace',
		teamShort: 'CRY',
		position: 'DEF',
		stats: generatePlayerStats(
			{
				minutes: 90,
				cleanSheets: 0,
				points: 2,
				expectedGoalsConceded: 1.5,
				expectedGoals: 0.1,
				expectedAssists: 0.2,
				expectedGoalInvolvements: 0.3
			},
			'DEF'
		),
		playingStatus: 'NOT_STARTED'
	},
	{
		id: '5',
		name: 'Palmer',
		team: 'Chelsea',
		teamShort: 'CHE',
		position: 'MID',
		stats: generatePlayerStats(
			{
				minutes: 90,
				goals: 1,
				points: 10,
				bonusPoints: 3,
				expectedGoals: 0.8,
				expectedAssists: 0.3,
				expectedGoalInvolvements: 1.1
			},
			'MID'
		),
		playingStatus: 'FINISHED',
		isViceCaptain: true
	},
	{
		id: '6',
		name: 'Sávio',
		team: 'Manchester City',
		teamShort: 'MCI',
		position: 'MID',
		stats: generatePlayerStats(
			{
				minutes: 90,
				goals: 1,
				points: 8,
				bonusPoints: 1,
				expectedGoals: 0.6,
				expectedAssists: 0.4,
				expectedGoalInvolvements: 1.0
			},
			'MID'
		),
		playingStatus: 'PLAYING'
	},
	{
		id: '7',
		name: 'Amad',
		team: 'Manchester United',
		teamShort: 'MUN',
		position: 'MID',
		stats: generatePlayerStats(
			{
				minutes: 90,
				goals: 1,
				yellowCards: 1,
				points: 9,
				bonusPoints: 3,
				expectedGoals: 0.5,
				expectedAssists: 0.2,
				expectedGoalInvolvements: 0.7
			},
			'MID'
		),
		playingStatus: 'FINISHED'
	},
	{
		id: '8',
		name: 'M.Salah',
		team: 'Liverpool',
		teamShort: 'LIV',
		position: 'MID',
		stats: generatePlayerStats(
			{
				minutes: 90,
				goals: 1,
				points: 7,
				expectedGoals: 0.9,
				expectedAssists: 0.5,
				expectedGoalInvolvements: 1.4
			},
			'MID'
		),
		playingStatus: 'PLAYING',
		isCaptain: true
	},
	{
		id: '9',
		name: 'Haaland',
		team: 'Manchester City',
		teamShort: 'MCI',
		position: 'FWD',
		stats: generatePlayerStats(
			{
				minutes: 90,
				goals: 1,
				points: 6,
				expectedGoals: 1.2,
				expectedAssists: 0.3,
				expectedGoalInvolvements: 1.5
			},
			'FWD'
		),
		playingStatus: 'PLAYING'
	},
	{
		id: '10',
		name: 'Wissa',
		team: 'Brentford',
		teamShort: 'BRE',
		position: 'FWD',
		stats: generatePlayerStats(
			{
				minutes: 90,
				goals: 1,
				points: 6,
				expectedGoals: 0.7,
				expectedAssists: 0.2,
				expectedGoalInvolvements: 0.9
			},
			'FWD'
		),
		playingStatus: 'NOT_STARTED'
	},
	{
		id: '11',
		name: 'Raúl',
		team: 'Fulham',
		teamShort: 'FUL',
		position: 'FWD',
		stats: generatePlayerStats(
			{
				minutes: 90,
				goals: 1,
				points: 6,
				expectedGoals: 0.6,
				expectedAssists: 0.2,
				expectedGoalInvolvements: 0.8
			},
			'FWD'
		),
		playingStatus: 'NOT_STARTED'
	}
]

// Bench players
const unsortedBenchPlayers: Player[] = [
	{
		id: '12',
		name: 'Raya',
		team: 'Arsenal',
		teamShort: 'ARS',
		position: 'GKP',
		stats: generatePlayerStats(
			{
				expectedGoalsConceded: 1.2
			},
			'GKP'
		),
		playingStatus: 'NOT_STARTED'
	},
	{
		id: '13',
		name: 'Van den Berg',
		team: 'Brentford',
		teamShort: 'BRE',
		position: 'DEF',
		stats: generatePlayerStats(
			{
				expectedGoalsConceded: 1.5,
				expectedGoals: 0.1,
				expectedAssists: 0.1,
				expectedGoalInvolvements: 0.2
			},
			'DEF'
		),
		playingStatus: 'NOT_STARTED'
	},
	{
		id: '14',
		name: 'Mbeumo',
		team: 'Brentford',
		teamShort: 'BRE',
		position: 'MID',
		stats: generatePlayerStats(
			{
				expectedGoals: 0.4,
				expectedAssists: 0.3,
				expectedGoalInvolvements: 0.7
			},
			'MID'
		),
		playingStatus: 'NOT_STARTED'
	},
	{
		id: '15',
		name: 'Barkley',
		team: 'Aston Villa',
		teamShort: 'AVL',
		position: 'MID',
		stats: generatePlayerStats(
			{
				expectedGoals: 0.2,
				expectedAssists: 0.2,
				expectedGoalInvolvements: 0.4
			},
			'MID'
		),
		playingStatus: 'NOT_STARTED'
	},
	{
		id: '16',
		name: 'N.Jackson',
		team: 'Chelsea',
		teamShort: 'CHE',
		position: 'FWD',
		stats: generatePlayerStats(
			{
				expectedGoals: 0.5,
				expectedAssists: 0.2,
				expectedGoalInvolvements: 0.7
			},
			'FWD'
		),
		playingStatus: 'NOT_STARTED'
	}
]

// Sort players by position
export const startingPlayers = [...unsortedStartingPlayers].sort(
	(a, b) => positionOrder[a.position] - positionOrder[b.position]
)

export const benchPlayers = [...unsortedBenchPlayers].sort(
	(a, b) => positionOrder[a.position] - positionOrder[b.position]
)

export const teamStats = {
	teamName: 'let let red arrow↓↑↓',
	playerName: 'tong',
	points: 54,
	totalPoints: 1213,
	playersPlayed: 11,
	playersToPlay: 0,
	chips: {
		bench: false,
		triple: false,
		wildcard: false
	}
}
