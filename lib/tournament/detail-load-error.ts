/**
 * Classifies GraphQL / access failures for /live/tournaments/[id]
 * so the UI can show specific, actionable copy.
 */
export type TournamentDetailLoadError =
	| 'bind_entry'
	| 'invalid_link'
	| 'no_access'
	| 'unavailable'

export function classifyTournamentDetailError(
	error: unknown,
): Exclude<TournamentDetailLoadError, 'bind_entry' | 'invalid_link'> {
	const message =
		error instanceof Error ? error.message : String(error ?? '')
	const lower = message.toLowerCase()

	if (
		lower.includes('not a member') ||
		lower.includes('retained administrator') ||
		lower.includes('forbidden') ||
		lower.includes('not bound') ||
		lower.includes('no access') ||
		// Unauthenticated proxy/session on a membership-gated field
		lower.includes('authentication required') ||
		lower.includes('unauthenticated')
	) {
		return 'no_access'
	}

	return 'unavailable'
}
