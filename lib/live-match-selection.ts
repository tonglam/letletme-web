import type { Match } from '@/types/match'

const PRODUCT_TIME_ZONE = 'Australia/Perth'

function localDate(value: string, timeZone = PRODUCT_TIME_ZONE): string | null {
	const timestamp = Date.parse(value)
	if (!Number.isFinite(timestamp)) return null
	return new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(timestamp))
}

/**
 * Select the event a visitor expects to see on the live matches page.
 * The FPL lifecycle's current event is not enough: after today's last match
 * finishes, the next event is the useful view even if FPL has not advanced it.
 */
export function selectLiveMatchEvent(
	matches: readonly Match[],
	currentEventId: number,
	now = new Date(),
	timeZone = PRODUCT_TIME_ZONE
): number {
	const nowMs = now.getTime()
	const today = localDate(now.toISOString(), timeZone)
	const usable = matches
		.map(match => ({
			match,
			kickoffMs: Date.parse(match.kickoff),
			date: localDate(match.kickoff, timeZone)
		}))
		.filter(item => Number.isFinite(item.kickoffMs) && item.match.eventId)

	const activeToday = usable
		.filter(
			item =>
				item.date === today &&
				(item.kickoffMs >= nowMs ||
					(item.match.status !== 'FT' && item.match.status !== 'UPCOMING'))
		)
		.sort((a, b) => a.kickoffMs - b.kickoffMs)
	if (activeToday[0]?.match.eventId) return activeToday[0].match.eventId

	const next = usable
		.filter(item => item.kickoffMs >= nowMs && item.match.status !== 'FT')
		.sort((a, b) => a.kickoffMs - b.kickoffMs)
	if (next[0]?.match.eventId) return next[0].match.eventId

	return currentEventId
}
