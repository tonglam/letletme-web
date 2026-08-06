import type {
	EntryTournament,
	TournamentEntryRankingSummary,
	TournamentEventResultItem,
} from '@/lib/graphql/operations/tournaments'
import { formatCompactNumber } from '@/lib/utils'

export interface StandingRow {
	entryId: number
	rank: number
	previousRank: number
	teamName: string
	managerName: string
	gameweekPoints: number
	totalPoints: number
	overallRank: number
	teamValue: number | null
}

export interface CaptainRow {
	player: string
	team: string
	count: number
	percentage: number
	averagePoints: number
}

export interface ChipRow {
	chip: string
	count: number
	percentage: number
	averagePoints: number
}

export interface PlayerMeta {
	webName: string
	teamShortName: string
}

export interface TournamentStatsViewModel {
	tournament: EntryTournament
	currentGameweek: number
	startGameweek: number | null
	endGameweek: number | null
	myRank: number | null
	myPreviousRank: number | null
	myTeam: {
		name: string
		points: number | null
		eventCost: number | null
		captaincy: { name: string; team: string; points: number | null }
	} | null
	topPerformers: Array<{
		entryId: number
		rank: number
		teamName: string
		managerName: string
		points: number
		captain: { name: string; team: string; points: number }
	}>
	standings: StandingRow[]
	captainStats: CaptainRow[]
	chipUsage: ChipRow[]
}

export interface TournamentRankingRow {
	label: string
	value: string
	rankLabel: string
	rank: string
}

export type TournamentStatsLoadState = 'waiting' | 'reset' | 'load'

export const resolveTournamentStatsLoadState = ({
	isBootstrapping,
	hasSelectedTournament,
	insightsReady,
}: {
	isBootstrapping: boolean
	hasSelectedTournament: boolean
	insightsReady: boolean
}): TournamentStatsLoadState => {
	if (isBootstrapping) return 'waiting'
	if (!hasSelectedTournament || !insightsReady) return 'reset'
	return 'load'
}

export const formatStateBadge = (state: string): { label: string; className: string } => {
	switch (state) {
		case 'ACTIVE':
			return { label: 'Live', className: 'border-success/30 bg-success/10 text-success' }
		case 'FINISHED':
			return { label: 'Completed', className: 'border-border bg-muted text-muted-foreground' }
		case 'INACTIVE':
			return { label: 'Paused', className: 'border-warning/30 bg-warning/10 text-warning' }
		default:
			return { label: state, className: 'border-border bg-muted text-muted-foreground' }
	}
}

export const formatLeagueType = (leagueType: string): string => {
	if (leagueType === 'H2H') return 'Head-to-Head'
	if (leagueType === 'CLASSIC') return 'Classic'
	return leagueType
}

export const formatGroupMode = (mode: string): string | null => {
	if (mode === 'POINTS_RACES') return 'Points Race'
	if (mode === 'BATTLE_RACES') return 'Battle Race'
	return null
}

export const formatKnockoutMode = (mode: string): string | null => {
	if (mode === 'SINGLE_ELIMINATION') return 'Single Elim.'
	if (mode === 'DOUBLE_ELIMINATION') return 'Double Elim.'
	if (mode === 'HEAD_TO_HEAD') return 'H2H'
	return null
}

const formatChipLabel = (chip: string | null): string => {
	if (chip === 'BENCH_BOOST') return 'Bench Boost'
	if (chip === 'TRIPLE_CAPTAIN') return 'Triple Captain'
	if (chip === 'FREE_HIT') return 'Free Hit'
	if (chip === 'WILDCARD') return 'Wildcard'
	return 'No Chip'
}

export const formatMoneyValue = (value: number | null): string =>
	value === null ? '—' : `£${(value / 10).toFixed(1)}m`

const formatRankValue = (value: number | null): string =>
	value === null ? '—' : formatCompactNumber(value)

const formatPointsValue = (value: number | null): string =>
	value === null ? '—' : `${value} pts`

export const buildTournamentRankingRows = (
	rankingSummary: TournamentEntryRankingSummary | null,
): TournamentRankingRow[] => [
	{
		label: 'Overall Rank',
		value: formatRankValue(rankingSummary?.overallRank ?? null),
		rankLabel: 'Tournament Rank',
		rank: formatRankValue(rankingSummary?.tournamentOverallRank ?? null),
	},
	{
		label: 'Team Value',
		value: formatMoneyValue(rankingSummary?.teamValue ?? null),
		rankLabel: 'Tournament Team Value Rank',
		rank: formatRankValue(rankingSummary?.tournamentTeamValueRank ?? null),
	},
	{
		label: 'Transfers',
		value: rankingSummary?.transfersNum == null ? '—' : String(rankingSummary.transfersNum),
		rankLabel: 'Tournament Transfers Rank',
		rank: formatRankValue(rankingSummary?.tournamentTransfersRank ?? null),
	},
	{
		label: 'Total Costs',
		value: formatPointsValue(rankingSummary?.totalCosts ?? null),
		rankLabel: 'Tournament Costs Rank',
		rank: formatRankValue(rankingSummary?.tournamentCostsRank ?? null),
	},
	{
		label: 'Total Bench Points',
		value: formatPointsValue(rankingSummary?.totalBenchPoints ?? null),
		rankLabel: 'Tournament Bench Rank',
		rank: formatRankValue(rankingSummary?.tournamentBenchPointsRank ?? null),
	},
	{
		label: 'Auto-sub Points',
		value: formatPointsValue(rankingSummary?.autoSubPoints ?? null),
		rankLabel: 'Tournament Auto-sub Rank',
		rank: formatRankValue(rankingSummary?.tournamentAutoSubRank ?? null),
	},
]

