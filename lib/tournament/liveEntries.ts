import {
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse
} from '@/lib/graphql/operations/tournaments'
import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'
import {
	hasTraceableLiveEventPoints,
	traceableLiveScore
} from '@/lib/live-score-v2'
import { type TournamentEntry } from '@/types/tournament'

export type LiveTournamentStats = {
	averagePoints: number
	highestPoints: number
	totalEntries: number
}

export const mergeDegradedTournamentEntryIds = (
	failedEntryIds: readonly number[],
	unavailableEntryIds: readonly number[]
): number[] => Array.from(new Set([...failedEntryIds, ...unavailableEntryIds]))

type DegradedTournamentEntryMetadata = {
	entryName?: string | null
	playerName?: string | null
}

/**
 * Keep a failed entry visible when the producer omits its row entirely. These
 * placeholders are deliberately scoreless and are marked stale by the caller;
 * they preserve the denominator and give the user a row-level degraded state
 * without inventing points or rank data.
 */
export const appendDegradedTournamentRows = ({
	rows,
	degradedEntryIds,
	metadataByEntryId
}: {
	rows: TournamentLiveCalcData[]
	degradedEntryIds: readonly number[]
	metadataByEntryId?: ReadonlyMap<number, DegradedTournamentEntryMetadata>
}): TournamentLiveCalcData[] => {
	const existingEntryIds = new Set(rows.map(row => row.entry))
	const placeholders = degradedEntryIds
		.filter(entryId => !existingEntryIds.has(entryId))
		.map(entryId => {
			const metadata = metadataByEntryId?.get(entryId)
			return {
				entry: entryId,
				entryName: metadata?.entryName ?? `Entry ${entryId}`,
				playerName: metadata?.playerName ?? '—',
				rank: {
					eventRank: null,
					overallRank: 0,
					leagueRank: null,
					revision: null,
					contentUpdatedAt: null,
					state: 'UNAVAILABLE'
				},
				chip: null,
				played: 0,
				toPlay: 0,
				captainName: 'N/A',
				pickList: []
			} satisfies TournamentLiveCalcData
		})
	return placeholders.length > 0 ? [...rows, ...placeholders] : rows
}

export const shouldShowTournamentResultsFatalError = ({
	requestFailed,
	canRetainUsableBoard
}: {
	requestFailed: boolean
	canRetainUsableBoard: boolean
}): boolean => requestFailed && !canRetainUsableBoard

/**
 * Keep producer metadata independent from per-entry calculation failures.
 * A partial batch can still carry a valid SETTLED snapshot that must stop
 * revision polling while its row error remains visible to the user.
 */
export const getTournamentLiveBatchSeed = (
	response: TournamentLivePointsResponse
) => {
	const failedEntryIds = response.entryLiveCompetitionsDesk.failedEntryIds
	const unavailableEntryIds =
		response.entryLiveCompetitionsDesk.unavailableEntryIds ?? []
	const degradedEntryIds = mergeDegradedTournamentEntryIds(
		failedEntryIds,
		unavailableEntryIds
	)
	return {
		rows: response.entryLiveCompetitionsDesk.board ?? [],
		snapshot: {
			eventId: response.entryLiveCompetitionsDesk.eventId,
			scoreCoreRevision: response.entryLiveCompetitionsDesk.scoreCoreRevision,
			state: (response.entryLiveCompetitionsDesk.windowState ??
				response.entryLiveCompetitionsDesk
					.state) as LiveSnapshotStatus['state'],
			publishedAt: null,
			windowState: response.entryLiveCompetitionsDesk.windowState as LiveSnapshotStatus['windowState'],
			dataAvailability: response.entryLiveCompetitionsDesk.dataAvailability as LiveSnapshotStatus['dataAvailability'],
			nextRefreshAt: response.entryLiveCompetitionsDesk.nextRefreshAt ?? null
		},
		failedCount: failedEntryIds.length,
		failedEntryIds,
		degradedEntryIds,
		officialCoverage: response.entryLiveCompetitionsDesk.officialCoverage ?? 0,
		unavailableEntryIds,
		totalEntries: response.entryLiveCompetitionsDesk.totalEntries
	}
}

const mapEventChipToFlags = (eventChip: string | null) => ({
	bench: eventChip === 'BENCH_BOOST',
	triple: eventChip === 'TRIPLE_CAPTAIN',
	wildcard: eventChip === 'WILDCARD',
	freeHit: eventChip === 'FREE_HIT'
})

const isPositiveOverallRank = (
	value: number | null | undefined
): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value > 0

