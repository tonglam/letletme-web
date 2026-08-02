import { FplBindingError } from './fpl-entry-binding'

export type FplBindingErrorCode =
	| 'notAuthenticated'
	| 'entryNotFound'
	| 'tooManyChallenges'
	| 'challengeExpired'
	| 'verificationUnavailable'
	| 'nameMismatch'
	| 'alreadyBound'
	| 'verificationFailed'

export function getFplBindingErrorCode(error: unknown): FplBindingErrorCode {
	if (!(error instanceof FplBindingError) && !(error instanceof Error)) {
		return 'verificationFailed'
	}

	const message = error.message.toLowerCase()
	if (message.includes('not authenticated')) return 'notAuthenticated'
	if (message.includes('no fpl team found')) return 'entryNotFound'
	if (message.includes('too many binding')) return 'tooManyChallenges'
	if (message.includes('invalid or expired') || message.includes('challenge is required')) {
		return 'challengeExpired'
	}
	if (message.includes('right now')) return 'verificationUnavailable'
	if (message.includes('does not yet match')) return 'nameMismatch'
	if (message.includes('already verified')) return 'alreadyBound'
	return 'verificationFailed'
}
