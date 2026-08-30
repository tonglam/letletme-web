/**
 * Errors that are deliberately safe to expose to a user-facing boundary.
 *
 * Every other error is considered diagnostic-only. In particular, native
 * browser network errors and upstream exceptions must never become UI copy.
 */
export class PublicError extends Error {
	readonly publicMessage: string

	constructor(publicMessage: string, name = 'PublicError') {
		super(publicMessage)
		this.name = name
		this.publicMessage = publicMessage
	}
}

export function getPublicErrorMessage(
	error: unknown,
	fallback: string
): string {
	return error instanceof PublicError ? error.publicMessage : fallback
}

/**
 * Resolve a client-side error for display without trusting Error.message.
 * The error argument is intentionally only accepted for typed PublicError
 * instances; arbitrary Error objects may contain browser, network, database,
 * or provider details.
 */
export function getSafeClientErrorMessage(
	error: unknown,
	fallback: string
): string {
	return getPublicErrorMessage(error, fallback)
}

/**
 * GraphQL errors cross a trust boundary at the browser proxy. Keep the
 * browser contract stable while preventing resolver, database, and provider
 * messages from becoming user-facing copy.
 */
export function publicGraphQLRequestMessage(
	status: number,
	code: string | null | undefined
): string {
	if (code === 'UNAUTHENTICATED' || status === 401) {
		return 'Authentication required.'
	}
	if (code === 'VIEWER_ENTRY_REQUIRED') {
		return 'Please select your FPL team first.'
	}
	if (code === 'FORBIDDEN' || status === 403) {
		return 'You are not allowed to view this data.'
	}
	if (code === 'NOT_FOUND' || status === 404) {
		return 'The requested data was not found.'
	}
	if (code === 'RATE_LIMITED' || status === 429) {
		return 'Too many requests. Please try again later.'
	}
	if (
		code === 'BAD_USER_INPUT' ||
		code === 'GRAPHQL_PARSE_FAILED' ||
		code === 'GRAPHQL_VALIDATION_FAILED' ||
		status === 400
	) {
		return 'The request was invalid.'
	}
	if (code === 'LIVE_SCORE_REVISION_GONE') {
		return 'The live snapshot is no longer available.'
	}
	if (code === 'CLIENT_UPGRADE_REQUIRED') {
		return 'Please update the app to view Live Points.'
	}
	return 'The data service is unavailable.'
}
