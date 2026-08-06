/**
 * TEMP data mock for /data/player-stats UI review.
 *
 * Flip `PLAYER_STATS_UI_MOCK_ENABLED` to false (or delete this file + call sites).
 */
import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'
import type { PlayerDetailData } from '@/lib/graphql/operations/players'

/** Flip to false (or delete the file) to turn the mock off. */
export const PLAYER_STATS_UI_MOCK_ENABLED = true

export const PLAYER_STATS_MOCK_EVENT_ID = 28

export const PLAYER_STATS_MOCK_PLAYERS: PlayerDirectoryOption[] = [
	{
		id: '351',
		name: 'Salah',
		position: 'MID',
		teamShortName: 'LIV',
		teamName: 'Liverpool',
	},
	{
		id: '10',
		name: 'Haaland',
		position: 'FWD',
		teamShortName: 'MCI',
		teamName: 'Man City',
	},
	{
		id: '131',
		name: 'Palmer',
		position: 'MID',
		teamShortName: 'CHE',
		teamName: 'Chelsea',
	},
]

function fixturesFor(
	opponents: Array<{
		gw: number
		team: string
		home: boolean
		finished: boolean
		score: string | null
		difficulty: number
	}>,
): PlayerDetailData['fixtures'] {
	return opponents.map(item => ({
		event: item.gw,
		againstTeamShortName: item.team,
		wasHome: item.home,
		finished: item.finished,
		kickoffTime: `2026-0${Math.min(9, Math.floor(item.gw / 4) + 1)}-0${(item.gw % 7) + 1}T15:00:00Z`,
		score: item.score,
		difficulty: item.difficulty,
		bgw: false,
	}))
}

const MOCK_DETAILS: Record<number, PlayerDetailData> = {
	351: {
		id: 351,
		webName: 'Salah',
		teamShortName: 'LIV',
		elementType: 3,
		elementTypeName: 'Midfielder',
		price: 134,
		startPrice: 125,
		totalPoints: 198,
		selectedByPercent: 62.1,
		form: 8.4,
		seasonTransfersIn: 1_240_000,
		seasonTransfersOut: 410_000,
		transfersInEvent: 610_400,
		transfersOutEvent: 88_000,
		eventPoints: 18,
		minutes: 2_340,
		goalsScored: 18,
		assists: 12,
		cleanSheets: 8,
		goalsConceded: 22,
		ownGoals: 0,
		penaltiesSaved: 0,
		yellowCards: 2,
		redCards: 0,
		saves: 0,
		bonus: 28,
		bps: 620,
		influence: 980,
		creativity: 720,
		threat: 1_150,
		ictIndex: 285,
		fixtures: fixturesFor([
			{ gw: 26, team: 'MUN', home: true, finished: true, score: '2-1', difficulty: 3 },
			{ gw: 27, team: 'CHE', home: false, finished: true, score: '1-1', difficulty: 3 },
			{ gw: 28, team: 'ARS', home: true, finished: false, score: null, difficulty: 4 },
			{ gw: 29, team: 'BHA', home: false, finished: false, score: null, difficulty: 2 },
			{ gw: 30, team: 'EVE', home: true, finished: false, score: null, difficulty: 2 },
			{ gw: 31, team: 'MCI', home: false, finished: false, score: null, difficulty: 5 },
		]),
	},
	10: {
		id: 10,
		webName: 'Haaland',
		teamShortName: 'MCI',
		elementType: 4,
		elementTypeName: 'Forward',
		price: 149,
		startPrice: 140,
		totalPoints: 176,
		selectedByPercent: 55.0,
		form: 7.1,
		seasonTransfersIn: 980_000,
		seasonTransfersOut: 520_000,
		transfersInEvent: 401_200,
		transfersOutEvent: 120_500,
		eventPoints: 13,
		minutes: 2_180,
		goalsScored: 22,
		assists: 4,
		cleanSheets: 0,
		goalsConceded: 0,
		ownGoals: 0,
		penaltiesSaved: 0,
		yellowCards: 1,
		redCards: 0,
		saves: 0,
		bonus: 22,
		bps: 540,
		influence: 860,
		creativity: 210,
		threat: 1_480,
		ictIndex: 255,
		fixtures: fixturesFor([
			{ gw: 26, team: 'TOT', home: true, finished: true, score: '3-0', difficulty: 3 },
			{ gw: 27, team: 'NFO', home: false, finished: true, score: '2-1', difficulty: 2 },
			{ gw: 28, team: 'LIV', home: true, finished: false, score: null, difficulty: 4 },
			{ gw: 29, team: 'AVL', home: false, finished: false, score: null, difficulty: 3 },
			{ gw: 30, team: 'WHU', home: true, finished: false, score: null, difficulty: 2 },
			{ gw: 31, team: 'LIV', home: true, finished: false, score: null, difficulty: 5 },
		]),
	},
	131: {
		id: 131,
		webName: 'Palmer',
		teamShortName: 'CHE',
		elementType: 3,
		elementTypeName: 'Midfielder',
		price: 108,
		startPrice: 100,
		totalPoints: 142,
		selectedByPercent: 48.2,
		form: 7.8,
		seasonTransfersIn: 1_520_000,
		seasonTransfersOut: 280_000,
		transfersInEvent: 892_100,
		transfersOutEvent: 41_200,
		eventPoints: 14,
		minutes: 2_250,
		goalsScored: 12,
		assists: 9,
		cleanSheets: 6,
		goalsConceded: 28,
		ownGoals: 0,
		penaltiesSaved: 0,
		yellowCards: 3,
		redCards: 0,
		saves: 0,
		bonus: 18,
		bps: 490,
		influence: 740,
		creativity: 680,
		threat: 820,
		ictIndex: 224,
		fixtures: fixturesFor([
			{ gw: 26, team: 'SOU', home: true, finished: true, score: '2-0', difficulty: 2 },
			{ gw: 27, team: 'LIV', home: true, finished: true, score: '1-1', difficulty: 4 },
			{ gw: 28, team: 'BHA', home: false, finished: false, score: null, difficulty: 3 },
			{ gw: 29, team: 'FUL', home: true, finished: false, score: null, difficulty: 2 },
			{ gw: 30, team: 'ARS', home: false, finished: false, score: null, difficulty: 4 },
			{ gw: 31, team: 'NEW', home: true, finished: false, score: null, difficulty: 3 },
		]),
	},
}

export function getPlayerStatsUiMockDetail(playerId: number): PlayerDetailData | null {
	return MOCK_DETAILS[playerId] ?? null
}

/** Fallback detail when an unknown player id is selected under mock mode. */
export function getPlayerStatsUiMockDetailFallback(
	playerId: number,
	webName = 'Mock Player',
	teamShortName = 'MCK',
): PlayerDetailData {
	const base = MOCK_DETAILS[351]
	return {
		...base,
		id: playerId,
		webName,
		teamShortName,
		totalPoints: 80,
		eventPoints: 6,
		selectedByPercent: 12.5,
	}
}
