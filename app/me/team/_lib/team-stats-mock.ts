import type {
	EntryEventPick,
	EntryEventResult,
	EntryHistoryItem,
	EntrySeasonHistoryItem,
} from '@/lib/graphql/operations/entries'

export const MOCK_TEAM_ENTRY_ID = 24001
export const MOCK_TEAM_EVENT_ID = 22

type MockPickInput = Pick<
	EntryEventPick,
	'element' | 'position' | 'webName' | 'teamName' | 'teamShortName' | 'elementTypeName' | 'totalPoints'
> & {
	isCaptain?: boolean
	isViceCaptain?: boolean
	goalsScored?: number
	assists?: number
	cleanSheets?: number
	bonus?: number
	saves?: number
}

function createMockPick(input: MockPickInput): EntryEventPick {
	const isBench = input.position > 11

	return {
		element: input.element,
		position: input.position,
		webName: input.webName,
		teamShortName: input.teamShortName,
		teamName: input.teamName,
		elementTypeName: input.elementTypeName,
		isCaptain: input.isCaptain ?? false,
		isViceCaptain: input.isViceCaptain ?? false,
		multiplier: input.isCaptain ? 2 : 1,
		totalPoints: input.totalPoints,
		minutes: isBench ? 0 : 90,
		goalsScored: input.goalsScored ?? 0,
		assists: input.assists ?? 0,
		cleanSheets: input.cleanSheets ?? 0,
		goalsConceded: 0,
		yellowCards: 0,
		redCards: 0,
		saves: input.saves ?? 0,
		bonus: input.bonus ?? 0,
		bps: 50,
		againstShortName: 'WHU',
		wasHome: 'HOME',
		score: isBench ? '' : '2-1',
		isPlayed: !isBench,
		autoSub: false,
		expectedGoals: 0,
		expectedAssists: 0,
		expectedGoalInvolvements: 0,
		expectedGoalsConceded: 0,
	}
}

const mockPicks: EntryEventPick[] = [
	createMockPick({ element: 1, position: 1, webName: 'Raya', teamName: 'Arsenal', teamShortName: 'ARS', elementTypeName: 'GKP', totalPoints: 6, cleanSheets: 1, isViceCaptain: true }),
	createMockPick({ element: 2, position: 2, webName: 'Gabriel', teamName: 'Arsenal', teamShortName: 'ARS', elementTypeName: 'DEF', totalPoints: 6, cleanSheets: 1 }),
	createMockPick({ element: 3, position: 3, webName: 'Gvardiol', teamName: 'Manchester City', teamShortName: 'MCI', elementTypeName: 'DEF', totalPoints: 11, cleanSheets: 1 }),
	createMockPick({ element: 4, position: 4, webName: 'Senesi', teamName: 'Bournemouth', teamShortName: 'BOU', elementTypeName: 'DEF', totalPoints: 14, goalsScored: 1 }),
	createMockPick({ element: 5, position: 5, webName: 'Szoboszlai', teamName: 'Liverpool', teamShortName: 'LIV', elementTypeName: 'MID', totalPoints: 13, goalsScored: 1, bonus: 2 }),
	createMockPick({ element: 6, position: 6, webName: 'Saka', teamName: 'Arsenal', teamShortName: 'ARS', elementTypeName: 'MID', totalPoints: 9, assists: 1 }),
	createMockPick({ element: 7, position: 7, webName: 'Palmer', teamName: 'Chelsea', teamShortName: 'CHE', elementTypeName: 'MID', totalPoints: 7, assists: 1 }),
	createMockPick({ element: 8, position: 8, webName: 'B.Fernandes', teamName: 'Manchester United', teamShortName: 'MUN', elementTypeName: 'MID', totalPoints: 5 }),
	createMockPick({ element: 9, position: 9, webName: 'João Pedro', teamName: 'Chelsea', teamShortName: 'CHE', elementTypeName: 'FWD', totalPoints: 8, goalsScored: 1 }),
	createMockPick({ element: 10, position: 10, webName: 'Gyökeres', teamName: 'Arsenal', teamShortName: 'ARS', elementTypeName: 'FWD', totalPoints: 32, goalsScored: 2, bonus: 3, isCaptain: true }),
	createMockPick({ element: 11, position: 11, webName: 'Thiago', teamName: 'Brentford', teamShortName: 'BRE', elementTypeName: 'FWD', totalPoints: 6 }),
	createMockPick({ element: 12, position: 12, webName: 'Pickford', teamName: 'Everton', teamShortName: 'EVE', elementTypeName: 'GKP', totalPoints: 2 }),
	createMockPick({ element: 13, position: 13, webName: 'Saliba', teamName: 'Arsenal', teamShortName: 'ARS', elementTypeName: 'DEF', totalPoints: 2 }),
	createMockPick({ element: 14, position: 14, webName: 'Gordon', teamName: 'Newcastle United', teamShortName: 'NEW', elementTypeName: 'MID', totalPoints: 3 }),
	createMockPick({ element: 15, position: 15, webName: 'Havertz', teamName: 'Arsenal', teamShortName: 'ARS', elementTypeName: 'FWD', totalPoints: 1 }),
]

