/**
 * TEMP data mock for /stats/tournament UI review.
 *
 * Flip `TOURNAMENT_STATS_UI_MOCK_ENABLED` to false (or delete this file + call sites).
 */
import type {
	EntryTournament,
	TournamentEntryRankingSummary,
	TournamentEventResultItem,
} from '@/lib/graphql/operations/tournaments'

type PlayerMeta = { webName: string; teamShortName: string }

/** Flip to false (or delete the file) to turn the mock off. */
export const TOURNAMENT_STATS_UI_MOCK_ENABLED = true

export const TOURNAMENT_STATS_MOCK_ENTRY_ID = 1
export const TOURNAMENT_STATS_MOCK_EVENT_ID = 28
export const TOURNAMENT_STATS_MOCK_TOURNAMENT_ID = 1001

export function getTournamentStatsUiMockTournament(
	entryId: number = TOURNAMENT_STATS_MOCK_ENTRY_ID,
): EntryTournament {
	const now = '2026-03-01T12:00:00.000Z'
	return {
		id: TOURNAMENT_STATS_MOCK_TOURNAMENT_ID,
		name: 'Office Classic League',
		creator: 'Alex Manager',
		adminEntryId: entryId,
		leagueId: 314159,
		leagueType: 'Classic',
		sourceLeagueName: 'Office FPL',
		totalTeamNum: 12,
		tournamentMode: 'GROUP',
		groupMode: 'POINTS_RACES',
		groupTeamNum: 12,
		groupNum: 1,
		groupStartedEventId: 1,
		groupEndedEventId: 38,
		groupAutoAverages: false,
		groupRounds: null,
		groupPlayAgainstNum: null,
		groupQualifyNum: null,
		knockoutMode: 'NONE',
		knockoutTeamNum: null,
		knockoutRounds: null,
		knockoutEventNum: null,
		knockoutStartedEventId: null,
		knockoutEndedEventId: null,
		knockoutPlayAgainstNum: null,
		state: 'ACTIVE',
		rosterMode: 'SNAPSHOT',
		rosterSyncStatus: 'READY',
		rosterLastSyncedAt: now,
		setupStatus: 'READY',
		setupPhase: 'READY',
		setupCompletedUnits: 12,
		setupTotalUnits: 12,
		setupProgressUpdatedAt: now,
		standingsReadyAt: now,
		setupHasWarnings: false,
		setupStartedAt: now,
		setupFinishedAt: now,
		createdAt: now,
		updatedAt: now,
	}
}

function resultRow(
	tournament: EntryTournament,
	eventId: number,
	entryId: number,
	rank: number,
	entryName: string,
	playerName: string,
	eventPoints: number,
	eventCost: number,
	overallPoints: number,
	overallRank: number,
	captainId: number,
	captainPoints: number,
	chip: string | null = null,
): TournamentEventResultItem {
	return {
		tournament,
		event: { id: eventId, name: `Gameweek ${eventId}` },
		groupId: 1,
		entryId,
		entryName,
		playerName,
		eventGroupRank: rank,
		eventPoints,
		eventCost,
		eventNetPoints: eventPoints - eventCost,
		eventRank: overallRank - 1_000 + rank * 100,
		overallPoints,
		overallRank,
		eventChip: chip,
		captainId,
		captainPoints,
		teamValue: 1000 + rank * 3,
		bank: rank,
	}
}

export function getTournamentStatsUiMockEventResults(
	eventId: number = TOURNAMENT_STATS_MOCK_EVENT_ID,
	entryId: number = TOURNAMENT_STATS_MOCK_ENTRY_ID,
): TournamentEventResultItem[] {
	const tournament = getTournamentStatsUiMockTournament(entryId)
	return [
		resultRow(tournament, eventId, 11, 1, 'Green Machine', 'Sam Green', 84, 0, 1_620, 42_100, 351, 18),
		resultRow(tournament, eventId, entryId, 2, 'Mock United', 'Alex Manager', 71, 4, 1_482, 214_500, 351, 18),
		resultRow(tournament, eventId, 12, 3, 'Blue Mooners', 'Chris Blue', 69, 0, 1_510, 180_200, 10, 13, 'BENCH_BOOST'),
		resultRow(tournament, eventId, 13, 4, 'Red Devils FC', 'Pat Red', 65, 4, 1_390, 310_000, 131, 14),
		resultRow(tournament, eventId, 14, 5, 'Toon Army', 'Jamie Black', 62, 0, 1_350, 400_500, 7, 12),
		resultRow(tournament, eventId, 15, 6, 'Villa Vista', 'Riley Gray', 58, 0, 1_280, 520_100, 351, 10, 'TRIPLE_CAPTAIN'),
		resultRow(tournament, eventId, 16, 7, 'Spurs Sparks', 'Taylor White', 55, 8, 1_210, 610_800, 10, 9),
		resultRow(tournament, eventId, 17, 8, 'City Lights', 'Morgan Gold', 52, 0, 1_180, 700_300, 131, 8),
	]
}

export function getTournamentStatsUiMockPreviousResults(
	eventId: number = TOURNAMENT_STATS_MOCK_EVENT_ID,
	entryId: number = TOURNAMENT_STATS_MOCK_ENTRY_ID,
): TournamentEventResultItem[] {
	const prev = eventId - 1
	const tournament = getTournamentStatsUiMockTournament(entryId)
	return [
		resultRow(tournament, prev, entryId, 1, 'Mock United', 'Alex Manager', 66, 0, 1_411, 230_000, 351, 16),
		resultRow(tournament, prev, 11, 2, 'Green Machine', 'Sam Green', 64, 0, 1_536, 55_000, 10, 12),
		resultRow(tournament, prev, 12, 3, 'Blue Mooners', 'Chris Blue', 61, 4, 1_441, 190_000, 351, 14),
		resultRow(tournament, prev, 13, 5, 'Red Devils FC', 'Pat Red', 50, 0, 1_325, 330_000, 7, 8),
		resultRow(tournament, prev, 14, 4, 'Toon Army', 'Jamie Black', 55, 0, 1_288, 420_000, 131, 10),
		resultRow(tournament, prev, 15, 6, 'Villa Vista', 'Riley Gray', 48, 0, 1_222, 540_000, 10, 6),
		resultRow(tournament, prev, 16, 8, 'Spurs Sparks', 'Taylor White', 41, 4, 1_155, 650_000, 351, 8),
		resultRow(tournament, prev, 17, 7, 'City Lights', 'Morgan Gold', 44, 0, 1_128, 720_000, 7, 7),
	]
}

export function getTournamentStatsUiMockPlayerMeta(): Record<number, PlayerMeta> {
	return {
		351: { webName: 'Salah', teamShortName: 'LIV' },
		10: { webName: 'Haaland', teamShortName: 'MCI' },
		131: { webName: 'Palmer', teamShortName: 'CHE' },
		7: { webName: 'Saka', teamShortName: 'ARS' },
	}
}

export function getTournamentStatsUiMockRankingSummary(
	entryId: number = TOURNAMENT_STATS_MOCK_ENTRY_ID,
): TournamentEntryRankingSummary {
	return {
		entryId,
		overallRank: 214_500,
		tournamentOverallRank: 2,
		teamValue: 1015,
		tournamentTeamValueRank: 3,
		transfersNum: 38,
		tournamentTransfersRank: 5,
		totalCosts: 28,
		tournamentCostsRank: 4,
		totalBenchPoints: 96,
		tournamentBenchPointsRank: 6,
		autoSubPoints: 12,
		tournamentAutoSubRank: 7,
	}
}
