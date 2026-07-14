import 'server-only'

import { createHmac } from 'crypto'
import { getCurrentSession } from '@/lib/session'

export async function getServerUserContextHeaders(): Promise<Record<string, string>> {
	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret) {
		if (process.env.NODE_ENV === 'production') {
			throw new Error(
				'BACKEND_PROXY_SECRET is required in production for authenticated GraphQL requests',
			)
		}
		return {}
	}

	const session = await getCurrentSession()
	if (!session?.user) return {}

	const now = Math.floor(Date.now() / 1000)
	const envelope = {
		uid: session.user.id,
		eid: (session.user as { fplEntryId?: number | null }).fplEntryId ?? null,
		iat: now,
		exp: now + 60,
	}
	const payload = JSON.stringify(envelope)
	const sig = createHmac('sha256', secret).update(payload).digest('base64url')

	return {
		'X-User-Context': Buffer.from(payload).toString('base64url'),
		'X-User-Context-Sig': sig,
	}
}
