import type {
	EntryEventPick,
	EntryEventResult,
	EntryHistoryItem,
	EntrySeasonHistoryItem
} from '@/lib/graphql/operations/entries'
import type { MyFplManagerReview } from '@/lib/graphql/operations/my-fpl'

export const MOCK_TEAM_ENTRY_ID = 24001
export const MOCK_TEAM_EVENT_ID = 22

type MockPickInput = Pick<
	EntryEventPick,
	| 'element'
	| 'position'
	| 'webName'
	| 'teamName'
	| 'teamShortName'
	| 'elementTypeName'
	| 'totalPoints'
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
		expectedGoalsConceded: 0
	}
}

const mockPicks: EntryEventPick[] = [
	createMockPick({
		element: 1,
		position: 1,
		webName: 'Raya',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		elementTypeName: 'GKP',
		totalPoints: 6,
		cleanSheets: 1,
		isViceCaptain: true
	}),
	createMockPick({
		element: 2,
		position: 2,
		webName: 'Gabriel',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		elementTypeName: 'DEF',
		totalPoints: 6,
		cleanSheets: 1
	}),
	createMockPick({
		element: 3,
		position: 3,
		webName: 'Gvardiol',
		teamName: 'Manchester City',
		teamShortName: 'MCI',
		elementTypeName: 'DEF',
		totalPoints: 11,
		cleanSheets: 1
	}),
	createMockPick({
		element: 4,
		position: 4,
		webName: 'Senesi',
		teamName: 'Bournemouth',
		teamShortName: 'BOU',
		elementTypeName: 'DEF',
		totalPoints: 14,
		goalsScored: 1
	}),
	createMockPick({
		element: 5,
		position: 5,
		webName: 'Szoboszlai',
		teamName: 'Liverpool',
		teamShortName: 'LIV',
		elementTypeName: 'MID',
		totalPoints: 13,
		goalsScored: 1,
		bonus: 2
	}),
	createMockPick({
		element: 6,
		position: 6,
		webName: 'Saka',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		elementTypeName: 'MID',
		totalPoints: 9,
		assists: 1
	}),
	createMockPick({
		element: 7,
		position: 7,
		webName: 'Palmer',
		teamName: 'Chelsea',
		teamShortName: 'CHE',
		elementTypeName: 'MID',
		totalPoints: 7,
		assists: 1
	}),
	createMockPick({
		element: 8,
		position: 8,
		webName: 'B.Fernandes',
		teamName: 'Manchester United',
		teamShortName: 'MUN',
		elementTypeName: 'MID',
		totalPoints: 5
	}),
	createMockPick({
		element: 9,
		position: 9,
		webName: 'João Pedro',
		teamName: 'Chelsea',
		teamShortName: 'CHE',
		elementTypeName: 'FWD',
		totalPoints: 8,
		goalsScored: 1
	}),
	createMockPick({
		element: 10,
		position: 10,
		webName: 'Gyökeres',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		elementTypeName: 'FWD',
		totalPoints: 32,
		goalsScored: 2,
		bonus: 3,
		isCaptain: true
	}),
	createMockPick({
		element: 11,
		position: 11,
		webName: 'Thiago',
		teamName: 'Brentford',
		teamShortName: 'BRE',
		elementTypeName: 'FWD',
		totalPoints: 6
	}),
	createMockPick({
		element: 12,
		position: 12,
		webName: 'Pickford',
		teamName: 'Everton',
		teamShortName: 'EVE',
		elementTypeName: 'GKP',
		totalPoints: 2
	}),
	createMockPick({
		element: 13,
		position: 13,
		webName: 'Saliba',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		elementTypeName: 'DEF',
		totalPoints: 2
	}),
	createMockPick({
		element: 14,
		position: 14,
		webName: 'Gordon',
		teamName: 'Newcastle United',
		teamShortName: 'NEW',
		elementTypeName: 'MID',
		totalPoints: 3
	}),
	createMockPick({
		element: 15,
		position: 15,
		webName: 'Havertz',
		teamName: 'Arsenal',
		teamShortName: 'ARS',
		elementTypeName: 'FWD',
		totalPoints: 1
	})
]

