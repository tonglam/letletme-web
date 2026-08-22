import type { TrendCohort } from '@/lib/graphql/operations/trends'

/**
 * Build the competitions visible to an entry. Membership wins when a
 * competition is also present in the public whitelist, so private exposure
 * remains available without rendering the same competition twice.
 */
export function mergeVisibleTrendCohorts(
	myCohorts: TrendCohort[],
	publicCohorts: TrendCohort[]
): TrendCohort[] {
	const visible = new Map<string, TrendCohort>()
	for (const cohort of myCohorts) visible.set(cohort.id, cohort)
	for (const cohort of publicCohorts) {
		if (!visible.has(cohort.id)) visible.set(cohort.id, cohort)
	}
	return Array.from(visible.values())
}

export function isTrendCohortReady(cohort: TrendCohort): boolean {
	return cohort.setupStatus?.toLowerCase() === 'ready'
}
