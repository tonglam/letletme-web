import type {
	LiveCalcData,
	LivePick,
	LiveSnapshotStatus,
} from '@/lib/graphql/operations/live'

const MOCK_EVENT_ID = 22

type MockPickInput = Pick<
	LivePick,
	'element' | 'elementType' | 'position' | 'webName' | 'teamName' | 'teamShortName' | 'totalPoints'
> & {
	isCaptain?: boolean
	isViceCaptain?: boolean
	goalsScored?: number
	assists?: number
	cleanSheets?: number
	bonus?: number
	saves?: number
}

function createMockPick(input: MockPickInput): LivePick {
	const isBench = input.position >= 12

	return {
		element: input.element,
		elementType: input.elementType,
		position: input.position,
		webName: input.webName,
		teamName: input.teamName,
		teamShortName: input.teamShortName,
		minutes: isBench ? 0 : 90,
		goalsScored: input.goalsScored ?? 0,
		assists: input.assists ?? 0,
		cleanSheets: input.cleanSheets ?? 0,
		goalsConceded: 0,
		defensiveContribution: 0,
		ownGoals: 0,
		penaltiesSaved: 0,
		penaltiesMissed: 0,
		yellowCards: 0,
		redCards: 0,
		saves: input.saves ?? 0,
		bonus: input.bonus ?? 0,
		bps: 50,
		totalPoints: input.totalPoints,
		starts: !isBench,
		isGwStarted: !isBench,
		isGwFinished: true,
		isPlayed: !isBench,
		isCaptain: input.isCaptain ?? false,
		isViceCaptain: input.isViceCaptain ?? false,
		expectedGoals: 0,
		expectedAssists: 0,
		expectedGoalInvolvements: 0,
		expectedGoalsConceded: 0,
		inDreamTeam: false,
	}
}

const mockPickList: LivePick[] = [
	createMockPick({
		element: 1,
		elementType: 1,
		position: 1,
		webName: 'Raya',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		totalPoints: 6,
		cleanSheets: 1,
		isViceCaptain: true,
	}),
	createMockPick({
		element: 2,
		elementType: 2,
		position: 2,
		webName: 'Gabriel',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		totalPoints: 6,
		cleanSheets: 1,
	}),
	createMockPick({
		element: 3,
		elementType: 2,
		position: 3,
		webName: 'Gvardiol',
		teamName: 'Manchester City',
		teamShortName: 'MCI',
		totalPoints: 11,
		cleanSheets: 1,
	}),
	createMockPick({
		element: 4,
		elementType: 2,
		position: 4,
		webName: 'Senesi',
		teamName: 'Bournemouth',
		teamShortName: 'BOU',
		totalPoints: 14,
		goalsScored: 1,
	}),
	createMockPick({
		element: 5,
		elementType: 3,
		position: 5,
		webName: 'Szoboszlai',
		teamName: 'Liverpool',
		teamShortName: 'LIV',
		totalPoints: 13,
		goalsScored: 1,
		bonus: 2,
	}),
	createMockPick({
		element: 6,
		elementType: 3,
		position: 6,
		webName: 'Saka',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		totalPoints: 9,
		assists: 1,
	}),
	createMockPick({
		element: 7,
		elementType: 3,
		position: 7,
		webName: 'Palmer',
		teamName: 'Chelsea',
		teamShortName: 'CHE',
		totalPoints: 7,
		assists: 1,
	}),
	createMockPick({
		element: 8,
		elementType: 3,
		position: 8,
		webName: 'B.Fernandes',
		teamName: 'Manchester United',
		teamShortName: 'MUN',
		totalPoints: 5,
	}),
	createMockPick({
		element: 9,
		elementType: 4,
		position: 9,
		webName: 'João Pedro',
		teamName: 'Chelsea',
		teamShortName: 'CHE',
		totalPoints: 8,
		goalsScored: 1,
	}),
	createMockPick({
		element: 10,
		elementType: 4,
		position: 10,
		webName: 'Gyökeres',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		totalPoints: 32,
		goalsScored: 2,
		bonus: 3,
		isCaptain: true,
	}),
	createMockPick({
		element: 11,
		elementType: 4,
		position: 11,
		webName: 'Thiago',
		teamName: 'Brentford',
		teamShortName: 'BRE',
		totalPoints: 6,
	}),
	createMockPick({
		element: 12,
		elementType: 1,
		position: 12,
		webName: 'Pickford',
		teamName: 'Everton',
		teamShortName: 'EVE',
		totalPoints: 2,
	}),
	createMockPick({
		element: 13,
		elementType: 2,
		position: 13,
		webName: 'Saliba',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		totalPoints: 2,
	}),
	createMockPick({
		element: 14,
		elementType: 3,
		position: 14,
		webName: 'Gordon',
		teamName: 'Newcastle United',
		teamShortName: 'NEW',
		totalPoints: 3,
	}),
	createMockPick({
		element: 15,
		elementType: 4,
		position: 15,
		webName: 'Havertz',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		totalPoints: 1,
	}),
]

export const MOCK_LIVE_DATA: LiveCalcData = {
	entry: 24001,
	event: MOCK_EVENT_ID,
	entryName: 'Wildcard Atelier',
	playerName: 'Preview Manager',
	chip: 'wildcard',
	livePoints: 117,
	transferCost: 0,
	liveNetPoints: 117,
	liveTotalPoints: 149,
	captainName: 'Gyökeres',
	pickList: mockPickList,
}

export const MOCK_LIVE_SNAPSHOT: LiveSnapshotStatus = {
	eventId: MOCK_EVENT_ID,
	revision: 'mock-revision-1',
	state: 'SETTLED',
	publishedAt: '2026-08-16T00:00:00.000Z',
	checkedAt: '2026-08-16T00:00:00.000Z',
}

export const MOCK_LIVE_OVERALL = {
	overallPoints: 1420,
	overallRank: 234567,
	teamValue: 1013,
	bank: 7,
	totalTransfers: 18,
} as const

export function createMockLiveData(entryId: number): LiveCalcData {
	return {
		...MOCK_LIVE_DATA,
		entry: entryId,
	}
}
