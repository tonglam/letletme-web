/**
 * Current/next gameweek state gates whole pages. Its durable cache is the
 * revisioned Data publication behind GraphQL; Web must not retain a second,
 * unrevisioned copy across an event-state transition.
 */
export const CORE_AUTHORITY_FETCH_OPTIONS = Object.freeze({
	cache: 'no-store' as const,
	timeoutMs: 5_000
})
