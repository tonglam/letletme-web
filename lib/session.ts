import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { getAuth, getAuthorizationSession, type Session } from '@/lib/auth'
import { hasSessionCookieHintInHeaders } from '@/lib/session-cookie-hint'
import {
	COMPETITION_SESSION_HANDOFF_HEADER,
	COMPETITION_SESSION_PATH_HEADER,
	readCompetitionSessionHandoff
} from '@/lib/competition-session-handoff'

export const getCurrentSession = cache(async () => {
	return getAuth().api.getSession({ headers: await headers() })
})

/**
 * One fresh authorization session per RSC request (disableCookieCache).
 * Prefer this over separate getCurrentSession + getCurrentEntryId when both are needed.
 */
export const getVerifiedEntryContext = cache(
	async (): Promise<{
		session: Session | null
		entryId: number | null
	}> => {
		const requestHeaders = await headers()
		const handoff = readCompetitionSessionHandoff(
			requestHeaders.get(COMPETITION_SESSION_HANDOFF_HEADER),
			requestHeaders.get(COMPETITION_SESSION_PATH_HEADER) ?? '',
			requestHeaders.get('cookie')
		)
		if (handoff) {
			const syntheticSession = {
				session: {
					// The signed handoff is bound to this exact auth cookie. Keeping its
					// digest as the synthetic session id makes browser last-good caches
					// session-scoped even before Better Auth has rehydrated on the server.
					id: handoff.cookieHash
				},
				user: {
					id: handoff.uid,
					name: handoff.name,
					fplEntryId: handoff.eid,
					fplEntryVerifiedAt: handoff.evat
				}
			} as unknown as Session
			return { session: syntheticSession, entryId: handoff.eid }
		}
		if (!hasSessionCookieHintInHeaders(requestHeaders)) {
			return { session: null, entryId: null }
		}
		const session = await getAuthorizationSession(requestHeaders)
		if (!session) {
			return { session: null, entryId: null }
		}
		const entryId =
			session.user.fplEntryVerifiedAt &&
			typeof session.user.fplEntryId === 'number' &&
			session.user.fplEntryId > 0
				? session.user.fplEntryId
				: null
		return { session, entryId }
	}
)

export const getCurrentEntryId = cache(async (): Promise<number | null> => {
	const { entryId } = await getVerifiedEntryContext()
	return entryId
})

export const hasSessionCookieHint = cache(async (): Promise<boolean> => {
	return hasSessionCookieHintInHeaders(await headers())
})
