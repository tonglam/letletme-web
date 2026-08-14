import { getSessionCookie } from 'better-auth/cookies'

import { AUTH_COOKIE_PREFIX } from '@/lib/auth-policy'

/**
 * The signed cookie is never decoded here and this result must never authorize
 * access. Absence proves an RSC browser request is a guest and avoids a
 * pointless Auth database read; presence only permits the fresh authorization
 * lookup and is also used for presentation hints.
 */
export function hasSessionCookieHintInHeaders(
	requestHeaders: Headers
): boolean {
	return Boolean(
		getSessionCookie(requestHeaders, { cookiePrefix: AUTH_COOKIE_PREFIX })
	)
}