const mockEntry = {
	id: MOCK_TEAM_ENTRY_ID,
	entryName: 'Wildcard Atelier',
	playerName: 'Preview Manager',
	totalTransfers: 18,
	region: 'AU'
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
	entry: mockEntry
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
			mockEventPoints(priorIndex + 1)
		).reduce((sum, points) => sum + points, 0)
		return {
			eventId,
			eventChip:
				eventId === 8
					? 'TRIPLE_CAPTAIN'
					: eventId === MOCK_TEAM_EVENT_ID
						? 'WILDCARD'
						: 'NONE',
			eventPoints,
			eventRank: 500000 - eventId * 12000,
			overallPoints: priorPoints + eventPoints,
			overallRank:
				eventId === MOCK_TEAM_EVENT_ID ? 234567 : 500000 - eventId * 12000,
			eventTransfers: eventId % 5 === 0 ? 1 : 0,
			eventTransfersCost: eventId % 5 === 0 ? 4 : 0,
			eventNetPoints: eventPoints - (eventId % 5 === 0 ? 4 : 0),
			eventBenchPoints: eventId % 4 === 0 ? 8 : 2,
			eventCaptainPoints: eventId === MOCK_TEAM_EVENT_ID ? 64 : 12,
			eventPlayedCaptain: {
				webName: eventId % 2 === 0 ? 'Gyökeres' : 'Saka',
				team: { shortName: 'ARS' }
			},
			teamValue: 980 + eventId,
			bank: 5
		}
	}),
	history: [
		{
			season: '2025/26',
			totalPoints: 1420,
			overallRank: 234567
		}
	]
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
	asOfGameweek: MOCK_TEAM_EVENT_ID
} as const

const mockTimeline: MyFplManagerReview['timeline'] =
	MOCK_TEAM_HISTORY.results.map((row, index, rows) => {
		const previousRank = rows[index - 1]?.overallRank ?? null
		const captain = row.eventPlayedCaptain?.webName ?? null
		const formation =
			index % 3 === 0 ? '3-5-2' : index % 3 === 1 ? '4-4-2' : '3-4-3'
		return {
			eventId: row.eventId,
			status: row.eventId === MOCK_TEAM_EVENT_ID ? 'PROVISIONAL' : 'FINAL',
			eventPoints: row.eventPoints,
			eventRank: row.eventRank,
			overallPoints: row.overallPoints,
			overallRank: row.overallRank,
			overallRankDelta:
				row.eventId === MOCK_TEAM_EVENT_ID ||
				previousRank == null ||
				row.overallRank == null
					? null
					: previousRank - row.overallRank,
			eventTransfers: row.eventTransfers,
			eventTransfersCost: row.eventTransfersCost,
			eventNetPoints: row.eventNetPoints,
			eventBenchPoints: row.eventBenchPoints,
			eventAutoSubPoints: row.eventId % 7 === 0 ? 6 : 0,
			eventChip: row.eventChip,
			eventCaptainPoints: row.eventCaptainPoints,
			captainWebName: captain,
			captainTeamShortName: 'ARS',
			teamValue: row.teamValue,
			bank: row.bank,
			review: {
				formation,
				lineupBasePoints: Math.max(
					0,
					row.eventPoints - row.eventCaptainPoints / 2
				),
				bestElevenPoints: row.eventPoints + (row.eventId % 4),
				benchRegretPoints:
					row.eventId === MOCK_TEAM_EVENT_ID ? null : row.eventId % 4,
				positionPoints: {
					goalkeeper: 5 + (row.eventId % 3),
					defender: 18 + (row.eventId % 5),
					midfielder: 24 + (row.eventId % 7),
					forward: 15 + (row.eventId % 6),
					assistantManager: 0,
					total: row.eventPoints
				},
				captain: {
					captainElement: row.eventId % 2 === 0 ? 10 : 6,
					captainWebName: captain,
					captainTeamShortName: 'ARS',
					captainBasePoints: Math.floor(row.eventCaptainPoints / 2),
					captainContribution: row.eventCaptainPoints,
					viceCaptainElement: 1,
					viceCaptainWebName: 'Raya',
					viceCaptainBasePoints: 6,
					bestSquadElement: 10,
					bestSquadWebName: 'Gyökeres',
					bestSquadPoints: 16,
					regretPoints:
						row.eventId === MOCK_TEAM_EVENT_ID ? null : row.eventId % 5
				},
				automaticSubstitutions:
					row.eventId % 7 === 0
						? [
								{
									elementIn: 13,
									elementInWebName: 'Saliba',
									elementOut: 3,
									elementOutWebName: 'Gvardiol',
									pointsGained: 6
								}
							]
						: []
			}
		}
	})

