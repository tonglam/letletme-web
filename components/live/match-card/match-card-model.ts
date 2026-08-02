import type { PlayerLiveStats } from '@/lib/graphql/operations/live'
import type { Match, PlayerStat } from '@/types/match'
import type { PlayerDetail } from '@/types/player-detail'

export type MatchHighlightKind =
	| 'bonus'
	| 'goals'
	| 'assists'
	| 'defensive'
	| 'bps'
	| 'saves'
	| 'yellow'
	| 'red'

export interface MatchHighlightGroup {
	kind: MatchHighlightKind
	title: string
	items: Array<{ player: string; team: string; value: number }>
}

export interface PlayerMetric {
	label: string
	value: number
	tone: 'neutral' | 'success' | 'info' | 'warning' | 'destructive'
}

export const isMatchStarted = (match: Match): boolean =>
	match.status !== 'UPCOMING' && match.status !== 'NOT_STARTED'

const sortedPlayerValues = (
	players: Array<PlayerStat & { team: string }>,
	readValue: (player: PlayerStat) => number | undefined,
) =>
	players
		.map((player) => ({ player: player.player, team: player.team, value: readValue(player) ?? 0 }))
		.filter((item) => item.value > 0)
		.sort((left, right) => right.value - left.value)

export function buildMatchHighlights(match: Match): MatchHighlightGroup[] {
	if (!isMatchStarted(match)) return []
	const players = [
		...match.homeTeam.players.map((player) => ({ ...player, team: match.homeTeam.shortName })),
		...match.awayTeam.players.map((player) => ({ ...player, team: match.awayTeam.shortName })),
	]
	const groups: MatchHighlightGroup[] = [
		{
			kind: 'bonus',
			title: 'Bonus Points',
			items: (match.bonusPoints ?? []).map((item) => ({ player: item.player, team: item.team, value: item.points })),
		},
		{ kind: 'goals', title: 'Goals', items: sortedPlayerValues(players, (player) => player.goals) },
		{ kind: 'assists', title: 'Assists', items: sortedPlayerValues(players, (player) => player.assists) },
		{
			kind: 'defensive',
			title: 'Defensive Contribution',
			items: sortedPlayerValues(players, (player) =>
				(player.defensiveContribution ?? 0) >= 10 ? player.defensiveContribution : 0,
			),
		},
		{
			kind: 'bps',
			title: 'Bonus Point System (BPS)',
			items: players
				.filter((player) => player.bps != null)
				.map((player) => ({ player: player.player, team: player.team, value: player.bps ?? 0 }))
				.sort((left, right) => right.value - left.value)
				.slice(0, 5),
		},
		{ kind: 'saves', title: 'Saves', items: sortedPlayerValues(players, (player) => player.saves) },
		{ kind: 'yellow', title: 'Yellow Cards', items: sortedPlayerValues(players, (player) => player.yellow_cards) },
		{ kind: 'red', title: 'Red Cards', items: sortedPlayerValues(players, (player) => player.red_cards) },
	]
	return groups.filter((group) => group.items.length > 0)
}

export function getPlayersWithPoints(players: PlayerStat[]): PlayerStat[] {
	return players
		.filter((player) => (player.totalPoints ?? 0) > 0)
		.slice()
		.sort((left, right) => (right.totalPoints ?? 0) - (left.totalPoints ?? 0))
}

export function getPlayerMetrics(player: PlayerStat): PlayerMetric[] {
	const metrics: Array<PlayerMetric | null> = [
		(player.minutes ?? 0) > 0 ? { label: 'MIN', value: player.minutes ?? 0, tone: 'neutral' } : null,
		(player.goals ?? 0) > 0 ? { label: 'Goals', value: player.goals ?? 0, tone: 'success' } : null,
		(player.assists ?? 0) > 0 ? { label: 'Assists', value: player.assists ?? 0, tone: 'info' } : null,
		(player.cleanSheets ?? 0) > 0 ? { label: 'CS', value: player.cleanSheets ?? 0, tone: 'info' } : null,
		isDefensiveContributionEarned(player)
			? { label: 'Def', value: player.defensiveContribution ?? 0, tone: 'info' }
			: null,
		(player.saves ?? 0) >= 3 ? { label: 'Saves', value: player.saves ?? 0, tone: 'info' } : null,
		(player.yellow_cards ?? 0) > 0 ? { label: 'YC', value: player.yellow_cards ?? 0, tone: 'warning' } : null,
		(player.red_cards ?? 0) > 0 ? { label: 'RC', value: player.red_cards ?? 0, tone: 'destructive' } : null,
		(player.penalties_saved ?? 0) > 0 ? { label: 'PS', value: player.penalties_saved ?? 0, tone: 'success' } : null,
		(player.penalties_missed ?? 0) > 0 ? { label: 'PM', value: player.penalties_missed ?? 0, tone: 'destructive' } : null,
		(player.ownGoals ?? 0) > 0 ? { label: 'OG', value: player.ownGoals ?? 0, tone: 'destructive' } : null,
		(player.goalsConceded ?? 0) >= 2 && (player.elementType === 1 || player.elementType === 2)
			? { label: 'GC', value: player.goalsConceded ?? 0, tone: 'warning' }
			: null,
	]
	return metrics.filter((metric): metric is PlayerMetric => metric !== null)
}

