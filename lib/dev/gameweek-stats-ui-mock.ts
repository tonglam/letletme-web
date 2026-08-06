/**
 * TEMP data mock for /stats/gameweek UI review.
 *
 * Flip `GAMEWEEK_STATS_UI_MOCK_ENABLED` to false (or delete this file + call sites).
 */
import type { OverallGameweekStats } from '@/lib/gameweek-overall-stats'
import type { LiveScoresResponse } from '@/lib/graphql/operations/live'
import type { TopTransfer, TopTransfersResponse } from '@/lib/graphql/operations/prices'

/** Flip to false (or delete the file) to turn the mock off. */
export const GAMEWEEK_STATS_UI_MOCK_ENABLED = true

/** Used when backend has no isCurrent event. */
export const GAMEWEEK_STATS_MOCK_EVENT_ID = 28

export function getGameweekStatsUiMockOverall(
	_eventId: number = GAMEWEEK_STATS_MOCK_EVENT_ID,
): OverallGameweekStats {
	return {
		averagePoints: 48,
		highestPoints: 112,
		mostCaptained: { name: 'Salah', count: 4_200_000 },
		mostViceCaptained: { name: 'Haaland' },
		mostTransferredIn: { name: 'Palmer', team: 'CHE', count: 890_000 },
		mostSelectedPlayer: { name: 'Salah', id: 351 },
		mostTransferInPlayer: { name: 'Palmer', id: 131 },
		chipsPlayed: {
			benchBoost: 312_000,
			tripleCaptain: 185_000,
			wildcard: 94_000,
			freeHit: 41_000,
		},
	}
}

export function getGameweekStatsUiMockLiveScores(
	_eventId: number = GAMEWEEK_STATS_MOCK_EVENT_ID,
): LiveScoresResponse {
	return {
		liveScores: [
			// —— GKP ——
			{
				player: {
					id: 1,
					webName: 'Raya',
					position: 'GKP',
					price: 55,
					team: { name: 'Arsenal', shortName: 'ARS' },
				},
				inDreamTeam: true,
				minutes: 90,
				goalsScored: 0,
				assists: 0,
				cleanSheets: 1,
				bonus: 2,
				totalPoints: 9,
			},
			// —— DEF ——
			{
				player: {
					id: 2,
					webName: 'Saliba',
					position: 'DEF',
					price: 62,
					team: { name: 'Arsenal', shortName: 'ARS' },
				},
				inDreamTeam: true,
				minutes: 90,
				goalsScored: 0,
				assists: 1,
				cleanSheets: 1,
				bonus: 1,
				totalPoints: 11,
			},
			{
				player: {
					id: 3,
					webName: 'Virgil',
					position: 'DEF',
					price: 64,
					team: { name: 'Liverpool', shortName: 'LIV' },
				},
				inDreamTeam: true,
				minutes: 90,
				goalsScored: 1,
				assists: 0,
				cleanSheets: 1,
				bonus: 3,
				totalPoints: 15,
			},
			{
				player: {
					id: 4,
					webName: 'Gabriel',
					position: 'DEF',
					price: 61,
					team: { name: 'Arsenal', shortName: 'ARS' },
				},
				inDreamTeam: true,
				minutes: 90,
				goalsScored: 0,
				assists: 0,
				cleanSheets: 1,
				bonus: 0,
				totalPoints: 8,
			},
			// —— MID ——
			{
				player: {
					id: 351,
					webName: 'Salah',
					position: 'MID',
					price: 134,
					team: { name: 'Liverpool', shortName: 'LIV' },
				},
				inDreamTeam: true,
				minutes: 90,
				goalsScored: 2,
				assists: 1,
				cleanSheets: 0,
				bonus: 3,
				totalPoints: 18,
			},
			{
				player: {
					id: 131,
					webName: 'Palmer',
					position: 'MID',
					price: 108,
					team: { name: 'Chelsea', shortName: 'CHE' },
				},
				inDreamTeam: true,
				minutes: 88,
				goalsScored: 1,
				assists: 2,
				cleanSheets: 0,
				bonus: 2,
				totalPoints: 14,
			},
			{
				player: {
					id: 7,
					webName: 'Saka',
					position: 'MID',
					price: 102,
					team: { name: 'Arsenal', shortName: 'ARS' },
				},
				inDreamTeam: true,
				minutes: 85,
				goalsScored: 1,
				assists: 1,
				cleanSheets: 0,
				bonus: 1,
				totalPoints: 12,
			},
			{
				player: {
					id: 8,
					webName: 'Mbeumo',
					position: 'MID',
					price: 78,
					team: { name: 'Brentford', shortName: 'BRE' },
				},
				inDreamTeam: true,
				minutes: 90,
				goalsScored: 1,
				assists: 0,
				cleanSheets: 0,
				bonus: 0,
				totalPoints: 10,
			},
			{
				player: {
					id: 9,
					webName: 'Amad',
					position: 'MID',
					price: 55,
					team: { name: 'Man Utd', shortName: 'MUN' },
				},
				inDreamTeam: true,
				minutes: 78,
				goalsScored: 1,
				assists: 1,
				cleanSheets: 0,
				bonus: 0,
				totalPoints: 11,
			},
			// —— FWD ——
			{
				player: {
					id: 10,
					webName: 'Haaland',
					position: 'FWD',
					price: 149,
					team: { name: 'Man City', shortName: 'MCI' },
				},
				inDreamTeam: true,
				minutes: 90,
				goalsScored: 2,
				assists: 0,
				cleanSheets: 0,
				bonus: 3,
				totalPoints: 13,
			},
			{
				player: {
					id: 11,
					webName: 'Isak',
					position: 'FWD',
					price: 91,
					team: { name: 'Newcastle', shortName: 'NEW' },
				},
				inDreamTeam: true,
				minutes: 90,
				goalsScored: 1,
				assists: 1,
				cleanSheets: 0,
				bonus: 1,
				totalPoints: 10,
			},
			// Extra high haul not strictly formation (for haul tab filter ≥10)
			{
				player: {
					id: 12,
					webName: 'Wood',
					position: 'FWD',
					price: 72,
					team: { name: "Nott'm Forest", shortName: 'NFO' },
				},
				inDreamTeam: false,
				minutes: 90,
				goalsScored: 2,
				assists: 0,
				cleanSheets: 0,
				bonus: 2,
				totalPoints: 12,
			},
		],
	}
}

