import { isTrustedSameSiteRequest } from '@/lib/request-origin'
import { PublicError } from '@/lib/safe-errors'

export class InvalidTournamentManagementPayloadError extends PublicError {
	constructor(message: string) {
		super(message, 'InvalidTournamentManagementPayloadError')
	}
}

const getVerifiedEntryId = (entryId: number) => {
	if (!Number.isSafeInteger(entryId) || entryId <= 0) {
		throw new InvalidTournamentManagementPayloadError(
			'A verified FPL entry is required'
		)
	}
	return entryId
}

export const isTrustedTournamentMutationRequest = (
	requestUrl: string,
	headers: Headers
) => {
	return isTrustedSameSiteRequest(new Request(requestUrl, { headers }))
}

export const buildAuthoritativeTournamentRename = (
	body: unknown,
	entryId: number,
	platformAdmin = false
) => {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new InvalidTournamentManagementPayloadError(
			'Request body must be an object'
		)
	}

	const keys = Object.keys(body)
	if (keys.length !== 1 || !keys.includes('name')) {
		throw new InvalidTournamentManagementPayloadError(
			'Only the tournament name can be updated'
		)
	}

	const rawName = (body as { name?: unknown }).name
	const name = typeof rawName === 'string' ? rawName.trim() : ''
	if (name.length < 3 || name.length > 80) {
		throw new InvalidTournamentManagementPayloadError(
			'Tournament name must be between 3 and 80 characters'
		)
	}

	return {
		name,
		adminEntryId: getVerifiedEntryId(entryId),
		platformAdmin: platformAdmin === true
	}
}

export const buildAuthoritativeTournamentDelete = (
	entryId: number,
	platformAdmin = false
) => ({
	adminEntryId: getVerifiedEntryId(entryId),
	platformAdmin: platformAdmin === true
})

export type TournamentManagementAction =
	'retry_setup' | 'retry_roster' | 'pause' | 'resume' | 'enable_official_sync'

const tournamentManagementActions = new Set<TournamentManagementAction>([
	'retry_setup',
	'retry_roster',
	'pause',
	'resume',
	'enable_official_sync'
])

export const buildAuthoritativeTournamentAction = (
	body: unknown,
	entryId: number,
	platformAdmin = false
) => {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new InvalidTournamentManagementPayloadError(
			'Request body must be an object'
		)
	}
	const keys = Object.keys(body)
	const action = (body as { action?: unknown }).action
	if (
		keys.length !== 1 ||
		typeof action !== 'string' ||
		!tournamentManagementActions.has(action as TournamentManagementAction)
	) {
		throw new InvalidTournamentManagementPayloadError(
			'Unsupported tournament management action'
		)
	}

	return {
		action: action as TournamentManagementAction,
		adminEntryId: getVerifiedEntryId(entryId),
		platformAdmin: platformAdmin === true
	}
}
