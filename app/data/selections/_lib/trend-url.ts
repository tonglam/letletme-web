import type { TrendAccess } from '@/lib/graphql/operations/trends'

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