const mockEntry = {
	id: MOCK_TEAM_ENTRY_ID,
	entryName: 'Wildcard Atelier',
	playerName: 'Preview Manager',
	totalTransfers: 18,
	region: 'AU',
}

export const MOCK_TEAM_EVENT_RESULT: EntryEventResult = {
	eventId: MOCK_TEAM_EVENT_ID,
	eventPoints: 117,
	overallPoints: 1420,
	overallRank: 234567,
	eventTransfers: 0,
	eventTransfersCost: 0,
	eventNetPoints: 117,
	eventBenchPoints: 6,
	eventChip: 'WILDCARD',
	eventCaptainPoints: 64,
	eventPlayedCaptain: { webName: 'Gyökeres' },
	eventPicks: mockPicks,
	teamValue: 1013,
	bank: 7,
	entry: mockEntry,
}

const mockEventPoints = (gameweek: number) =>
	gameweek === MOCK_TEAM_EVENT_ID ? 117 : gameweek === 1 ? 63 : 62

export const MOCK_TEAM_HISTORY: {
	results: EntryHistoryItem[]
	history: EntrySeasonHistoryItem[]
} = {
	results: Array.from({ length: MOCK_TEAM_EVENT_ID }, (_, index) => {
		const eventId = index + 1
		const eventPoints = mockEventPoints(eventId)
		const priorPoints = Array.from({ length: index }, (_, priorIndex) =>
			mockEventPoints(priorIndex + 1),
		).reduce((sum, points) => sum + points, 0)
		return {
			eventId,
			eventChip: eventId === 8 ? 'TRIPLE_CAPTAIN' : eventId === MOCK_TEAM_EVENT_ID ? 'WILDCARD' : 'NONE',
			eventPoints,
			eventRank: 500000 - eventId * 12000,
			overallPoints: priorPoints + eventPoints,
			overallRank: eventId === MOCK_TEAM_EVENT_ID ? 234567 : 500000 - eventId * 12000,
			eventTransfers: eventId % 5 === 0 ? 1 : 0,
			eventTransfersCost: eventId % 5 === 0 ? 4 : 0,
			eventNetPoints: eventPoints - (eventId % 5 === 0 ? 4 : 0),
			eventBenchPoints: eventId % 4 === 0 ? 8 : 2,
			eventCaptainPoints: eventId === MOCK_TEAM_EVENT_ID ? 64 : 12,
			eventPlayedCaptain: { webName: eventId % 2 === 0 ? 'Gyökeres' : 'Saka', team: { shortName: 'ARS' } },
			teamValue: 980 + eventId,
			bank: 5,
		}
	}),
	history: [
		{
			season: '2025/26',
			totalPoints: 1420,
			overallRank: 234567,
		},
	],
}

export const MOCK_TEAM_IDENTITY = {
	teamName: mockEntry.entryName,
	playerName: mockEntry.playerName,
	region: mockEntry.region,
	totalTransfers: mockEntry.totalTransfers,
	overallPoints: 1420,
	overallRank: 234567,
	teamValue: 1013,
	bank: 7,
	asOfGameweek: MOCK_TEAM_EVENT_ID,
} as const
