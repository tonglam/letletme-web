export class InvalidTournamentManagementPayloadError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'InvalidTournamentManagementPayloadError'
	}
}

const getVerifiedEntryId = (entryId: number) => {
	if (!Number.isSafeInteger(entryId) || entryId <= 0) {
		throw new InvalidTournamentManagementPayloadError('A verified FPL entry is required')
	}
	return entryId
}

export const isTrustedTournamentMutationRequest = (requestUrl: string, headers: Headers) => {
	const origin = headers.get('origin')
	const requestOrigin = new URL(requestUrl).origin
	const fetchSite = headers.get('sec-fetch-site')
	return (!origin || origin === requestOrigin) && fetchSite !== 'cross-site'
}

export const buildAuthoritativeTournamentRename = (body: unknown, entryId: number) => {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new InvalidTournamentManagementPayloadError('Request body must be an object')
	}

	const keys = Object.keys(body)
	if (keys.length !== 1 || !keys.includes('name')) {
		throw new InvalidTournamentManagementPayloadError('Only the tournament name can be updated')
	}

	const rawName = (body as { name?: unknown }).name
	const name = typeof rawName === 'string' ? rawName.trim() : ''
	if (name.length < 3 || name.length > 80) {
		throw new InvalidTournamentManagementPayloadError(
			'Tournament name must be between 3 and 80 characters',
		)
	}

	return { name, adminEntryId: getVerifiedEntryId(entryId) }
}

export const buildAuthoritativeTournamentDelete = (entryId: number) => ({
	adminEntryId: getVerifiedEntryId(entryId),
})
