const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

export type PublicTournamentErrorCode =
	| 'TOURNAMENT_REQUEST_INVALID'
	| 'TOURNAMENT_AUTH_REQUIRED'
	| 'TOURNAMENT_FORBIDDEN'
	| 'TOURNAMENT_NOT_FOUND'
	| 'TOURNAMENT_CONFLICT'
	| 'TOURNAMENT_RATE_LIMITED'
	| 'TOURNAMENT_TIMEOUT'
	| 'TOURNAMENT_UNAVAILABLE'
	| 'TOURNAMENT_NAME_EXISTS'
	| 'TOURNAMENT_CREATE_IN_PROGRESS'
	| 'TOURNAMENT_PREVIEW_EXPIRED'
	| 'TOURNAMENT_ADMIN_NOT_PARTICIPANT'
	| 'TOURNAMENT_PARTICIPANTS_TOO_FEW'
	| 'TOURNAMENT_INVALID_SCHEDULE'
	| 'TOURNAMENT_INVALID_FORMAT'
	| 'TOURNAMENT_INVALID_LEAGUE_URL'
	| 'TOURNAMENT_LEAGUE_EMPTY'
	| 'TOURNAMENT_LEAGUE_UNAVAILABLE'

const PUBLIC_CODES = new Set<PublicTournamentErrorCode>([
	'TOURNAMENT_REQUEST_INVALID',
	'TOURNAMENT_AUTH_REQUIRED',
	'TOURNAMENT_FORBIDDEN',
	'TOURNAMENT_NOT_FOUND',
	'TOURNAMENT_CONFLICT',
	'TOURNAMENT_RATE_LIMITED',
	'TOURNAMENT_TIMEOUT',
	'TOURNAMENT_UNAVAILABLE',
	'TOURNAMENT_NAME_EXISTS',
	'TOURNAMENT_CREATE_IN_PROGRESS',
	'TOURNAMENT_PREVIEW_EXPIRED',
	'TOURNAMENT_ADMIN_NOT_PARTICIPANT',
	'TOURNAMENT_PARTICIPANTS_TOO_FEW',
	'TOURNAMENT_INVALID_SCHEDULE',
	'TOURNAMENT_INVALID_FORMAT',
	'TOURNAMENT_INVALID_LEAGUE_URL',
	'TOURNAMENT_LEAGUE_EMPTY',
	'TOURNAMENT_LEAGUE_UNAVAILABLE'
])

export function publicTournamentErrorCode(
	payload: unknown,
	status: number
): PublicTournamentErrorCode {
	const source = isRecord(payload) ? payload.code : null
	if (
		typeof source === 'string' &&
		PUBLIC_CODES.has(source as PublicTournamentErrorCode)
	) {
		return source as PublicTournamentErrorCode
	}
	if (status === 400) return 'TOURNAMENT_REQUEST_INVALID'
	if (status === 401) return 'TOURNAMENT_AUTH_REQUIRED'
	if (status === 403) return 'TOURNAMENT_FORBIDDEN'
	if (status === 404) return 'TOURNAMENT_NOT_FOUND'
	if (status === 409) return 'TOURNAMENT_CONFLICT'
	if (status === 429) return 'TOURNAMENT_RATE_LIMITED'
	if (status === 504) return 'TOURNAMENT_TIMEOUT'
	return 'TOURNAMENT_UNAVAILABLE'
}

export function publicTournamentServiceError(status: number): string {
	if (status === 400) return 'The tournament request was invalid.'
	if (status === 401) return 'Please sign in again.'
	if (status === 403)
		return 'You are not allowed to perform this tournament action.'
	if (status === 404) return 'The tournament was not found.'
	if (status === 409)
		return 'The tournament request conflicts with current data.'
	if (status === 429) return 'Too many requests. Please try again later.'
	return 'The tournament service is unavailable.'
}

/**
 * Do not proxy an upstream error body blindly. It may contain database,
 * provider, stack, or infrastructure details that are not part of the Web
 * contract. Successful payloads are left untouched because they are already
 * shaped by the route that owns the response contract.
 */
export function sanitizeTournamentApiErrorPayload(
	payload: unknown,
	status: number
): Record<string, unknown> {
	const source = isRecord(payload) ? payload : {}
	return {
		success: false,
		error: publicTournamentServiceError(status),
		code: publicTournamentErrorCode(payload, status),
		...(typeof source.retryAfterSeconds === 'number' &&
		Number.isSafeInteger(source.retryAfterSeconds) &&
		source.retryAfterSeconds > 0
			? { retryAfterSeconds: Math.min(source.retryAfterSeconds, 86_400) }
			: {})
	}
}

export function sanitizeTournamentNameCheckError(
	status: number
): Record<string, unknown> {
	return {
		available: false,
		message: publicTournamentServiceError(status)
	}
}