const resolveOverallRank = (value: number | null | undefined): number =>
	isPositiveOverallRank(value) ? value : 0

export const buildRankMap = (
	rows: TournamentLiveCalcData[]
): Map<number, number> => {
	const isOfficialSource = (row: TournamentLiveCalcData): boolean =>
			traceableLiveScore(row.score) !== undefined
	const rankableRows = rows.filter(row => {
		return (
			isOfficialSource(row) &&
				hasTraceableLiveEventPoints(row.score) &&
			typeof row.score?.netEventPoints === 'number'
		)
	})
	const netPointsForRanking = (row: TournamentLiveCalcData): number =>
		row.score?.netEventPoints ?? 0
	const totalPointsForRanking = (row: TournamentLiveCalcData): number =>
		row.score?.totalScope === 'OVERALL' &&
		typeof row.score.totalPoints === 'number'
			? row.score.totalPoints
			: 0

	const sorted = [...rankableRows].sort((a, b) => {
		const netPointDiff = netPointsForRanking(b) - netPointsForRanking(a)
		if (netPointDiff !== 0) {
			return netPointDiff
		}
		const totalPointDiff = totalPointsForRanking(b) - totalPointsForRanking(a)
		if (totalPointDiff !== 0) {
			return totalPointDiff
		}
		return a.entry - b.entry
	})

	const ranks = new Map<number, number>()
	let previousPoints: number | null = null
	let previousRank = 0
	for (let index = 0; index < sorted.length; index += 1) {
		const points = netPointsForRanking(sorted[index]!)
		if (previousPoints === null || points !== previousPoints)
			previousRank = index + 1
		ranks.set(sorted[index]!.entry, previousRank)
		previousPoints = points
	}
	return ranks
}

export const buildTournamentEntries = (
	currentRows: TournamentLiveCalcData[],
	options?: { staleEntryIds?: ReadonlySet<number> }
): TournamentEntry[] => {
	const staleIds = options?.staleEntryIds
	// Rank only successful rows so retained failed scores cannot steal places.
	const rankSource =
		staleIds && staleIds.size > 0
			? currentRows.filter(row => !staleIds.has(row.entry))
			: currentRows
	const currentRankByEntryId = buildRankMap(rankSource)

	return currentRows.map(row => {
		const score = traceableLiveScore(row.score)
		const headlineEventPoints = score?.eventPoints ?? null
		const headlineNetPoints = score?.netEventPoints ?? null
		const headlineTotalPoints =
			score?.totalScope === 'OVERALL' && typeof score.totalPoints === 'number'
				? score.totalPoints
				: null
		const captainPick = row.pickList.find(player => player.isCaptain)
		const effectiveCaptainPick =
			score?.delivery.state === 'FINAL'
				? (row.pickList.find(player => (player.multiplier ?? 0) >= 2) ??
					captainPick)
				: captainPick
		const captainPoints =
			row.activeCaptain?.points ??
			(typeof row.captainPoints === 'number' ? row.captainPoints : undefined) ??
			(typeof effectiveCaptainPick?.totalPoints === 'number'
				? effectiveCaptainPick.totalPoints
				: 0)
		const stale = Boolean(staleIds?.has(row.entry))
		// Rank is an independent lane. A missing rank never invalidates the score.
		const overallRank = resolveOverallRank(row.rank?.overallRank)

		return {
			id: String(row.entry),
			rank: stale ? 0 : (currentRankByEntryId.get(row.entry) ?? 0),
			teamName: row.entryName ?? `Entry ${row.entry}`,
			managerName: row.playerName ?? '-',
			captainName:
				effectiveCaptainPick?.webName ??
				row.activeCaptain?.name ??
				row.captainName ??
				'N/A',
			captainTeam: effectiveCaptainPick?.teamShortName ?? 'N/A',
			captainPoints,
			gwPoints: headlineEventPoints,
			gwNetPoints: headlineNetPoints ?? undefined,
			eventCost: score?.transferCost,
			overallRank,
			livePoints: headlineEventPoints,
			totalPoints: headlineTotalPoints,
			playersPlayed: row.played ?? 0,
			playersToPlay: row.toPlay ?? 0,
			teamValue: typeof row.teamValue === 'number' ? row.teamValue : undefined,
			bank: typeof row.bank === 'number' ? row.bank : undefined,
			picks: row.pickList.map(player => ({
				element: player.element,
				webName: player.webName,
				teamShortName: player.teamShortName,
				teamName: player.teamName,
				elementTypeName: player.elementTypeName,
				position: player.position,
				multiplier: player.multiplier,
				pickActive: player.pickActive,
				autoSub: player.autoSub,
				isCaptain: player.isCaptain,
				isViceCaptain: player.isViceCaptain
			})),
			chips: mapEventChipToFlags(row.chip),
			stale
		}
	})
}

