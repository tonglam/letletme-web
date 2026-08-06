import type { OwnershipScope } from './player-ownership-filter'

export interface TeamExposurePick {
	teamShortName: string
	teamName: string
	position: number
}

export interface TeamExposureEntry {
	id: string
	picks: TeamExposurePick[]
}

export interface TeamExposureRule {
	/** Club short name, e.g. ARS */
	teamShortName: string
	/** Exact number of players from this team (within scope) */
	exactCount: number
}

export interface TeamExposureFilterSummary {
	matchedEntryIds: string[]
	matchedCount: number
	totalCount: number
	percentage: number
}

const pickMatchesScope = (pick: TeamExposurePick, scope: OwnershipScope) => {
	if (scope === 'starter') return pick.position <= 11
	if (scope === 'bench') return pick.position > 11
	return true
}

export const entryMatchesTeamExposureRules = (
	entry: TeamExposureEntry,
	rules: TeamExposureRule[],
	scope: OwnershipScope,
): boolean => {
	if (rules.length === 0) return true

	return rules.every(rule => {
		const count = entry.picks.filter(
			p => p.teamShortName === rule.teamShortName && pickMatchesScope(p, scope),
		).length
		return count === rule.exactCount
	})
}

/**
 * Multi-team exposure: entry must satisfy every rule (AND), same idea as
 * multi-player ownership requiring all selected players.
 */
export const getTeamExposureFilterSummary = (
	entries: TeamExposureEntry[],
	rules: TeamExposureRule[],
	scope: OwnershipScope,
): TeamExposureFilterSummary => {
	const matchedEntryIds =
		rules.length === 0
			? entries.map(e => e.id)
			: entries
					.filter(entry => entryMatchesTeamExposureRules(entry, rules, scope))
					.map(e => e.id)

	const totalCount = entries.length
	const matchedCount = matchedEntryIds.length

	return {
		matchedEntryIds,
		matchedCount,
		totalCount,
		percentage:
			totalCount === 0 ? 0 : Math.round((matchedCount / totalCount) * 100),
	}
}
