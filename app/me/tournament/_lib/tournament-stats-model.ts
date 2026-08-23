import type {
	EntryTournament,
	TournamentEntryRankingSummary,
	TournamentEventResultItem,
	TournamentSeasonMetricApi,
	TournamentSeasonMetricKey,
	TournamentSeasonSnapshotApi,
} from '@/lib/graphql/operations/tournaments'
import { formatCompactNumber } from '@/lib/utils'

export interface StandingRow {
	entryId: number
	/** Sort key — large sentinel when rank unknown */
	rank: number
	previousRank: number
	/** Actual group rank for display; null → — */
	displayRank: number | null
	teamName: string
	managerName: string
	gameweekPoints: number
	totalPoints: number
	overallRank: number
	teamValue: number | null
	/** Signed-in viewer’s entry — pin + highlight in large tables */
	isMe: boolean
}

export interface CaptainRow {
	player: string
	team: string
	count: number
	percentage: number
	averagePoints: number
}

export interface ChipRow {
	/** Raw chip code for i18n — not a display string */
	chip: ChipCode
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
	/** Top GW scorers this gameweek (not table leaders). */
	topPerformers: Array<{
		entryId: number
		rank: number
		teamName: string
		managerName: string
		points: number
		captain: { name: string; team: string; points: number }
	}>
	/** Biggest league-rank climbers vs previous GW (places gained). */
	biggestRisers: Array<{
		entryId: number
		teamName: string
		managerName: string
		rank: number
		previousRank: number
		placesGained: number
		points: number
	}>
	/** Biggest league-rank drops vs previous GW (places lost). */
	biggestFallers: Array<{
		entryId: number
		teamName: string
		managerName: string
		rank: number
		previousRank: number
		placesLost: number
		points: number
	}>
	standings: StandingRow[]
	captainStats: CaptainRow[]
	chipUsage: ChipRow[]
}