const totalNetPoints = mockTimeline.reduce(
	(total, row) => total + row.eventNetPoints,
	0
)
const totalBenchPoints = mockTimeline.reduce(
	(total, row) => total + row.eventBenchPoints,
	0
)
const totalCaptainPoints = mockTimeline.reduce(
	(total, row) => total + row.eventCaptainPoints,
	0
)

export const MOCK_MANAGER_REVIEW: MyFplManagerReview = {
	state: 'READY',
	context: {
		season: '2627',
		coreRevision: 'preview-core-22',
		currentEventId: MOCK_TEAM_EVENT_ID,
		nextEventId: MOCK_TEAM_EVENT_ID + 1,
		latestFinalizedEventId: MOCK_TEAM_EVENT_ID - 1,
		latestPublishedEventId: MOCK_TEAM_EVENT_ID
	},
	entry: {
		id: MOCK_TEAM_ENTRY_ID,
		entryName: mockEntry.entryName,
		playerName: mockEntry.playerName,
		region: mockEntry.region,
		startedEvent: 1,
		overallPoints: 1420,
		overallRank: 234567,
		bank: 7,
		teamValue: 1013,
		totalTransfers: mockEntry.totalTransfers
	},
	throughEventId: MOCK_TEAM_EVENT_ID,
	timeline: mockTimeline,
	summary: {
		gameweeksReviewed: mockTimeline.length,
		provisionalGameweeks: 1,
		totalNetPoints,
		averageNetPoints: totalNetPoints / mockTimeline.length,
		medianNetPoints: 62,
		bestGameweekId: MOCK_TEAM_EVENT_ID,
		bestNetPoints: 117,
		worstGameweekId: 5,
		worstNetPoints: 58,
		totalHitPoints: 16,
		hitGameweeks: 4,
		totalBenchPoints,
		averageBenchPoints: totalBenchPoints / mockTimeline.length,
		zeroBenchGameweeks: 0,
		highBenchGameweeks: 5,
		totalAutoSubPoints: 18,
		autoSubGameweeks: 3,
		totalCaptainPoints,
		uniqueCaptains: 2,
		captainBlankGameweeks: 2,
		topCaptainWebName: 'Gyökeres',
		topCaptainGameweeks: 11,
		topCaptainRate: 50,
		bestOverallRank: 234567,
		worstOverallRank: 488000,
		overallRankChange: 253433,
		currentImprovementStreak: 4,
		longestImprovementStreak: 7,
		formations: [
			{ formation: '3-5-2', gameweeks: 8 },
			{ formation: '4-4-2', gameweeks: 7 },
			{ formation: '3-4-3', gameweeks: 7 }
		],
		positionPoints: {
			goalkeeper: 128,
			defender: 412,
			midfielder: 527,
			forward: 353,
			assistantManager: 0,
			total: 1420
		},
		chips: [
			{
				chip: 'TRIPLE_CAPTAIN',
				eventId: 8,
				status: 'FINAL',
				eventNetPoints: 62,
				otherGameweeksAverageNetPoints: 64.7,
				differenceFromOtherGameweeks: -2.7,
				overallRankDelta: 12000
			},
			{
				chip: 'WILDCARD',
				eventId: MOCK_TEAM_EVENT_ID,
				status: 'PROVISIONAL',
				eventNetPoints: 117,
				otherGameweeksAverageNetPoints: 61.8,
				differenceFromOtherGameweeks: null,
				overallRankDelta: null
			}
		]
	},
	holdings: [
		{
			element: 10,
			webName: 'Gyökeres',
			teamShortName: 'ARS',
			elementTypeName: 'FWD',
			startedEventId: 1,
			endedEventId: null,
			gameweeksHeld: 22,
			starts: 22,
			captaincies: 11,
			pointsWhileOwned: 186,
			scoringContribution: 274
		},
		{
			element: 6,
			webName: 'Saka',
			teamShortName: 'ARS',
			elementTypeName: 'MID',
			startedEventId: 1,
			endedEventId: null,
			gameweeksHeld: 22,
			starts: 21,
			captaincies: 11,
			pointsWhileOwned: 151,
			scoringContribution: 215
		},
		{
			element: 7,
			webName: 'Palmer',
			teamShortName: 'CHE',
			elementTypeName: 'MID',
			startedEventId: 6,
			endedEventId: null,
			gameweeksHeld: 17,
			starts: 16,
			captaincies: 0,
			pointsWhileOwned: 119,
			scoringContribution: 112
		}
	],
	transfers: [
		{
			eventId: 18,
			eventTransfers: 1,
			eventTransfersCost: 0,
			transfers: [
				{
					eventId: 18,
					elementIn: 7,
					elementInWebName: 'Palmer',
					elementInTypeName: 'MID',
					elementInTeamShortName: 'CHE',
					elementInCost: 104,
					elementInPoints: 9,
					elementInPlayed: true,
					elementOut: 18,
					elementOutWebName: 'Foden',
					elementOutTypeName: 'MID',
					elementOutTeamShortName: 'MCI',
					elementOutCost: 91,
					elementOutPoints: 2,
					sameGameweekGain: 7,
					threeGameweekGain: 15,
					fiveGameweekGain: 21,
					evaluatedThroughEventId: 22,
					time: '2027-01-02T10:30:00.000Z'
				}
			]
		}
	],
	pastSeasons: MOCK_TEAM_HISTORY.history,
	pastSeasonsState: 'READY',
	currentGameweek: null,
	rules: {
		squadSize: 15,
		startingSize: 11,
		budget: 1000,
		maxPlayersPerTeam: 3,
		currencyMultiplier: 10,
		positions: [
			{
				id: 1,
				name: 'Goalkeeper',
				shortName: 'GKP',
				squadSelect: 2,
				minPlay: 1,
				maxPlay: 1
			},
			{
				id: 2,
				name: 'Defender',
				shortName: 'DEF',
				squadSelect: 5,
				minPlay: 3,
				maxPlay: 5
			},
			{
				id: 3,
				name: 'Midfielder',
				shortName: 'MID',
				squadSelect: 5,
				minPlay: 2,
				maxPlay: 5
			},
			{
				id: 4,
				name: 'Forward',
				shortName: 'FWD',
				squadSelect: 3,
				minPlay: 1,
				maxPlay: 3
			}
		],
		chips: [
			{
				id: 1,
				name: 'wildcard',
				number: 1,
				startEvent: 1,
				stopEvent: 19,
				chipType: 'transfer'
			},
			{
				id: 2,
				name: 'freehit',
				number: 1,
				startEvent: 1,
				stopEvent: 19,
				chipType: 'transfer'
			},
			{
				id: 3,
				name: 'bboost',
				number: 1,
				startEvent: 1,
				stopEvent: 19,
				chipType: 'scoring'
			},
			{
				id: 4,
				name: '3xc',
				number: 1,
				startEvent: 1,
				stopEvent: 19,
				chipType: 'scoring'
			},
			{
				id: 5,
				name: 'wildcard',
				number: 1,
				startEvent: 20,
				stopEvent: 38,
				chipType: 'transfer'
			},
			{
				id: 6,
				name: 'freehit',
				number: 1,
				startEvent: 20,
				stopEvent: 38,
				chipType: 'transfer'
			},
			{
				id: 7,
				name: 'bboost',
				number: 1,
				startEvent: 20,
				stopEvent: 38,
				chipType: 'scoring'
			},
			{
				id: 8,
				name: '3xc',
				number: 1,
				startEvent: 20,
				stopEvent: 38,
				chipType: 'scoring'
			}
		]
	},
	snapshotMeta: {
		revision: '2200',
		eventId: MOCK_TEAM_EVENT_ID,
		snapshotDate: '2027-01-09',
		sourceCheckedAt: '2027-01-09T02:42:00.000Z',
		publishedAt: '2027-01-09T02:45:00.000Z',
		settlementState: 'PROVISIONAL',
		coverageState: 'COMPLETE',
		timelinessState: 'CURRENT',
		expectedEntryCount: 1,
		observedEntryCount: 1,
		finalizationStartedAt: null,
		finalizationDueAt: null,
		scoreSource: 'FPL_EVENT_LIVE',
		livePublicationId: '00000000-0000-4000-8000-000000000022',
		liveRevision: '22',
		algorithmVersion: 'live-points-v2-algorithm-1',
		sourceMinCheckedAt: '2027-01-09T02:40:00.000Z',
		sourceMaxCheckedAt: '2027-01-09T02:42:00.000Z'
	}
}
