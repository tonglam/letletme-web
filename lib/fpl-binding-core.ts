export const FPL_BINDING_CHALLENGE_TTL_MS = 15 * 60 * 1000
export const FPL_BINDING_MAX_ATTEMPTS = 10
export const FPL_BINDING_CREATION_LIMIT = 3

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