export interface TournamentRankingRow {
	/** i18n key under TournamentStats */
	labelKey: string
	value: string
	rankLabelKey: string
	rank: string
	/** When true, value is a points number already stringified without unit */
	valueIsPoints?: boolean
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

/** Visual tokens for tournament state — labels via i18n keys, not hard-coded English. */
export const formatStateBadge = (
	state: string,
): { labelKey: 'live' | 'completed' | 'paused' | 'pending'; className: string } => {
	switch (state) {
		case 'ACTIVE':
			return {
				labelKey: 'live',
				className: 'border-success/30 bg-success/10 text-success',
			}
		case 'FINISHED':
			return {
				labelKey: 'completed',
				className: 'border-border bg-muted text-muted-foreground',
			}
		case 'INACTIVE':
			return {
				labelKey: 'paused',
				className: 'border-warning/30 bg-warning/10 text-warning',
			}
		default:
			return {
				labelKey: 'pending',
				className: 'border-border bg-muted text-muted-foreground',
			}
	}
}

/** Raw chip enum for UI i18n mapping — do not prettify to English here. */
export type ChipCode =
	| 'BENCH_BOOST'
	| 'TRIPLE_CAPTAIN'
	| 'FREE_HIT'
	| 'WILDCARD'
	| 'NONE'

export const normalizeChipCode = (chip: string | null): ChipCode => {
	const c = String(chip ?? 'NONE').toUpperCase().replace(/[\s-]+/g, '_')
	if (c === 'BENCH_BOOST' || c === 'BB' || c === 'BBOOST') return 'BENCH_BOOST'
	if (c === 'TRIPLE_CAPTAIN' || c === 'TC' || c === '3XC') return 'TRIPLE_CAPTAIN'
	if (c === 'FREE_HIT' || c === 'FREEHIT' || c === 'FH') return 'FREE_HIT'
	if (c === 'WILDCARD' || c === 'WC') return 'WILDCARD'
	return 'NONE'
}

export const formatMoneyValue = (value: number | null): string =>
	value === null ? '—' : `£${(value / 10).toFixed(1)}m`

const formatRankValue = (value: number | null): string =>
	value === null ? '—' : formatCompactNumber(value)

export const buildTournamentRankingRows = (
	rankingSummary: TournamentEntryRankingSummary | null,
): TournamentRankingRow[] => [
	{
		labelKey: 'overallRank',
		value: formatRankValue(rankingSummary?.overallRank ?? null),
		rankLabelKey: 'tournamentRank',
		rank: formatRankValue(rankingSummary?.tournamentOverallRank ?? null),
	},
	{
		labelKey: 'teamValue',
		value: formatMoneyValue(rankingSummary?.teamValue ?? null),
		rankLabelKey: 'tournamentTeamValueRank',
		rank: formatRankValue(rankingSummary?.tournamentTeamValueRank ?? null),
	},
	{
		labelKey: 'transfers',
		value:
			rankingSummary?.transfersNum == null
				? '—'
				: String(rankingSummary.transfersNum),
		rankLabelKey: 'tournamentTransfersRank',
		rank: formatRankValue(rankingSummary?.tournamentTransfersRank ?? null),
	},
	{
		labelKey: 'totalCosts',
		value:
			rankingSummary?.totalCosts == null
				? '—'
				: String(rankingSummary.totalCosts),
		rankLabelKey: 'tournamentCostsRank',
		rank: formatRankValue(rankingSummary?.tournamentCostsRank ?? null),
		valueIsPoints: rankingSummary?.totalCosts != null,
	},
	{
		labelKey: 'totalBenchPoints',
		value:
			rankingSummary?.totalBenchPoints == null
				? '—'
				: String(rankingSummary.totalBenchPoints),
		rankLabelKey: 'tournamentBenchRank',
		rank: formatRankValue(rankingSummary?.tournamentBenchPointsRank ?? null),
		valueIsPoints: rankingSummary?.totalBenchPoints != null,
	},
	{
		labelKey: 'autoSubPoints',
		value:
			rankingSummary?.autoSubPoints == null
				? '—'
				: String(rankingSummary.autoSubPoints),
		rankLabelKey: 'tournamentAutoSubRank',
		rank: formatRankValue(rankingSummary?.tournamentAutoSubRank ?? null),
		valueIsPoints: rankingSummary?.autoSubPoints != null,
	},
]

/** Season dimension A — tournament as a whole (as-of latest data GW). */
export interface TournamentSeasonStandingRow {
	entryId: number
	rank: number | null
	teamName: string
	managerName: string
	totalPoints: number | null
	/** Global FPL overall rank */
	overallRank: number | null
	/** Team value in 0.1m units */
	teamValue: number | null
	isMe: boolean
}

export interface TournamentSeasonFieldMetric {
	key: TournamentSeasonMetricKey
	/** i18n label key under TournamentStats */
	labelKey: string
	leaderValueDisplay: string
	leaderTeamName: string | null
	leaderManagerName: string | null
	averageDisplay: string
	higherIsBetter: boolean
	/** raw average for Me vs-avg */
	averageRaw: number | null
}

export interface TournamentSeasonField {
	asOfGameweek: number
	entryCount: number
	leaderPoints: number | null
	secondPoints: number | null
	/** Leader minus #2; null if <2 teams or missing points */
	gapFirstSecond: number | null
	averagePoints: number | null
	/** Leaders + averages for main metrics */
	metrics: TournamentSeasonFieldMetric[]
	standings: TournamentSeasonStandingRow[]
	myEntryId: number
}

/** Season dimension B — me relative to the field. */
export interface TournamentSeasonMeMetric {
	labelKey: string
	value: string
	rank: string
	/** Formatted field average for this metric */
	averageDisplay: string | null
	valueIsPoints?: boolean
	valueIsMoney?: boolean
}

export interface TournamentSeasonMe {
	asOfGameweek: number
	tournamentRank: number | null
	totalPoints: number | null
	/** Points behind leader (0 if leading); null if unknown */
	gapToLeader: number | null
	/** Points behind the team immediately above; null if #1 or unknown */
	gapToAbove: number | null
	/** FPL overall rank — secondary only, not hero */
	fplOverallRank: number | null
	secondary: TournamentSeasonMeMetric[]
}

const METRIC_LABEL_KEYS: Record<TournamentSeasonMetricKey, string> = {
	OVERALL_POINTS: 'metricOverallPoints',
	TEAM_VALUE: 'metricTeamValue',
	TRANSFERS: 'metricTransfers',
	TOTAL_COSTS: 'metricTotalCosts',
	BENCH_POINTS: 'metricBenchPoints',
	AUTO_SUB_POINTS: 'metricAutoSubPoints',
}

function formatMetricRawValue(
	key: TournamentSeasonMetricKey,
	value: number | null | undefined,
): string {
	if (value == null || !Number.isFinite(value)) return '—'
	if (key === 'TEAM_VALUE') return formatMoneyValue(Math.round(value))
	if (
		key === 'TOTAL_COSTS' ||
		key === 'BENCH_POINTS' ||
		key === 'AUTO_SUB_POINTS' ||
		key === 'OVERALL_POINTS'
	) {
		return `${Math.round(value)} pts`
	}
	return String(Math.round(value))
}

function formatMetricAverageValue(
	key: TournamentSeasonMetricKey,
	value: number | null | undefined,
): string {
	if (value == null || !Number.isFinite(value)) return '—'
	if (key === 'TEAM_VALUE') return `£${(value / 10).toFixed(2)}m`
	if (
		key === 'TOTAL_COSTS' ||
		key === 'BENCH_POINTS' ||
		key === 'AUTO_SUB_POINTS' ||
		key === 'OVERALL_POINTS'
	) {
		return `${value.toFixed(2)} pts`
	}
	return value.toFixed(2)
}

function mapApiMetrics(
	metrics: TournamentSeasonMetricApi[] | undefined | null,
): TournamentSeasonFieldMetric[] {
	if (!metrics?.length) return []
	return metrics.map(m => ({
		key: m.key,
		labelKey: METRIC_LABEL_KEYS[m.key] ?? m.key,
		leaderValueDisplay: formatMetricRawValue(m.key, m.leaderValue),
		leaderTeamName: m.leaderEntryName?.trim() || null,
		leaderManagerName: m.leaderPlayerName?.trim() || null,
		averageDisplay: formatMetricAverageValue(m.key, m.averageValue),
		higherIsBetter: m.higherIsBetter,
		averageRaw: m.averageValue,
	}))
}

function metricAverageMap(
	field: TournamentSeasonField | null,
): Partial<Record<TournamentSeasonMetricKey, number | null>> {
	const out: Partial<Record<TournamentSeasonMetricKey, number | null>> = {}
	for (const m of field?.metrics ?? []) {
		out[m.key] = m.averageRaw
	}
	return out
}

/**
 * Prefer backend tournamentSeasonSnapshot (Phase 2); maps to field view model.
 */
export function buildTournamentSeasonFieldFromSnapshot(
	snapshot: TournamentSeasonSnapshotApi | null | undefined,
	entryId: number,
): TournamentSeasonField | null {
	if (!snapshot || snapshot.asOfEventId < 1) return null
	if (snapshot.entryCount === 0 && snapshot.standings.length === 0) return null

	return {
		asOfGameweek: snapshot.asOfEventId,
		entryCount: snapshot.entryCount,
		leaderPoints: snapshot.leaderOverallPoints,
		secondPoints: snapshot.secondOverallPoints,
		gapFirstSecond: snapshot.gapFirstSecond,
		averagePoints: snapshot.averageOverallPoints,
		metrics: mapApiMetrics(snapshot.metrics),
		standings: snapshot.standings.map((row, index) => ({
			entryId: row.entryId,
			rank: row.rank ?? index + 1,
			teamName: row.entryName?.trim() || `Entry ${row.entryId}`,
			managerName: row.playerName?.trim() || '—',
			totalPoints: row.overallPoints,
			overallRank: row.overallRank ?? null,
			teamValue: row.teamValue ?? null,
			isMe: row.entryId === entryId,
		})),
		myEntryId: entryId,
	}
}

/** Cumulative season order across the whole tournament, independent of group rank. */
export function compareTournamentSeasonRows(
	a: TournamentEventResultItem,
	b: TournamentEventResultItem,
): number {
	const pointsA =
		a.overallPoints != null && Number.isFinite(a.overallPoints)
			? a.overallPoints
			: null
	const pointsB =
		b.overallPoints != null && Number.isFinite(b.overallPoints)
			? b.overallPoints
			: null
	if (pointsA != null && pointsB != null && pointsA !== pointsB) {
		return pointsB - pointsA
	}
	if (pointsA != null && pointsB == null) return -1
	if (pointsA == null && pointsB != null) return 1
	const overallRankA = a.overallRank ?? Number.MAX_SAFE_INTEGER
	const overallRankB = b.overallRank ?? Number.MAX_SAFE_INTEGER
	if (overallRankA !== overallRankB) return overallRankA - overallRankB
	return a.entryId - b.entryId
}

/**
 * Fallback: build season field from full tournament event results (latest data GW).
 * Points + team-value metrics only (no cum transfers/costs without MV).
 */
export function buildTournamentSeasonField(
	rows: TournamentEventResultItem[],
	entryId: number,
	asOfGameweek: number,
): TournamentSeasonField | null {
	if (rows.length === 0 || asOfGameweek < 1) return null

	const ordered = [...rows].sort(compareTournamentSeasonRows)

	const standings: TournamentSeasonStandingRow[] = ordered.map((row, index) => ({
		entryId: row.entryId,
		rank:
			row.overallPoints != null && Number.isFinite(row.overallPoints)
				? index + 1
				: null,
		teamName: row.entryName?.trim() || `Entry ${row.entryId}`,
		managerName: row.playerName?.trim() || '—',
		totalPoints: row.overallPoints,
		overallRank: row.overallRank,
		teamValue: row.teamValue,
		isMe: row.entryId === entryId,
	}))

	const withPoints = standings.filter(
		s => s.totalPoints != null && Number.isFinite(s.totalPoints),
	)
	const leaderPoints = withPoints[0]?.totalPoints ?? null
	const secondPoints = withPoints[1]?.totalPoints ?? null
	const gapFirstSecond =
		leaderPoints != null && secondPoints != null
			? leaderPoints - secondPoints
			: null
	const averagePoints =
		withPoints.length > 0
			? withPoints.reduce((sum, s) => sum + (s.totalPoints as number), 0) /
				withPoints.length
			: null

	// Client-side metrics for points + team value only
	const pointsLeader = ordered.find(r => r.overallPoints === leaderPoints) ?? ordered[0]
	const tvRows = ordered.filter(
		r => r.teamValue != null && Number.isFinite(r.teamValue),
	)
	const tvLeader = [...tvRows].sort(
		(a, b) => (b.teamValue ?? 0) - (a.teamValue ?? 0),
	)[0]
	const tvAvg =
		tvRows.length > 0
			? tvRows.reduce((s, r) => s + (r.teamValue as number), 0) / tvRows.length
			: null

	const metrics: TournamentSeasonFieldMetric[] = [
		{
			key: 'OVERALL_POINTS',
			labelKey: METRIC_LABEL_KEYS.OVERALL_POINTS,
			leaderValueDisplay: formatMetricRawValue('OVERALL_POINTS', leaderPoints),
			leaderTeamName: pointsLeader?.entryName?.trim() || null,
			leaderManagerName: pointsLeader?.playerName?.trim() || null,
			averageDisplay: formatMetricAverageValue('OVERALL_POINTS', averagePoints),
			higherIsBetter: true,
			averageRaw: averagePoints,
		},
	]
	if (tvLeader) {
		metrics.push({
			key: 'TEAM_VALUE',
			labelKey: METRIC_LABEL_KEYS.TEAM_VALUE,
			leaderValueDisplay: formatMetricRawValue(
				'TEAM_VALUE',
				tvLeader.teamValue,
			),
			leaderTeamName: tvLeader.entryName?.trim() || null,
			leaderManagerName: tvLeader.playerName?.trim() || null,
			averageDisplay: formatMetricAverageValue('TEAM_VALUE', tvAvg),
			higherIsBetter: true,
			averageRaw: tvAvg,
		})
	}

	return {
		asOfGameweek,
		entryCount: standings.length,
		leaderPoints,
		secondPoints,
		gapFirstSecond,
		averagePoints,
		metrics,
		standings,
		myEntryId: entryId,
	}
}

/**
 * Me in tournament — ranking summary + field averages for secondary metrics.
 */
export function buildTournamentSeasonMe(
	summary: TournamentEntryRankingSummary | null,
	field: TournamentSeasonField | null,
	asOfGameweek: number,
): TournamentSeasonMe | null {
	if (!summary && !field) return null

	const myStanding =
		field?.standings.find(s => s.entryId === field.myEntryId) ?? null
	const myIndex =
		field?.standings.findIndex(s => s.entryId === field.myEntryId) ?? -1
	const above =
		myIndex > 0 && field ? field.standings[myIndex - 1] : null

	const totalPoints =
		summary?.overallPoints != null
			? summary.overallPoints
			: (myStanding?.totalPoints ?? null)
	const gapToLeader =
		summary?.gapToLeader != null
			? summary.gapToLeader
			: totalPoints != null && field?.leaderPoints != null
				? Math.max(0, field.leaderPoints - totalPoints)
				: null
	const gapToAbove =
		summary?.pointsBehindNext != null
			? summary.pointsBehindNext
			: totalPoints != null &&
				  above?.totalPoints != null &&
				  myStanding?.rank != null &&
				  myStanding.rank > 1
				? Math.max(0, above.totalPoints - totalPoints)
				: myStanding?.rank === 1 || summary?.tournamentOverallRank === 1
					? 0
					: null

	const tournamentRank =
		summary?.tournamentOverallRank ?? myStanding?.rank ?? null

	const avgs = metricAverageMap(field)

	const secondary: TournamentSeasonMeMetric[] = []
	if (summary) {
		const avgOrNull = (key: TournamentSeasonMetricKey) => {
			const raw = avgs[key]
			return raw != null && Number.isFinite(raw)
				? formatMetricAverageValue(key, raw)
				: null
		}
		secondary.push(
			{
				labelKey: 'teamValue',
				value: formatMoneyValue(summary.teamValue ?? null),
				rank: formatRankValue(summary.tournamentTeamValueRank ?? null),
				averageDisplay: avgOrNull('TEAM_VALUE'),
				valueIsMoney: true,
			},
			{
				labelKey: 'transfers',
				value:
					summary.transfersNum == null ? '—' : String(summary.transfersNum),
				rank: formatRankValue(summary.tournamentTransfersRank ?? null),
				averageDisplay: avgOrNull('TRANSFERS'),
			},
			{
				labelKey: 'totalCosts',
				value:
					summary.totalCosts == null ? '—' : String(summary.totalCosts),
				rank: formatRankValue(summary.tournamentCostsRank ?? null),
				averageDisplay: avgOrNull('TOTAL_COSTS'),
				valueIsPoints: summary.totalCosts != null,
			},
			{
				labelKey: 'totalBenchPoints',
				value:
					summary.totalBenchPoints == null
						? '—'
						: String(summary.totalBenchPoints),
				rank: formatRankValue(summary.tournamentBenchPointsRank ?? null),
				averageDisplay: avgOrNull('BENCH_POINTS'),
				valueIsPoints: summary.totalBenchPoints != null,
			},
			{
				labelKey: 'autoSubPoints',
				value:
					summary.autoSubPoints == null
						? '—'
						: String(summary.autoSubPoints),
				rank: formatRankValue(summary.tournamentAutoSubRank ?? null),
				averageDisplay: avgOrNull('AUTO_SUB_POINTS'),
				valueIsPoints: summary.autoSubPoints != null,
			},
		)
	}

	return {
		asOfGameweek,
		tournamentRank,
		totalPoints,
		gapToLeader,
		gapToAbove,
		fplOverallRank: summary?.overallRank ?? null,
		secondary,
	}
}

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

