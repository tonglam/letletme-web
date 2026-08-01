export const FPL_BINDING_CHALLENGE_TTL_MS = 15 * 60 * 1000
export const FPL_BINDING_MAX_ATTEMPTS = 10
export const FPL_BINDING_CREATION_LIMIT = 3

export function assertFplEntryId(value: unknown): number {
	const entryId = Number(value)
	if (!Number.isInteger(entryId) || entryId <= 0) {
		throw new Error('Enter a valid FPL entry ID (positive integer)')
	}
	return entryId
}

export function normalizeFplTeamName(value: string): string {
	return value.trim().toLocaleLowerCase('en-GB')
}

export function fplTeamNamesMatch(actual: string, required: string): boolean {
	return normalizeFplTeamName(actual) === normalizeFplTeamName(required)
}
