import type {
	MyFplCompetitionAggregate,
	MyFplCompetitionBoardPage,
	MyFplCompetitionBoardRow,
	MyFplCompetitionPerformance
} from '@/lib/graphql/operations/my-fpl'
import type {
	EntryTournament,
	TournamentEntryRankingSummary,
	TournamentEventResultItem,
	TournamentSeasonSnapshotApi
} from '@/lib/graphql/operations/tournaments'
import type { TournamentStatsViewModel } from './tournament-stats-model'
import { normalizeChipCode } from './tournament-stats-model'

function boardRowsIncludingViewer(
	page: MyFplCompetitionBoardPage | null | undefined
): MyFplCompetitionBoardRow[] {
	const rows = page?.rows ?? []
	const viewerRow = page?.viewerRow
	if (!viewerRow || rows.some(row => row.entryId === viewerRow.entryId))
		return rows
	return [...rows, viewerRow]
}

function compareSeasonBoardRows(
	a: MyFplCompetitionBoardRow,
	b: MyFplCompetitionBoardRow
): number {
	const pointsA =
		a.overallPoints != null && Number.isFinite(a.overallPoints)
			? a.overallPoints
			: null
	const pointsB =
		b.overallPoints != null && Number.isFinite(b.overallPoints)
			? b.overallPoints
			: null
	if (pointsA != null && pointsB != null && pointsA !== pointsB)
		return pointsB - pointsA
	if (pointsA != null && pointsB == null) return -1
	if (pointsA == null && pointsB != null) return 1
	const overallRankA = a.overallRank ?? Number.MAX_SAFE_INTEGER
	const overallRankB = b.overallRank ?? Number.MAX_SAFE_INTEGER
	if (overallRankA !== overallRankB) return overallRankA - overallRankB
	return a.entryId - b.entryId
}

function compareFieldRankRows(
	a: MyFplCompetitionBoardRow,
	b: MyFplCompetitionBoardRow
): number {
	const fieldRankA = a.fieldRank ?? Number.MAX_SAFE_INTEGER
	const fieldRankB = b.fieldRank ?? Number.MAX_SAFE_INTEGER
	if (fieldRankA !== fieldRankB) return fieldRankA - fieldRankB
	return compareSeasonBoardRows(a, b)
}

export function boardRowsToEventResults(
	page: MyFplCompetitionBoardPage | null | undefined,
	tournament?: EntryTournament | null
): TournamentEventResultItem[] {
	return boardRowsIncludingViewer(page).map(row => ({
		tournament: tournament ?? undefined,
		event: { id: row.eventId, name: `Gameweek ${row.eventId}` },
		groupId: row.groupId ?? 0,
		entryId: row.entryId,
		entryName: row.entryName,
		playerName: row.playerName,
		eventGroupRank: row.rank,
		eventPoints: row.eventPoints,
		eventCost: row.eventCost,
		eventNetPoints: row.eventNetPoints,
		eventRank: row.eventRank,
		overallPoints: row.overallPoints,
		overallRank: row.overallRank,
		eventChip: row.eventChip,
		captainId: row.captainId,
		captainPoints: row.captainPoints,
		teamValue: row.teamValue,
		bank: row.bank
	}))
}

export function aggregateToSeasonSnapshot(
	aggregate: MyFplCompetitionAggregate | null | undefined,
	board: MyFplCompetitionBoardPage | null | undefined
): TournamentSeasonSnapshotApi | null {
	if (!aggregate) return null
	return {
		asOfEventId: aggregate.eventId,
		entryCount: aggregate.entryCount,
		leaderOverallPoints: aggregate.leaderOverallPoints,
		secondOverallPoints: aggregate.secondOverallPoints,
		gapFirstSecond: aggregate.gapFirstSecond,
		averageOverallPoints: aggregate.averageOverallPoints,
		metrics: aggregate.metrics.map(metric => ({
			key: metric.key,
			leaderValue: metric.leaderValue,
			leaderEntryId: metric.leaderEntryId,
			leaderEntryName: metric.leaderEntryName,
			leaderPlayerName: metric.leaderPlayerName,
			averageValue: metric.averageValue,
			higherIsBetter: metric.higherIsBetter
		})),
		standings: [...boardRowsIncludingViewer(board)]
			.sort(compareFieldRankRows)
			.map(row => ({
				entryId: row.entryId,
				rank: row.fieldRank,
				entryName: row.entryName,
				playerName: row.playerName,
				overallPoints: row.overallPoints,
				overallRank: row.overallRank,
				teamValue: row.teamValue
			}))
	}
}