	const standings = orderedRows.map(row => {
		const prev = previousRankByEntryId.get(row.entryId)
		const rank = row.eventGroupRank
		return {
			entryId: row.entryId,
			// Keep null ranks out of "0" — UI treats null as —
			rank: rank ?? Number.MAX_SAFE_INTEGER,
			previousRank: prev ?? rank ?? Number.MAX_SAFE_INTEGER,
			displayRank: rank,
			teamName: row.entryName ?? `Entry ${row.entryId}`,
			managerName: row.playerName ?? '—',
			gameweekPoints: row.eventNetPoints ?? row.eventPoints ?? 0,
			totalPoints: row.overallPoints ?? 0,
			overallRank: row.overallRank ?? 0,
			teamValue: row.teamValue ?? null,
			isMe: row.entryId === entryId,
		}
	})

	// Top performers = highest GW net points (not table position)
	const topPerformers = [...orderedRows]
		.map(row => {
			const captainMeta =
				row.captainId !== null ? playerMetaById[row.captainId] : undefined
			return {
				entryId: row.entryId,
				rank: row.eventGroupRank ?? Number.MAX_SAFE_INTEGER,
				teamName: row.entryName ?? `Entry ${row.entryId}`,
				managerName: row.playerName ?? '—',
				points: row.eventNetPoints ?? row.eventPoints ?? 0,
				captain: {
					name: captainMeta?.webName ?? '',
					team: captainMeta?.teamShortName ?? '',
					points: row.captainPoints ?? 0,
				},
			}
		})
		.sort((a, b) => {
			if (b.points !== a.points) return b.points - a.points
			return a.rank - b.rank
		})
		.slice(0, 5)
		.map((row, index) => ({
			...row,
			// Display order among top scorers (1 = highest GW score)
			rank: index + 1,
		}))

