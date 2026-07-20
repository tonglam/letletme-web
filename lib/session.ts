import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'
import { getAuthorizationSession } from '@/lib/auth'

export const getCurrentSession = cache(async () => {
	return getAuth().api.getSession({ headers: await headers() })
})

export const getCurrentEntryId = cache(async (): Promise<number | null> => {
	const session = await getAuthorizationSession(await headers())
	return session?.user.fplEntryVerifiedAt ? (session.user.fplEntryId ?? null) : null
})
