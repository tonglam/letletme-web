import { resolvePointsBreakdown } from '@/app/live/points/_lib/live-points-breakdown'
import {
	liveExplanationMatchesCurrentStats,
	rollupBreakdownStats
} from '@/app/live/points/_lib/live-points-model'
import type {
	EventLiveExplainItem,
	PlayerLiveStats
} from '@/lib/graphql/operations/live'
import type { Player } from '@/types/player'
import type { PlayerDetail } from '@/types/player-detail'

const breakdownOrder = [
	'minutes',
	'goals_scored',
	'assists',
	'clean_sheets',
	'saves',
	'penalties_saved',
	'penalties_missed',
	'yellow_cards',
	'red_cards',
	'own_goals',
	'goals_conceded',
	'defensive_contribution',
	'bonus',
	'total',
	'total_points',
] as const

const breakdownLabelMap: Record<string, string> = {
	minutes: 'Appearance',
	goals_scored: 'Goals',
	assists: 'Assists',
	clean_sheets: 'Clean Sheet',
	saves: 'Saves',
	penalties_saved: 'Penalty Saved',
	penalties_missed: 'Penalty Missed',
	yellow_cards: 'Yellow Card',
	red_cards: 'Red Card',
	own_goals: 'Own Goal',
	goals_conceded: 'Goals Conceded',
	defensive_contribution: 'Defensive Contribution',
	bonus: 'Bonus Points',
	total: 'Total Points',
	total_points: 'Total Points',
}

export function buildLivePlayerDetail(player: Player): PlayerDetail {
	const breakdownFromExplain = (player.breakdownStats ?? [])
		.reduce<Map<string, { points: number; value: number }>>((acc, stat) => {
			const current = acc.get(stat.identifier) ?? { points: 0, value: 0 }
			acc.set(stat.identifier, {
				points: current.points + stat.points,
				value: current.value + (stat.value ?? 0),
			})
			return acc
		}, new Map())

	const orderedKeys = new Set<string>(breakdownOrder)
	const orderedBreakdown = breakdownOrder
		.map(identifier => {
			const entry = breakdownFromExplain.get(identifier)
			if (!entry || entry.points === 0) return null
			return {
				category: breakdownLabelMap[identifier] ?? identifier,
				points: entry.points,
				value: entry.value || undefined,
			}
		})
		.filter(Boolean) as { category: string; points: number; value?: number }[]

	const remaining = Array.from(breakdownFromExplain.entries())
		.filter(([identifier, entry]) => !orderedKeys.has(identifier) && entry.points !== 0)
		.map(([identifier, entry]) => ({
			category: breakdownLabelMap[identifier] ?? identifier,
			points: entry.points,
			value: entry.value || undefined,
		}))
	const breakdown = [...orderedBreakdown, ...remaining]
	const hasExplanation = (player.breakdownStats?.length ?? 0) > 0
	const officialSum = breakdown.reduce((sum, item) => sum + item.points, 0)
	const officialMatchesTotal =
		hasExplanation &&
		liveExplanationMatchesCurrentStats(player) &&
		officialSum === player.stats.points
	const resolved = resolvePointsBreakdown({
		official: breakdown,
		officialMatchesTotal,
		player,
	})

	return {
		id: player.id,
		name: player.name,
		team: player.team,
		teamShort: player.teamShort,
		position: player.position,
		points: player.stats.points,
		ownershipPercentage: null,
		bps: typeof player.bps === 'number' ? player.bps : null,
		bonusPoints: player.stats.bonusPoints,
		playingStatus: player.playingStatus,
		breakdownPending: resolved.pending,
		breakdownSource: resolved.source,
		stats: {
			minutes: player.stats.minutes,
			goals: player.stats.goals,
			assists: player.stats.assists,
			cleanSheets: player.stats.cleanSheets,
			saves: player.stats.saves,
			penaltiesSaved: player.stats.savePenalty,
			yellowCards: player.stats.yellowCards,
			redCards: player.stats.redCards,
			goalsConceded: player.stats.goalsConceded,
			defensiveContribution: player.stats.defensiveContribution,
			ownGoals: player.stats.ownGoals,
			penaltiesMissed: player.stats.penaltiesMissed,
		},
		pointsBreakdown: resolved.lines,
	}
}

export type LivePlayerDetailPayload = {
	explain: EventLiveExplainItem | null
	live: PlayerLiveStats | null
}

/**
 * Merge a targeted live-detail response into the latest pick before deriving
 * the modal view. The pick remains the source of identity and position; the
 * live operation only refreshes event stats and explanation rows.
 */
export function buildLivePlayerDetailWithPayload(
	player: Player,
	payload: LivePlayerDetailPayload | null
): PlayerDetail {
	if (!payload) return buildLivePlayerDetail(player)

	const playerId = Number(player.id)
	const explanation =
		payload.explain && payload.explain.elementId === playerId
			? payload.explain
			: null
	const explanationStats = explanation?.stats
		? { ...player.explanationStats, ...explanation.stats }
		: player.explanationStats
	const explanationRows =
		explanation?.contributions ??
		(explanation?.breakdown ?? []).flatMap(entry => entry.stats)
	const live = payload.live
	const enrichedPlayer: Player = {
		...player,
		...(live ? { bps: live.bps } : {}),
		...(explanationStats ? { explanationStats } : {}),
		...(explanationRows.length > 0
			? { breakdownStats: rollupBreakdownStats(explanationRows) }
			: {}),
		stats: live
			? {
					...player.stats,
					minutes: live.minutes,
					goals: live.goalsScored,
					assists: live.assists,
					cleanSheets: live.cleanSheets,
					saves: live.saves,
					savePenalty: live.penaltiesSaved,
					goalsConceded: live.goalsConceded,
					defensiveContribution: live.defensiveContribution,
					ownGoals: live.ownGoals,
					penaltiesMissed: live.penaltiesMissed,
					yellowCards: live.yellowCards,
					redCards: live.redCards,
					points: live.totalPoints,
					bonusPoints: live.bonus
				}
				: player.stats
	}

	return buildLivePlayerDetail(enrichedPlayer)
}