	// Red/black board: rank movement vs previous GW (need both ranks)
	const movers = orderedRows
		.map(row => {
			const rank = row.eventGroupRank
			const prev = previousRankByEntryId.get(row.entryId)
			if (rank == null || prev == null) return null
			return {
				entryId: row.entryId,
				teamName: row.entryName ?? `Entry ${row.entryId}`,
				managerName: row.playerName ?? '—',
				rank,
				previousRank: prev,
				placesGained: prev - rank,
				placesLost: rank - prev,
				points: row.eventNetPoints ?? row.eventPoints ?? 0,
			}
		})
		.filter((row): row is NonNullable<typeof row> => row != null)

	const biggestRisers = movers
		.filter(m => m.placesGained > 0)
		.sort((a, b) => {
			if (b.placesGained !== a.placesGained) return b.placesGained - a.placesGained
			return a.rank - b.rank
		})
		.slice(0, 5)

	const biggestFallers = movers
		.filter(m => m.placesLost > 0)
		.sort((a, b) => {
			if (b.placesLost !== a.placesLost) return b.placesLost - a.placesLost
			return b.rank - a.rank
		})
		.slice(0, 5)

	const myRow = currentRows.find(row => row.entryId === entryId) ?? null
	const myPreviousRank = myRow
		? (previousRankByEntryId.get(myRow.entryId) ?? null)
		: null
	const myCaptainMeta =
		myRow?.captainId != null ? playerMetaById[myRow.captainId] : undefined

