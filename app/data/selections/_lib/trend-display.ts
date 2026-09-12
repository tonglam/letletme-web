import type {
	TrendDeskRow,
	TrendDeskSection
} from '@/lib/graphql/operations/trends'

export const TOP_RANK_LIMIT = 12

const ZERO_FREE_RANKED_CAPABILITIES = new Set([
	'CAPTAINCY',
	'VICE_CAPTAINCY'
])

export function getTrendDisplayRows(
	section: Pick<TrendDeskSection, 'capability' | 'rows'>
): TrendDeskRow[] | null {
	if (section.rows === null) return null

	const rows = ZERO_FREE_RANKED_CAPABILITIES.has(section.capability)
		? section.rows.filter(row => row.count > 0)
		: section.rows

	return section.capability === 'TEMPLATE' ||
		section.capability === 'PERSONAL_EXPOSURE'
		? rows
		: rows.slice(0, TOP_RANK_LIMIT)
}