function isDefensiveContributionEarned(player: PlayerStat): boolean {
	const contribution = player.defensiveContribution ?? 0
	if (player.elementType === 2) return contribution >= 10
	if (player.elementType === 3 || player.elementType === 4) return contribution >= 12
	return false
}

export function getPositionFromElementType(elementType?: number): 'GKP' | 'DEF' | 'MID' | 'FWD' {
	if (elementType === 1) return 'GKP'
	if (elementType === 2) return 'DEF'
	if (elementType === 4) return 'FWD'
	return 'MID'
}

export function createBasePlayerDetail(player: PlayerStat, team: string, teamShort: string): PlayerDetail {
	return {
		id: player.player,
		name: player.player,
		team,
		teamShort,
		position: getPositionFromElementType(player.elementType),
		points: player.totalPoints ?? 0,
		ownershipPercentage: 0,
		bps: player.bps ?? 0,
		bonusPoints: player.bonus_points ?? 0,
		stats: {
			minutes: player.minutes ?? 0,
			goals: player.goals ?? 0,
			assists: player.assists ?? 0,
			cleanSheets: player.cleanSheets ?? 0,
			saves: player.saves ?? 0,
			penaltiesSaved: player.penalties_saved ?? 0,
			yellowCards: player.yellow_cards ?? 0,
			redCards: player.red_cards ?? 0,
		},
		pointsBreakdown: [],
	}
}

export function buildBreakdownFromPlayerLive(
	stats: PlayerLiveStats,
	elementType: number,
): PlayerDetail['pointsBreakdown'] {
	const rows: PlayerDetail['pointsBreakdown'] = []
	const minutesPoints = stats.minutes === 0 ? 0 : stats.minutes < 60 ? 1 : 2
	if (minutesPoints > 0) rows.push({ category: 'Minutes Played', points: minutesPoints, value: stats.minutes })
	if (stats.goalsScored > 0) {
		const pointsPerGoal = elementType <= 2 ? 6 : elementType === 3 ? 5 : 4
		rows.push({ category: 'Goals Scored', points: stats.goalsScored * pointsPerGoal, value: stats.goalsScored })
	}
	if (stats.assists > 0) rows.push({ category: 'Assists', points: stats.assists * 3, value: stats.assists })
	if (stats.cleanSheets > 0 && stats.minutes >= 60) {
		const cleanSheetPoints = elementType <= 2 ? 4 : elementType === 3 ? 1 : 0
		if (cleanSheetPoints > 0) rows.push({ category: 'Clean Sheet', points: cleanSheetPoints, value: stats.cleanSheets })
	}
	const concededPoints = elementType <= 2 ? -Math.floor(stats.goalsConceded / 2) : 0
	if (concededPoints < 0) rows.push({ category: 'Goals Conceded', points: concededPoints, value: stats.goalsConceded })
	const savePoints = Math.floor(stats.saves / 3)
	if (savePoints > 0) rows.push({ category: 'Saves', points: savePoints, value: stats.saves })
	if (stats.penaltiesSaved > 0) rows.push({ category: 'Penalty Saved', points: stats.penaltiesSaved * 5, value: stats.penaltiesSaved })
	if (stats.penaltiesMissed > 0) rows.push({ category: 'Penalty Missed', points: stats.penaltiesMissed * -2, value: stats.penaltiesMissed })
	if (stats.ownGoals > 0) rows.push({ category: 'Own Goal', points: stats.ownGoals * -2, value: stats.ownGoals })
	if (stats.yellowCards > 0) rows.push({ category: 'Yellow Card', points: -stats.yellowCards, value: stats.yellowCards })
	if (stats.redCards > 0) rows.push({ category: 'Red Card', points: stats.redCards * -3, value: stats.redCards })
	if (stats.bonus > 0) rows.push({ category: 'Bonus', points: stats.bonus, value: stats.bonus })
	return rows
}

export function formatMatchKickoff(kickoff: string, locale: string): string | null {
	if (!kickoff) return null
	const date = new Date(kickoff)
	if (Number.isNaN(date.getTime())) return null
	return new Intl.DateTimeFormat(locale, {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(date)
}
