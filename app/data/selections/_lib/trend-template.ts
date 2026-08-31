import type { TrendDeskRow } from '@/lib/graphql/operations/trends'

export type TrendTemplate = {
	starters: TrendDeskRow[]
	bench: TrendDeskRow[]
	formation: string
}

const FULL_SQUAD_QUOTAS: Record<number, number> = {
	1: 2,
	2: 5,
	3: 5,
	4: 3
}

/** Validate the server-produced ordering before allowing it into the pitch. */
export function buildTrendTemplate(
	rows: readonly TrendDeskRow[] | null
): TrendTemplate | null {
	if (!rows || rows.length !== 15) return null
	if (new Set(rows.map(row => row.elementId)).size !== rows.length) return null

	const squadPositionCounts = rows.reduce<Record<number, number>>(
		(counts, row) => {
			counts[row.playerPosition] = (counts[row.playerPosition] ?? 0) + 1
			return counts
		},
		{}
	)
	if (
		Object.entries(FULL_SQUAD_QUOTAS).some(
			([position, quota]) => squadPositionCounts[Number(position)] !== quota
		)
	) {
		return null
	}

	const teamCounts = new Map<string, number>()
	for (const row of rows) {
		const team = row.teamShortName.trim()
		if (!team) return null
		teamCounts.set(team, (teamCounts.get(team) ?? 0) + 1)
	}
	if (Math.max(...Array.from(teamCounts.values())) > 3) return null

	const starters = rows.slice(0, 11)
	const bench = rows.slice(11)
	const starterCounts = starters.reduce<Record<number, number>>(
		(counts, row) => {
			counts[row.playerPosition] = (counts[row.playerPosition] ?? 0) + 1
			return counts
		},
		{}
	)
	if (
		starterCounts[1] !== 1 ||
		(starterCounts[2] ?? 0) < 3 ||
		(starterCounts[3] ?? 0) < 2 ||
		(starterCounts[4] ?? 0) < 1
	) {
		return null
	}

	return {
		starters,
		bench,
		formation: [2, 3, 4].map(position => starterCounts[position] ?? 0).join('-')
	}
}