export function aggregateToRankingSummary(
	aggregate: MyFplCompetitionAggregate | null | undefined
): TournamentEntryRankingSummary | null {
	const viewer = aggregate?.viewer
	if (!viewer) return null
	return {
		entryId: viewer.entryId,
		overallRank: viewer.overallRank,
		tournamentOverallRank: viewer.tournamentOverallRank,
		teamValue: viewer.teamValue,
		tournamentTeamValueRank: viewer.tournamentTeamValueRank,
		transfersNum: viewer.transfersNum,
		tournamentTransfersRank: viewer.tournamentTransfersRank,
		totalCosts: viewer.totalCosts,
		tournamentCostsRank: viewer.tournamentCostsRank,
		totalBenchPoints: viewer.totalBenchPoints,
		tournamentBenchPointsRank: viewer.tournamentBenchPointsRank,
		autoSubPoints: viewer.autoSubPoints,
		tournamentAutoSubRank: viewer.tournamentAutoSubRank,
		overallPoints: viewer.overallPoints,
		leaderOverallPoints: viewer.leaderOverallPoints,
		gapToLeader: viewer.gapToLeader,
		pointsBehindNext: viewer.pointsBehindNext,
		pointsAheadOfPrev: viewer.pointsAheadOfPrev
	}
}

const performanceName = (row: MyFplCompetitionPerformance): string =>
	row.entryName?.trim() || `Entry ${row.entryId}`

function captainFromPerformance(row: MyFplCompetitionPerformance) {
	return {
		name: row.captainWebName ?? '',
		team: row.captainTeamShortName ?? '',
		points: row.captainPoints ?? 0
	}
}

function rowToStanding(row: MyFplCompetitionBoardRow, entryId: number) {
	return {
		entryId: row.entryId,
		rank: row.rank ?? Number.MAX_SAFE_INTEGER,
		previousRank: row.previousRank ?? row.rank ?? Number.MAX_SAFE_INTEGER,
		displayRank: row.rank,
		teamName: row.entryName?.trim() || `Entry ${row.entryId}`,
		managerName: row.playerName?.trim() || '—',
		gameweekPoints: row.eventNetPoints ?? row.eventPoints ?? 0,
		totalPoints: row.overallPoints ?? 0,
		overallRank: row.overallRank ?? 0,
		teamValue: row.teamValue,
		isMe: row.entryId === entryId
	}
}

export function aggregateToTournamentStats(
	tournament: EntryTournament,
	aggregate: MyFplCompetitionAggregate,
	board: MyFplCompetitionBoardPage,
	entryId: number
): TournamentStatsViewModel {
	const viewerRow = board.viewerRow
	const topPerformers = aggregate.topPerformers.map(row => ({
		entryId: row.entryId,
		rank: row.rank ?? Number.MAX_SAFE_INTEGER,
		teamName: performanceName(row),
		managerName: row.playerName?.trim() || '—',
		points: row.eventNetPoints,
		captain: captainFromPerformance(row)
	}))
	const biggestRisers = aggregate.risers
		.filter(row => row.rank != null && row.previousRank != null)
		.map(row => ({
			entryId: row.entryId,
			teamName: performanceName(row),
			managerName: row.playerName?.trim() || '—',
			rank: row.rank as number,
			previousRank: row.previousRank as number,
			placesGained: (row.previousRank as number) - (row.rank as number),
			points: row.eventNetPoints
		}))
	const biggestFallers = aggregate.fallers
		.filter(row => row.rank != null && row.previousRank != null)
		.map(row => ({
			entryId: row.entryId,
			teamName: performanceName(row),
			managerName: row.playerName?.trim() || '—',
			rank: row.rank as number,
			previousRank: row.previousRank as number,
			placesLost: (row.rank as number) - (row.previousRank as number),
			points: row.eventNetPoints
		}))

	return {
		tournament,
		currentGameweek: aggregate.eventId,
		startGameweek:
			tournament.groupStartedEventId ??
			tournament.knockoutStartedEventId ??
			null,
		endGameweek:
			tournament.groupEndedEventId ?? tournament.knockoutEndedEventId ?? null,
		myRank: viewerRow?.rank ?? aggregate.viewer?.tournamentOverallRank ?? null,
		myPreviousRank: viewerRow?.previousRank ?? null,
		myTeam: viewerRow
			? {
					name: viewerRow.entryName?.trim() || `Entry ${viewerRow.entryId}`,
					points: viewerRow.eventNetPoints ?? viewerRow.eventPoints,
					eventCost: viewerRow.eventCost,
					captaincy: {
						name: viewerRow.captainWebName ?? '',
						team: viewerRow.captainTeamShortName ?? '',
						points: viewerRow.captainPoints
					}
				}
			: null,
		topPerformers,
		biggestRisers,
		biggestFallers,
		standings: boardRowsIncludingViewer(board).map(row =>
			rowToStanding(row, entryId)
		),
		captainStats: aggregate.captainDistribution
			.filter(row => row.key !== 'NONE')
			.map(row => ({
				player: row.label,
				team: row.teamShortName ?? '—',
				count: row.count,
				percentage: row.percentage,
				averagePoints: row.averagePoints
			})),
		chipUsage: aggregate.chipDistribution
			.filter(row => normalizeChipCode(row.key) !== 'NONE')
			.map(row => ({
				chip: normalizeChipCode(row.key),
				count: row.count,
				percentage: row.percentage,
				averagePoints: row.averagePoints
			}))
	}
}
