import type { LiveCalcData } from '@/lib/graphql/operations/live'
import type { Player, PlayerBreakdownStat } from '@/types/player'

type NumericPositionMode = 'elementType' | 'squadOrder'

type AggregatedBreakdown = Map<string, { value: number; points: number }>

export type BreakdownLookup = Map<
	string,
	{
		teamShortName: string
		stats: PlayerBreakdownStat[]
	}
>

const aggregateBreakdownStats = (
	stats?: PlayerBreakdownStat[]
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
	stats?: PlayerBreakdownStat[]
): PlayerBreakdownStat[] => {
	const aggregated = aggregateBreakdownStats(stats)
	return Array.from(aggregated.entries()).map(([identifier, totals]) => ({
		identifier,
		value: totals.value,
		points: totals.points
	}))
}

export function buildEventLiveExplainBatchQuery(
	elementIds: number[]
): string | null {
	const safeElementIds = Array.from(
		new Set(elementIds.filter(id => Number.isSafeInteger(id) && id > 0))
	).slice(0, 15)
	if (safeElementIds.length === 0) {
		return null
	}

	const fields = safeElementIds
		.map(
			elementId => `
      e${elementId}: eventLiveExplain(eventId: $eventId, elementId: ${elementId}) {
        player {
          id
          webName
          team {
            id
            shortName
          }
        }
        breakdown {
          fixtureId
          stats {
            identifier
            value
            points
          }
        }
      }`
		)
		.join('\n')

	return `
    query GetEventLiveExplainBatch($eventId: Int!) {
      ${fields}
    }
  `
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
		const breakdownStats = breakdownEntry?.stats ?? []
		const aggregatedBreakdown = aggregateBreakdownStats(breakdownStats)

		const getValue = (identifier: string) =>
			aggregatedBreakdown.get(identifier)?.value
		const getPoints = (identifier: string) =>
			aggregatedBreakdown.get(identifier)?.points

		const minutes = getValue('minutes') ?? pick.minutes
		const goalsScored = getValue('goals_scored') ?? pick.goalsScored
		const assists = getValue('assists') ?? pick.assists
		const cleanSheets = getValue('clean_sheets') ?? 0
		const saves = getValue('saves') ?? 0
		const penaltiesSaved = getValue('penalties_saved') ?? 0
		const yellowCards = getValue('yellow_cards') ?? 0
		const redCards = getValue('red_cards') ?? 0
		const bonusPoints = getPoints('bonus') ?? pick.bonus
		const totalPoints =
			getPoints('total') ?? getPoints('total_points') ?? pick.totalPoints

		let playingStatus: Player['playingStatus']
		if (minutes >= 90) {
			playingStatus = 'FINISHED'
		} else if (minutes > 0) {
			playingStatus = 'PLAYING'
		} else if (pick.starts) {
			playingStatus = 'PLAYING'
		} else {
			playingStatus = 'NOT_STARTED'
		}

		return {
			id: String(pick.element),
			name: pick.webName,
			team: breakdownEntry?.teamShortName ?? '',
			teamShort: breakdownEntry?.teamShortName ?? '',
			position,
			playingStatus,
			isBench,
			isBenchBoostActive: benchBoostActive,
			breakdownStats,
			stats: {
				minutes,
				goals: goalsScored,
				expectedGoals: pick.expectedGoals ?? 0,
				expectedAssists: pick.expectedAssists ?? 0,
				expectedGoalInvolvements: pick.expectedGoalInvolvements ?? 0,
				expectedGoalsConceded: pick.expectedGoalsConceded ?? 0,
				assists,
				saves,
				savePenalty: penaltiesSaved,
				cleanSheets,
				yellowCards,
				redCards,
				points: totalPoints,
				bonusPoints: bonusPoints ?? 0
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