function transfer(
	id: number,
	webName: string,
	position: string,
	shortName: string,
	teamName: string,
	selectedByPercent: number,
	totalPoints: number,
	eventId: number,
	transfersInEvent: number,
	transfersOutEvent: number,
): TopTransfer {
	return {
		player: {
			id,
			webName,
			position,
			selectedByPercent,
			totalPoints,
			team: { name: teamName, shortName },
		},
		eventId,
		transfersInEvent,
		transfersOutEvent,
	}
}

export function getGameweekStatsUiMockTransfersIn(
	eventId: number = GAMEWEEK_STATS_MOCK_EVENT_ID,
): TopTransfersResponse {
	return {
		topTransfersIn: [
			transfer(131, 'Palmer', 'MID', 'CHE', 'Chelsea', 48.2, 142, eventId, 892_100, 41_200),
			transfer(351, 'Salah', 'MID', 'LIV', 'Liverpool', 62.1, 198, eventId, 610_400, 88_000),
			transfer(10, 'Haaland', 'FWD', 'MCI', 'Man City', 55.0, 176, eventId, 401_200, 120_500),
			transfer(7, 'Saka', 'MID', 'ARS', 'Arsenal', 39.4, 128, eventId, 355_800, 55_100),
			transfer(11, 'Isak', 'FWD', 'NEW', 'Newcastle', 28.7, 119, eventId, 298_600, 33_400),
		],
	}
}

export function getGameweekStatsUiMockTransfersOut(
	eventId: number = GAMEWEEK_STATS_MOCK_EVENT_ID,
): TopTransfersResponse {
	return {
		topTransfersOut: [
			transfer(20, 'Watkins', 'FWD', 'AVL', 'Aston Villa', 22.1, 88, eventId, 40_200, 720_300),
			transfer(21, 'Solanke', 'FWD', 'TOT', 'Tottenham', 18.4, 71, eventId, 28_100, 610_800),
			transfer(22, 'Gordon', 'MID', 'NEW', 'Newcastle', 15.2, 64, eventId, 51_000, 540_200),
			transfer(23, 'Jackson', 'FWD', 'CHE', 'Chelsea', 12.8, 59, eventId, 19_400, 488_900),
			transfer(24, 'Foden', 'MID', 'MCI', 'Man City', 25.6, 95, eventId, 77_000, 430_100),
		],
	}
}