	const captainBuckets = new Map<
		number,
		{ count: number; totalCaptainPoints: number }
	>()
	currentRows.forEach(row => {
		if (row.captainId === null) return
		const bucket = captainBuckets.get(row.captainId) ?? {
			count: 0,
			totalCaptainPoints: 0,
		}
		bucket.count += 1
		bucket.totalCaptainPoints += row.captainPoints ?? 0
		captainBuckets.set(row.captainId, bucket)
	})

	const captainStats = Array.from(captainBuckets.entries())
		.map(([captainId, bucket]) => ({
			player: playerMetaById[captainId]?.webName ?? `Player ${captainId}`,
			team: playerMetaById[captainId]?.teamShortName ?? '—',
			count: bucket.count,
			percentage: currentRows.length
				? Number(((bucket.count / currentRows.length) * 100).toFixed(1))
				: 0,
			averagePoints: bucket.count
				? Number((bucket.totalCaptainPoints / bucket.count).toFixed(1))
				: 0,
		}))
		.sort((left, right) => right.count - left.count)
		.slice(0, 8)

	const chipBuckets = new Map<ChipCode, { count: number; totalPoints: number }>()
	currentRows.forEach(row => {
		const code = normalizeChipCode(row.eventChip)
		if (code === 'NONE') return
		const bucket = chipBuckets.get(code) ?? { count: 0, totalPoints: 0 }
		bucket.count += 1
		bucket.totalPoints += row.eventNetPoints ?? row.eventPoints ?? 0
		chipBuckets.set(code, bucket)
	})

