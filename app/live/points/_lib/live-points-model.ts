import type { LiveCalcData } from '@/lib/graphql/operations/live'
import type { Player, PlayerBreakdownStat } from '@/types/player'

type NumericPositionMode = 'elementType' | 'squadOrder'

type AggregatedBreakdown = Map<string, { value: number; points: number }>
type BreakdownStatInput = {
	identifier: string
	value: number | null
	points: number
}

export type BreakdownLookup = Map<
	string,
	{
		stats: PlayerBreakdownStat[]
		explanationStats?: Player['explanationStats']
	}
>

export type CachedBreakdownLookup = {
	requestKey: string
	lookup: BreakdownLookup
}

export type LiveDataForRequest = {
	requestKey: string
	live: LiveCalcData
}

export function selectLiveDataForExplainResponse({
	responseRequestId,
	currentRequestId,
	requestKey,
	currentRequestKey,
	responseLive,
	currentLive
}: {
	responseRequestId: number
	currentRequestId: number
	requestKey: string
	currentRequestKey: string | null
	responseLive: LiveCalcData
	currentLive: LiveDataForRequest | null
}): LiveCalcData | null {
	const latestLiveForRequest =
		currentLive?.requestKey === requestKey ? currentLive.live : null
	if (responseRequestId === currentRequestId) {
		return latestLiveForRequest ?? responseLive
	}

	// A manual refresh can supersede the live-points request while its explain
	// enrichment remains in flight. Keep that response only when the latest
	// request still targets the same entry and event, and apply it to the newest
	// accepted live data rather than overwriting the UI with the older snapshot.
	if (currentRequestKey !== requestKey) return null
	return latestLiveForRequest
}

export function breakdownLookupForRequest(
	cached: CachedBreakdownLookup | null,
	requestKey: string
): BreakdownLookup {
	return cached?.requestKey === requestKey ? cached.lookup : new Map()
}

const aggregateBreakdownStats = (
	stats?: readonly BreakdownStatInput[]
): AggregatedBreakdown => {
	return (stats ?? []).reduce<AggregatedBreakdown>((acc, stat) => {
		const existing = acc.get(stat.identifier) ?? { value: 0, points: 0 }
		acc.set(stat.identifier, {
			value: existing.value + (stat.value ?? 0),
			points: existing.points + (stat.points ?? 0)
		})
		return acc
	}, new Map())
}

export const rollupBreakdownStats = (
	stats?: readonly BreakdownStatInput[]
): PlayerBreakdownStat[] => {
	const aggregated = aggregateBreakdownStats(stats)
	return Array.from(aggregated.entries()).map(([identifier, totals]) => ({
		identifier,
		value: totals.value,
		points: totals.points
	}))
}

export function normalizeLiveExplainElementIds(elementIds: number[]): number[] {
	return Array.from(
		new Set(elementIds.filter(id => Number.isSafeInteger(id) && id > 0))
	).slice(0, 15)
}

export function liveExplanationMatchesCurrentStats(
	player: Pick<Player, 'breakdownStats' | 'explanationStats' | 'stats'>
): boolean {
	if (!player.breakdownStats) return false
	const currentValues = [
		['minutes', 'minutes', player.stats.minutes],
		['goalsScored', 'goals_scored', player.stats.goals],
		['assists', 'assists', player.stats.assists],
		['cleanSheets', 'clean_sheets', player.stats.cleanSheets],
		['goalsConceded', 'goals_conceded', player.stats.goalsConceded ?? 0],
		['ownGoals', 'own_goals', player.stats.ownGoals ?? 0],
		['penaltiesSaved', 'penalties_saved', player.stats.savePenalty],
		['penaltiesMissed', 'penalties_missed', player.stats.penaltiesMissed ?? 0],
		['yellowCards', 'yellow_cards', player.stats.yellowCards],
		['redCards', 'red_cards', player.stats.redCards],
		['saves', 'saves', player.stats.saves],
		[
			'defensiveContribution',
			'defensive_contribution',
			player.stats.defensiveContribution ?? 0
		],
		['bonus', 'bonus', player.stats.bonusPoints]
	] as const
	const explainedValues = aggregateBreakdownStats(player.breakdownStats)

	return currentValues.every(([statsKey, identifier, currentValue]) => {
		const persistedValue = player.explanationStats?.[statsKey]
		if (persistedValue !== undefined && persistedValue !== null) {
			return persistedValue === currentValue
		}
		return (explainedValues.get(identifier)?.value ?? 0) === currentValue
	})
}

