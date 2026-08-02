export const FPL_BINDING_CHALLENGE_TTL_MS = 15 * 60 * 1000
export const FPL_BINDING_MAX_ATTEMPTS = 10
export const FPL_BINDING_CREATION_LIMIT = 3

/**
 * Per-user cap on direct binding attempts within a fixed window, enforced
 * durably via the request_rate_limits table. Every attempt performs an
 * uncached FPL lookup plus an entry-info sync, and Server Actions bypass the
 * API route rate limiter — this restores the guard the retired challenge
 * path had.
 */
export const FPL_BINDING_RATE_LIMIT_WINDOW_SECONDS = 60 * 60
export const FPL_BINDING_RATE_LIMIT_MAX = 10

/** How long a bind-time team/manager name snapshot is trusted before a lazy re-sync. */
export const FPL_IDENTITY_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * Whether the persisted name snapshot is due for a re-sync. Accepts Date or
 * ISO string so both the Drizzle row and the session payload shape work.
 */
export function isFplIdentitySnapshotStale(
	refreshedAt: Date | string | null | undefined,
	now: Date = new Date(),
): boolean {
	if (!refreshedAt) return true
	const refreshed = refreshedAt instanceof Date ? refreshedAt : new Date(refreshedAt)
	if (!Number.isFinite(refreshed.getTime())) return true
	return now.getTime() - refreshed.getTime() >= FPL_IDENTITY_REFRESH_INTERVAL_MS
}

export type FplEntryBindingState = {
	fplEntryId?: number | null
	fplEntryVerifiedAt?: Date | string | null
}

export function getVerifiedFplEntryId(binding: FplEntryBindingState): number | null {
	const { fplEntryId, fplEntryVerifiedAt } = binding
	if (
		typeof fplEntryId !== 'number' ||
		!Number.isSafeInteger(fplEntryId) ||
		fplEntryId <= 0 ||
		!fplEntryVerifiedAt
	) {
		return null
	}

	const verifiedAt =
		fplEntryVerifiedAt instanceof Date
			? fplEntryVerifiedAt
			: new Date(fplEntryVerifiedAt)

	return Number.isFinite(verifiedAt.getTime()) ? fplEntryId : null
}

/**
 * Accepts a raw entry ID ("123456") or any FPL page URL containing the entry
 * (e.g. "https://fantasy.premierleague.com/en/entry/123456/history") — users
 * paste the address bar, we extract the ID.
 */
export function parseFplEntryId(value: unknown): number | null {
	if (typeof value === 'number') {
		return Number.isSafeInteger(value) && value > 0 ? value : null
	}

	const input = String(value ?? '').trim()
	if (/^\d+$/.test(input)) {
		const entryId = Number(input)
		return Number.isSafeInteger(entryId) && entryId > 0 ? entryId : null
	}

	const match = input.match(/\/entry\/(\d+)(?:[/?#]|$)/)
	if (match) {
		const entryId = Number(match[1])
		return Number.isSafeInteger(entryId) && entryId > 0 ? entryId : null
	}

	return null
}

export function assertFplEntryId(value: unknown): number {
	const entryId = parseFplEntryId(value)
	if (entryId === null) {
		throw new Error('Enter a valid FPL entry ID or a page URL containing /entry/<id>')
	}
	return entryId
}

export function normalizeFplTeamName(value: string): string {
	return value.trim().toLocaleLowerCase('en-GB')
}

export function fplTeamNamesMatch(actual: string, required: string): boolean {
	return normalizeFplTeamName(actual) === normalizeFplTeamName(required)
}
