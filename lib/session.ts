import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'

export const getCurrentSession = cache(async () => {
	return getAuth().api.getSession({ headers: await headers() })
})

export const getCurrentEntryId = cache(async (): Promise<number | null> => {
	const session = await getCurrentSession()
	return session?.user.fplEntryId ?? null
})