export const buildTournamentStats = (
	tournament: EntryTournament,
	currentGameweek: number,
	currentRows: TournamentEventResultItem[],
	previousRows: TournamentEventResultItem[],
	playerMetaById: Record<number, PlayerMeta>,
	entryId: number,
): TournamentStatsViewModel => {
	const previousRankByEntryId = new Map<number, number>()
	previousRows.forEach((row) => {
		if (row.eventGroupRank !== null) previousRankByEntryId.set(row.entryId, row.eventGroupRank)
	})

	// Do not trust API array order — sort by official group rank (nulls last).
	const orderedRows = [...currentRows].sort((a, b) => {
		const rankA = a.eventGroupRank
		const rankB = b.eventGroupRank
		if (rankA == null && rankB == null) return a.entryId - b.entryId
		if (rankA == null) return 1
		if (rankB == null) return -1
		if (rankA !== rankB) return rankA - rankB
		return a.entryId - b.entryId
	})

	const standings = orderedRows.map((row) => ({
		entryId: row.entryId,
		rank: row.eventGroupRank ?? 0,
		previousRank: previousRankByEntryId.get(row.entryId) ?? row.eventGroupRank ?? 0,
		teamName: row.entryName ?? `Entry ${row.entryId}`,
		managerName: row.playerName ?? '—',
		gameweekPoints: row.eventNetPoints ?? row.eventPoints ?? 0,
		totalPoints: row.overallPoints ?? 0,
		overallRank: row.overallRank ?? 0,
		teamValue: row.teamValue ?? null,
	}))

	const topPerformers = orderedRows.slice(0, 5).map((row, index) => {
		const captainMeta = row.captainId !== null ? playerMetaById[row.captainId] : undefined
		return {
			entryId: row.entryId,
			rank: row.eventGroupRank ?? index + 1,
			teamName: row.entryName ?? `Entry ${row.entryId}`,
			managerName: row.playerName ?? '—',
			points: row.eventNetPoints ?? row.eventPoints ?? 0,
			captain: {
				name: captainMeta?.webName ?? 'N/A',
				team: captainMeta?.teamShortName ?? 'N/A',
				points: row.captainPoints ?? 0,
			},
		}
	})

	const myRow = currentRows.find((row) => row.entryId === entryId) ?? null
	const myPreviousRank = myRow
		? previousRankByEntryId.get(myRow.entryId) ?? myRow.eventGroupRank ?? null
		: null
	const myCaptainMeta = myRow?.captainId != null ? playerMetaById[myRow.captainId] : undefined

	const captainBuckets = new Map<number, { count: number; totalCaptainPoints: number }>()
	currentRows.forEach((row) => {
		if (row.captainId === null) return
		const bucket = captainBuckets.get(row.captainId) ?? { count: 0, totalCaptainPoints: 0 }
		bucket.count += 1
		bucket.totalCaptainPoints += row.captainPoints ?? 0
		captainBuckets.set(row.captainId, bucket)
	})

	const captainStats = Array.from(captainBuckets.entries())
		.map(([captainId, bucket]) => ({
			player: playerMetaById[captainId]?.webName ?? `Player ${captainId}`,
			team: playerMetaById[captainId]?.teamShortName ?? 'N/A',
			count: bucket.count,
			percentage: currentRows.length ? Number(((bucket.count / currentRows.length) * 100).toFixed(1)) : 0,
			averagePoints: bucket.count ? Number((bucket.totalCaptainPoints / bucket.count).toFixed(1)) : 0,
		}))
		.sort((left, right) => right.count - left.count)
		.slice(0, 8)

	const chipBuckets = new Map<string, { count: number; totalPoints: number }>()
	currentRows.forEach((row) => {
		if (!row.eventChip) return
		const bucket = chipBuckets.get(row.eventChip) ?? { count: 0, totalPoints: 0 }
		bucket.count += 1
		bucket.totalPoints += row.eventNetPoints ?? row.eventPoints ?? 0
		chipBuckets.set(row.eventChip, bucket)
	})

	const chipUsage = Array.from(chipBuckets.entries())
		.map(([chip, bucket]) => ({
			chip: formatChipLabel(chip),
			count: bucket.count,
			percentage: currentRows.length ? Number(((bucket.count / currentRows.length) * 100).toFixed(1)) : 0,
			averagePoints: bucket.count ? Number((bucket.totalPoints / bucket.count).toFixed(1)) : 0,
		}))
		.sort((left, right) => right.count - left.count)

	return {
		tournament,
		currentGameweek,
		startGameweek: tournament.groupStartedEventId ?? tournament.knockoutStartedEventId ?? null,
		endGameweek: tournament.groupEndedEventId ?? tournament.knockoutEndedEventId ?? null,
		myRank: myRow?.eventGroupRank ?? null,
		myPreviousRank,
		myTeam: myRow
			? {
				name: myRow.entryName ?? `Entry ${myRow.entryId}`,
				points: myRow.eventNetPoints ?? myRow.eventPoints ?? null,
				eventCost: myRow.eventCost ?? null,
				captaincy: {
					name: myCaptainMeta?.webName ?? 'N/A',
					team: myCaptainMeta?.teamShortName ?? 'N/A',
					points: myRow.captainPoints ?? null,
				},
			}
			: null,
		topPerformers,
		standings,
		captainStats,
		chipUsage,
	}
}
