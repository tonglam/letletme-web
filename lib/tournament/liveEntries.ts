import {
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse
} from '@/lib/graphql/operations/tournaments'
import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'
import { type TournamentEntry } from '@/types/tournament'

export type LiveTournamentStats = {
	averagePoints: number
	highestPoints: number
	totalEntries: number
}

export const mergeUnavailableTournamentEntryIds = (
	failedEntryIds: readonly number[],
	unavailableEntryIds: readonly number[]
): number[] => Array.from(new Set([...failedEntryIds, ...unavailableEntryIds]))

/**
 * Keep producer metadata independent from per-entry calculation failures.
 * A partial batch can still carry a valid SETTLED snapshot that must stop
 * revision polling while its row error remains visible to the user.
 */
export const getTournamentLiveBatchSeed = (
	response: TournamentLivePointsResponse
) => {
	const unavailableEntryIds = mergeUnavailableTournamentEntryIds(
		response.entryLiveCompetitionsDesk.failedEntryIds,
		response.entryLiveCompetitionsDesk.unavailableEntryIds ?? []
	)
	return {
		rows: response.entryLiveCompetitionsDesk.board ?? [],
		snapshot: {
			eventId: response.entryLiveCompetitionsDesk.eventId,
			revision: response.entryLiveCompetitionsDesk.revision,
			state: (response.entryLiveCompetitionsDesk.windowState ??
				response.entryLiveCompetitionsDesk
					.state) as LiveSnapshotStatus['state'],
			publishedAt: null,
			checkedAt: null,
			windowState: response.entryLiveCompetitionsDesk
				.windowState as LiveSnapshotStatus['windowState'],
			dataAvailability: response.entryLiveCompetitionsDesk
				.dataAvailability as LiveSnapshotStatus['dataAvailability'],
			nextRefreshAt: response.entryLiveCompetitionsDesk.nextRefreshAt ?? null
		},
		failedCount: unavailableEntryIds.length,
		failedEntryIds: unavailableEntryIds,
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

export const buildRankMap = (
	rows: TournamentLiveCalcData[]
): Map<number, number> => {
	const isOfficialSource = (row: TournamentLiveCalcData): boolean =>
		row.score?.source === 'FPL_ENTRY_SUMMARY' ||
		row.score?.source === 'FPL_CLASSIC_STANDINGS' ||
		row.score?.source === 'FPL_FINAL_RESULT'
	const rankableRows = rows.filter(row => {
		return (
			isOfficialSource(row) && typeof row.score?.netEventPoints === 'number'
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
		const headlineEventPoints = row.score?.eventPoints ?? null
		const headlineNetPoints = row.score?.netEventPoints ?? null
		const headlineTotalPoints =
			typeof row.score?.totalPoints === 'number' ? row.score.totalPoints : null
		const captainPick = row.pickList.find(player => player.isCaptain)
		const effectiveCaptainPick =
			row.score?.state === 'FINAL'
				? (row.pickList.find(player => (player.multiplier ?? 0) >= 2) ??
					captainPick)
				: captainPick
		const captainPoints =
			row.activeCaptain?.points ??
			(typeof effectiveCaptainPick?.totalPoints === 'number'
				? effectiveCaptainPick.totalPoints
				: 0)
		const stale = Boolean(staleIds?.has(row.entry))

		return {
			id: String(row.entry),
			rank: stale
				? 0
				: typeof row.rank === 'number' && row.rank > 0
					? row.rank
					: (currentRankByEntryId.get(row.entry) ?? 0),
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
			eventCost: row.transferCost ?? 0,
			overallRank: row.score?.overallRank ?? row.overallRank ?? 0,
			lastOverallRank:
				typeof row.lastOverallRank === 'number'
					? row.lastOverallRank
					: undefined,
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
		averagePoints: Math.round(totalPoints / liveEntries.length),
		highestPoints,
		totalEntries: entries.length
	}
}
