import type {
	TrendAccess,
	TrendCohort
} from '@/lib/graphql/operations/trends'

export type TrendUrlSelection = {
	access: TrendAccess
	cohortId: string
	eventId: number
}

export type TrendUrlAccessResolution = {
	access: TrendAccess
	ready: boolean
}

/**
 * Client selector entries are written with a small marker so a later
 * Next/App Router restoration can distinguish an explicit local selection
 * from a server-seeded default. The marker is only a history hint; access is
 * still checked against the loaded cohort catalog before it is used.
 */
export function isTrendSelectionHistoryState(
	state: unknown,
	selection: TrendUrlSelection
): boolean {
	if (!state || typeof state !== 'object') return false
	const candidate = state as Record<string, unknown>
	return (
		candidate.__letletmeTrendSelection === true &&
		candidate.access === selection.access &&
		candidate.cohort === selection.cohortId &&
		candidate.gw === selection.eventId
	)
}

function normalizeTrendCohortId(raw: string | null) {
	if (!raw) return null
	if (
		/^(?:competition|custom):[1-9][0-9]*$|^rank-sample:[a-z0-9][a-z0-9._-]{0,63}$/i.test(
			raw
		)
	)
		return raw
	return /^[1-9][0-9]*$/.test(raw) ? `competition:${raw}` : null
}

/**
 * Reads the explicit selector encoded by a Trends history entry.
 *
 * A missing scope is intentionally not considered explicit: the server may
 * choose a different access scope when resolving a default selection.
 */
export function readTrendUrlSelection(currentHref: string): TrendUrlSelection | null {
	const url = new URL(currentHref)
	const scope = url.searchParams.get('scope')
	if (scope !== 'mine' && scope !== 'public') return null
	const cohortId = normalizeTrendCohortId(
		url.searchParams.get('cohort') ?? url.searchParams.get('tournament')
	)
	const eventId = Number(url.searchParams.get('gw'))
	if (!cohortId || !Number.isInteger(eventId) || eventId < 1 || eventId > 38) {
		return null
	}
	return {
		access: scope === 'mine' ? 'MINE' : 'PUBLIC',
		cohortId,
		eventId
	}
}

export function resolveTrendUrlAccess(
	selection: TrendUrlSelection | null,
	cohorts: TrendCohort[]
): TrendUrlAccessResolution | null {
	if (!selection) return null
	const matches = cohorts.filter(cohort => cohort.id === selection.cohortId)
	const access = matches.some(cohort => cohort.access === 'MINE')
		? 'MINE'
		: matches.some(cohort => cohort.access === 'PUBLIC')
			? 'PUBLIC'
			: null
	if (!access) return null
	return {
		access,
		ready: matches.some(
			cohort =>
				cohort.access === access &&
				cohort.setupStatus?.toLowerCase() === 'ready'
		)
	}
}

export function buildTrendUrl(
	currentHref: string,
	access: TrendAccess,
	cohortId: string,
	eventId: number
) {
	const url = new URL(currentHref)
	url.searchParams.set('cohort', cohortId)
	url.searchParams.set('gw', String(eventId))
	url.searchParams.set('scope', access === 'MINE' ? 'mine' : 'public')
	url.searchParams.delete('tournament')
	return url
}