function normalizePosition(
	position: unknown,
	numericMode: NumericPositionMode
): Player['position'] {
	// Some APIs return numeric codes:
	// - element type: 1..4 (GKP/DEF/MID/FWD)
	// - squad order: 1..15 (2 GKP, 5 DEF, 5 MID, 3 FWD)
	if (typeof position === 'number') {
		if (numericMode === 'elementType') {
			switch (position) {
				case 1:
					return 'GKP'
				case 2:
					return 'DEF'
				case 3:
					return 'MID'
				case 4:
					return 'FWD'
				default:
					// Keep UI stable; backend sent unexpected value.
					return 'MID'
			}
		}

		// squadOrder
		if (position >= 1 && position <= 2) return 'GKP'
		if (position >= 3 && position <= 7) return 'DEF'
		if (position >= 8 && position <= 12) return 'MID'
		if (position >= 13 && position <= 15) return 'FWD'
		return 'MID'
	}

	if (typeof position !== 'string') {
		return 'MID'
	}

	const p = position.trim().toUpperCase()

	switch (p) {
		case 'GKP':
		case 'GK':
		case 'GOALKEEPER':
			return 'GKP'
		case 'DEF':
		case 'D':
		case 'DEFENDER':
			return 'DEF'
		case 'MID':
		case 'M':
		case 'MIDFIELDER':
			return 'MID'
		case 'FWD':
		case 'FW':
		case 'F':
		case 'FORWARD':
		case 'STR':
			return 'FWD'
		default:
			return 'MID'
	}
}

export function mapLiveDataToPlayers(
	live: LiveCalcData,
	breakdownLookup: BreakdownLookup
): Player[] {
	const benchBoostActive =
		!!live.chip && live.chip.toLowerCase().includes('bench')
	const sortedPicks = [...live.pickList].sort((a, b) => a.position - b.position)

	return sortedPicks.map(pick => {
		const isCaptain = live.captainName === pick.webName
		// Keep bench-vs-starting distinction stable, even when Bench Boost is active.
		const isBench = pick.position >= 12
		const position = normalizePosition(pick.elementType, 'elementType')
		const breakdownEntry = breakdownLookup.get(String(pick.element))
		const breakdownStats = breakdownEntry?.stats
		const explanationStats = breakdownEntry?.explanationStats

		// The entry calculation is refreshed with the live snapshot. Explanation
		// rows persist less often and enrich only the modal point breakdown; they
		// must never overwrite current match stats or the calculated total.
		const minutes = pick.minutes

		let playingStatus: Player['playingStatus']
		if (pick.isGwFinished) {
			playingStatus = 'FINISHED'
		} else if (
			pick.isGwStarted &&
			(pick.isPlayed || minutes > 0 || pick.starts === true)
		) {
			playingStatus = 'PLAYING'
		} else {
			playingStatus = 'NOT_STARTED'
		}

		return {
			id: String(pick.element),
			name: pick.webName,
			team: pick.teamName,
			teamShort: pick.teamShortName,
			position,
			playingStatus,
			isBench,
			isBenchBoostActive: benchBoostActive,
			breakdownStats,
			explanationStats,
			stats: {
				minutes,
				goals: pick.goalsScored,
				expectedGoals: pick.expectedGoals ?? 0,
				expectedAssists: pick.expectedAssists ?? 0,
				expectedGoalInvolvements: pick.expectedGoalInvolvements ?? 0,
				expectedGoalsConceded: pick.expectedGoalsConceded ?? 0,
				assists: pick.assists,
				saves: pick.saves,
				savePenalty: pick.penaltiesSaved,
				cleanSheets: pick.cleanSheets,
				goalsConceded: pick.goalsConceded,
				defensiveContribution: pick.defensiveContribution,
				ownGoals: pick.ownGoals,
				penaltiesMissed: pick.penaltiesMissed,
				yellowCards: pick.yellowCards,
				redCards: pick.redCards,
				points: pick.totalPoints,
				bonusPoints: pick.bonus
			},
			isCaptain,
			isViceCaptain: false
		}
	})
}

export function deriveLiveTeamStats(live: LiveCalcData) {
	const startingPicks = live.pickList.filter(pick => pick.position <= 11)
	const playedCount = startingPicks.filter(
		pick => (pick.minutes ?? 0) > 0
	).length
	const normalizedChip = live.chip?.toLowerCase() ?? ''

	return {
		teamName: live.entryName ?? `Entry ${live.entry}`,
		playerName: live.playerName ?? '',
		livePoints: live.livePoints,
		transferCost: live.transferCost ?? 0,
		captainName: live.captainName,
		liveTotalPoints: live.liveTotalPoints,
		played: `${playedCount}/${startingPicks.length}`,
		chips: {
			bench: normalizedChip.includes('bench'),
			triple:
				normalizedChip.includes('3x') || normalizedChip.includes('triple'),
			wildcard: normalizedChip.includes('wildcard')
		}
	}
}
