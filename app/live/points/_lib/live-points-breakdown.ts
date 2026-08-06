import type { Player } from '@/types/player'

export type BreakdownLine = {
	category: string
	points: number
	value?: number
}

/**
 * FPL scoring (2024/25-style) used only when the official explain payload is
 * missing or out of sync. Appearance / CS / goals / cards / bonus mirror the
 * pick totals so the modal is never empty during UI review or early GW sync.
 *
 * Does not attempt DGW fixture splits or auto-subs — those require explain.
 */
export function buildProvisionalBreakdownFromPlayer(
	player: Pick<Player, 'position' | 'stats'>,
): BreakdownLine[] {
	const { position, stats } = player
	const lines: BreakdownLine[] = []

	const push = (category: string, points: number, value?: number) => {
		if (points === 0 && (value === undefined || value === 0)) return
		if (points === 0 && value !== undefined && value !== 0) {
			// Still show zero-point counting events? skip — only scoring impact
			return
		}
		if (points !== 0) lines.push({ category, points, value })
	}

	// Appearance
	if (stats.minutes > 0) {
		const appearancePts = stats.minutes >= 60 ? 2 : 1
		push('Appearance', appearancePts, stats.minutes)
	}

	// Goals (position-weighted)
	if (stats.goals > 0) {
		const per =
			position === 'GKP' || position === 'DEF'
				? 6
				: position === 'MID'
					? 5
					: 4
		push('Goals', stats.goals * per, stats.goals)
	}

	// Assists
	if (stats.assists > 0) {
		push('Assists', stats.assists * 3, stats.assists)
	}

	// Clean sheets
	if (stats.cleanSheets > 0) {
		const per =
			position === 'GKP' || position === 'DEF' ? 4 : position === 'MID' ? 1 : 0
		if (per > 0) push('Clean Sheet', stats.cleanSheets * per, stats.cleanSheets)
	}

	// Goals conceded (−1 per 2 for GKP/DEF, only after 60')
	if (
		(position === 'GKP' || position === 'DEF') &&
		(stats.goalsConceded ?? 0) > 0 &&
		stats.minutes >= 60
	) {
		const gc = stats.goalsConceded ?? 0
		const penalty = -Math.floor(gc / 2)
		if (penalty !== 0) push('Goals Conceded', penalty, gc)
	}

	// Saves (GKP): 1 pt per 3 saves
	if (position === 'GKP' && stats.saves > 0) {
		const pts = Math.floor(stats.saves / 3)
		if (pts !== 0) push('Saves', pts, stats.saves)
	}

	// Penalties saved
	if (stats.savePenalty > 0) {
		push('Penalty Saved', stats.savePenalty * 5, stats.savePenalty)
	}

	// Penalties missed
	if ((stats.penaltiesMissed ?? 0) > 0) {
		push('Penalty Missed', (stats.penaltiesMissed ?? 0) * -2, stats.penaltiesMissed)
	}

	// Own goals
	if ((stats.ownGoals ?? 0) > 0) {
		push('Own Goal', (stats.ownGoals ?? 0) * -2, stats.ownGoals)
	}

	// Cards
	if (stats.yellowCards > 0) {
		push('Yellow Card', stats.yellowCards * -1, stats.yellowCards)
	}
	if (stats.redCards > 0) {
		push('Red Card', stats.redCards * -3, stats.redCards)
	}

	// Defensive contribution (approx — threshold varies by position in FPL)
	// Show raw bonus from pick when present rather than re-derive DC points.
	// Bonus is authoritative on the pick.
	if (stats.bonusPoints > 0) {
		push('Bonus Points', stats.bonusPoints, stats.bonusPoints)
	}

	// Defensive contribution points are already folded into totalPoints by FPL;
	// we cannot recover the exact point award without explain. If DC count is
	// high enough that it might have scored, surface value-only is not useful.
	// Skip unless we later get an explain payload.

	return lines
}

export function breakdownSum(lines: BreakdownLine[]): number {
	return lines.reduce((sum, line) => sum + line.points, 0)
}

/**
 * Prefer official explain when it matches the live total; otherwise fall back
 * to a pick-derived provisional breakdown when that also reconciles.
 */
export function resolvePointsBreakdown(input: {
	official: BreakdownLine[]
	officialMatchesTotal: boolean
	player: Pick<Player, 'position' | 'stats' | 'playingStatus'>
}): { lines: BreakdownLine[]; source: 'official' | 'provisional' | 'none'; pending: boolean } {
	const total = input.player.stats.points

	if (input.officialMatchesTotal && input.official.length > 0) {
		return { lines: input.official, source: 'official', pending: false }
	}

	const provisional = buildProvisionalBreakdownFromPlayer(input.player)
	const provisionalSum = breakdownSum(provisional)

	// Captain/VC multipliers can make provisional sum a divisor of the shown total.
	const matchesExactly = provisionalSum === total
	const matchesDouble =
		provisionalSum > 0 && total === provisionalSum * 2
	const matchesTriple =
		provisionalSum > 0 && total === provisionalSum * 3

	if (matchesExactly || matchesDouble || matchesTriple) {
		const multiplier = matchesTriple ? 3 : matchesDouble ? 2 : 1
		const lines =
			multiplier === 1
				? provisional
				: provisional.map(line => ({
						...line,
						points: line.points * multiplier,
					}))
		return { lines, source: 'provisional', pending: false }
	}

	// Still show provisional when player has scored something, even if sum
	// cannot fully reconcile (e.g. DC points unknown) — better than empty.
	if (provisional.length > 0 && total !== 0) {
		return {
			lines: provisional,
			source: 'provisional',
			pending: provisionalSum !== total,
		}
	}

	const pending =
		input.player.playingStatus !== 'NOT_STARTED' &&
		(total !== 0 || input.player.stats.minutes > 0)

	return { lines: [], source: 'none', pending }
}