	const chipUsage = Array.from(chipBuckets.entries())
		.map(([chip, bucket]) => ({
			chip,
			count: bucket.count,
			percentage: currentRows.length
				? Number(((bucket.count / currentRows.length) * 100).toFixed(1))
				: 0,
			averagePoints: bucket.count
				? Number((bucket.totalPoints / bucket.count).toFixed(1))
				: 0,
		}))
		.sort((left, right) => right.count - left.count)

	return {
		tournament,
		currentGameweek,
		startGameweek:
			tournament.groupStartedEventId ?? tournament.knockoutStartedEventId ?? null,
		endGameweek:
			tournament.groupEndedEventId ?? tournament.knockoutEndedEventId ?? null,
		myRank: myRow?.eventGroupRank ?? null,
		myPreviousRank,
		myTeam: myRow
			? {
					name: myRow.entryName ?? `Entry ${myRow.entryId}`,
					points: myRow.eventNetPoints ?? myRow.eventPoints ?? null,
					eventCost: myRow.eventCost ?? null,
					captaincy: {
						name: myCaptainMeta?.webName ?? '',
						team: myCaptainMeta?.teamShortName ?? '',
						points: myRow.captainPoints ?? null,
					},
				}
			: null,
		topPerformers,
		biggestRisers,
		biggestFallers,
		standings,
		captainStats,
		chipUsage,
	}
}
