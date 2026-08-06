/**
 * TEMP data mock for /stats/team UI review.
 *
 * Flip `TEAM_STATS_UI_MOCK_ENABLED` to false (or delete this file + call sites).
 */
import type {
	EntryEventResult,
	EntryGameweekTransfers,
	EntryHistoryItem,
	EntrySeasonHistoryItem,
} from '@/lib/graphql/operations/entries'

/** Flip to false (or delete the file) to turn the mock off. */
export const TEAM_STATS_UI_MOCK_ENABLED = true

export const TEAM_STATS_MOCK_ENTRY_ID = 1
export const TEAM_STATS_MOCK_EVENT_ID = 28

function pick(
	position: number,
	webName: string,
	teamShortName: string,
	teamName: string,
	elementTypeName: string,
	totalPoints: number,
	minutes: number,
	opts?: { captain?: boolean; vice?: boolean; multiplier?: number },
): EntryEventResult['eventPicks'][number] {
	return {
		position,
		webName,
		teamShortName,
		teamName,
		elementTypeName,
		isCaptain: opts?.captain ?? false,
		isViceCaptain: opts?.vice ?? false,
		multiplier: opts?.multiplier ?? 1,
		totalPoints,
		minutes,
	}
}

export function getTeamStatsUiMockEntryEventResult(
	eventId: number = TEAM_STATS_MOCK_EVENT_ID,
	entryId: number = TEAM_STATS_MOCK_ENTRY_ID,
): EntryEventResult {
	return {
		eventId,
		eventPoints: 71,
		overallPoints: 1_482,
		overallRank: 214_500,
		eventTransfers: 2,
		eventTransfersCost: 4,
		eventNetPoints: 67,
		eventBenchPoints: 8,
		eventChip: 'NONE',
		eventCaptainPoints: 18,
		eventPlayedCaptain: { webName: 'Salah' },
		teamValue: 1015,
		bank: 12,
		entry: {
			id: entryId,
			entryName: 'Mock United',
			playerName: 'Alex Manager',
			totalTransfers: 38,
			region: 'Australia',
		},
		eventPicks: [
			pick(1, 'Raya', 'ARS', 'Arsenal', 'GKP', 6, 90),
			pick(2, 'Saliba', 'ARS', 'Arsenal', 'DEF', 8, 90),
			pick(3, 'Virgil', 'LIV', 'Liverpool', 'DEF', 9, 90),
			pick(4, 'Gabriel', 'ARS', 'Arsenal', 'DEF', 6, 90),
			pick(5, 'Salah', 'LIV', 'Liverpool', 'MID', 18, 90, {
				captain: true,
				multiplier: 2,
			}),
			pick(6, 'Palmer', 'CHE', 'Chelsea', 'MID', 12, 88),
			pick(7, 'Saka', 'ARS', 'Arsenal', 'MID', 10, 85),
			pick(8, 'Mbeumo', 'BRE', 'Brentford', 'MID', 7, 90),
			pick(9, 'Bruno', 'MUN', 'Man Utd', 'MID', 5, 78, { vice: true }),
			pick(10, 'Haaland', 'MCI', 'Man City', 'FWD', 9, 90),
			pick(11, 'Isak', 'NEW', 'Newcastle', 'FWD', 8, 90),
			pick(12, 'Pickford', 'EVE', 'Everton', 'GKP', 2, 0, { multiplier: 0 }),
			pick(13, 'Gvardiol', 'MCI', 'Man City', 'DEF', 1, 0, { multiplier: 0 }),
			pick(14, 'Gordon', 'NEW', 'Newcastle', 'MID', 3, 0, { multiplier: 0 }),
			pick(15, 'Wood', 'NFO', "Nott'm Forest", 'FWD', 2, 0, { multiplier: 0 }),
		],
	}
}

export function getTeamStatsUiMockHistory(
	eventId: number = TEAM_STATS_MOCK_EVENT_ID,
): {
	results: EntryHistoryItem[]
	history: EntrySeasonHistoryItem[]
} {
	const results: EntryHistoryItem[] = []
	for (let gw = eventId; gw >= Math.max(1, eventId - 7); gw -= 1) {
		results.push({
			eventId: gw,
			eventChip:
				gw === eventId - 2
					? 'BENCH_BOOST'
					: gw === eventId - 5
						? 'TRIPLE_CAPTAIN'
						: 'NONE',
			eventPoints: 48 + ((eventId - gw) % 5) * 4,
			eventRank: 180_000 + gw * 1200,
			overallPoints: 1_000 + (gw - 1) * 55,
			overallRank: 400_000 - gw * 6500,
			eventTransfers: gw === eventId ? 2 : gw % 3 === 0 ? 1 : 0,
			eventTransfersCost: gw === eventId ? 4 : 0,
			eventNetPoints: 48 + ((eventId - gw) % 5) * 4 - (gw === eventId ? 4 : 0),
			teamValue: 990 + gw,
			bank: 5 + (gw % 4),
		})
	}
	return {
		results,
		history: [
			{ season: '2024/25', totalPoints: 2_210, overallRank: 98_400 },
			{ season: '2023/24', totalPoints: 2_050, overallRank: 210_300 },
		],
	}
}

export function getTeamStatsUiMockTransfers(
	eventId: number = TEAM_STATS_MOCK_EVENT_ID,
): EntryGameweekTransfers[] {
	return [
		{
			eventId,
			eventTransfers: 2,
			eventTransfersCost: 4,
			transfers: [
				{
					event: eventId,
					elementInWebName: 'Palmer',
					elementInTypeName: 'MID',
					elementInTeamShortName: 'CHE',
					elementInCost: 108,
					elementOutWebName: 'Foden',
					elementOutTypeName: 'MID',
					elementOutTeamShortName: 'MCI',
					elementOutCost: 92,
					time: '2026-03-01T10:00:00Z',
				},
				{
					event: eventId,
					elementInWebName: 'Isak',
					elementInTypeName: 'FWD',
					elementInTeamShortName: 'NEW',
					elementInCost: 91,
					elementOutWebName: 'Watkins',
					elementOutTypeName: 'FWD',
					elementOutTeamShortName: 'AVL',
					elementOutCost: 89,
					time: '2026-03-01T10:01:00Z',
				},
			],
		},
		{
			eventId: eventId - 1,
			eventTransfers: 1,
			eventTransfersCost: 0,
			transfers: [
				{
					event: eventId - 1,
					elementInWebName: 'Saka',
					elementInTypeName: 'MID',
					elementInTeamShortName: 'ARS',
					elementInCost: 102,
					elementOutWebName: 'Gordon',
					elementOutTypeName: 'MID',
					elementOutTeamShortName: 'NEW',
					elementOutCost: 75,
					time: '2026-02-22T11:00:00Z',
				},
			],
		},
	]
}
