import { getSessionCookie } from 'better-auth/cookies'

import { AUTH_COOKIE_PREFIX } from '@/lib/auth-policy'

/**
 * Presentation hint only. The signed cookie is never decoded here and this
 * result must never authorize access; it only decides whether Home reserves a
 * personal-area skeleton while the fresh session check runs.
 */
export function hasSessionCookieHintInHeaders(
	requestHeaders: Headers
): boolean {
	return Boolean(
		getSessionCookie(requestHeaders, { cookiePrefix: AUTH_COOKIE_PREFIX })
	)
}