export const countReadyTournamentScores = (
	rows: readonly TournamentLiveCalcData[]
): number =>
	rows.filter(row => hasTraceableLiveEventPoints(row.score)).length

export const getBoundedTraceableTournamentCoverage = ({
	rows,
	totalEntries,
	officialCoverage
}: {
	rows: readonly TournamentLiveCalcData[]
	totalEntries: number
	officialCoverage?: number | null
}): number => {
	const total = Math.max(0, Math.floor(totalEntries))
	const rowCoverage = Math.min(total, countReadyTournamentScores(rows))
	if (rowCoverage === 0) return 0
	if (
		typeof officialCoverage !== 'number' ||
		!Number.isFinite(officialCoverage) ||
		officialCoverage <= 0
	) {
		return rowCoverage
	}
	const reportedCoverage = Math.min(
		total,
		Math.max(0, Math.round(officialCoverage * total))
	)
	return Math.min(rowCoverage, reportedCoverage)
}

/**
 * Refresh scheduling is transport metadata, not a score value. Keep a valid
 * deadline even when the accompanying score is rejected by provenance checks,
 * otherwise a settled player snapshot can stop polling before the score heals.
 */
export const getTournamentNextRefreshAt = (
	rows: readonly TournamentLiveCalcData[]
): string | null => {
	const refreshTimes = rows
		.map(row => row.score?.times.nextRefreshAt)
		.filter(
			(value): value is string =>
				typeof value === 'string' && Number.isFinite(Date.parse(value))
		)
		.sort((left, right) => Date.parse(left) - Date.parse(right))
	return refreshTimes[0] ?? null
}

/**
 * Entry IDs that were kept from the previous batch because they failed to
 * recalculate and are not present in `nextRows`. Only these should be marked
 * stale for ranking — never every id in `failedEntryIds` (some may still
 * appear in a successful result row).
 */
export const getRetainedFailedEntryIds = ({
	nextRows,
	previousRows,
	failedEntryIds,
	preserveFailed
}: {
	nextRows: TournamentLiveCalcData[]
	previousRows: TournamentLiveCalcData[]
	failedEntryIds: readonly number[]
	preserveFailed: boolean
}): number[] => {
	if (!preserveFailed || failedEntryIds.length === 0) return []
	const failed = new Set(failedEntryIds)
	const refreshed = new Set(nextRows.map(row => row.entry))
	return previousRows
		.filter(row => failed.has(row.entry) && !refreshed.has(row.entry))
		.map(row => row.entry)
}

export const mergePartialTournamentRows = ({
	nextRows,
	previousRows,
	failedEntryIds,
	preserveFailed
}: {
	nextRows: TournamentLiveCalcData[]
	previousRows: TournamentLiveCalcData[]
	failedEntryIds: readonly number[]
	preserveFailed: boolean
}): TournamentLiveCalcData[] => {
	if (!preserveFailed || failedEntryIds.length === 0) return nextRows

	const failed = new Set(failedEntryIds)
	const refreshed = new Set(nextRows.map(row => row.entry))
	const retained = previousRows.filter(
		row => failed.has(row.entry) && !refreshed.has(row.entry)
	)
	return [...nextRows, ...retained]
}

export const buildTournamentStats = (
	entries: TournamentEntry[]
): LiveTournamentStats => {
	// Exclude stale retained rows so avg/highest are not inflated by failed recalcs.
	const liveEntries = entries.filter(
		entry => !entry.stale && typeof entry.livePoints === 'number'
	)
	if (liveEntries.length === 0) {
		return {
			averagePoints: 0,
			highestPoints: 0,
			totalEntries: entries.length
		}
	}

	const totalPoints = liveEntries.reduce(
		(sum, entry) => sum + (entry.livePoints ?? 0),
		0
	)
	const highestPoints = liveEntries.reduce(
		(max, entry) => Math.max(max, entry.livePoints ?? 0),
		liveEntries[0]?.livePoints ?? 0
	)

	return {
		averagePoints: totalPoints / liveEntries.length,
		highestPoints,
		totalEntries: entries.length
	}
}

const liveAverageFormatter = new Intl.NumberFormat('en-GB', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	useGrouping: false
})

export const formatLiveAveragePoints = (value: number): string =>
	Number.isFinite(value) ? liveAverageFormatter.format(value) : '—'
