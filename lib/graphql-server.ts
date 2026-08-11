import 'server-only'

import { createHmac } from 'crypto'
import type { Session } from '@/lib/auth'
import { executeQuery, type ExecuteQueryOptions } from '@/lib/graphql-client'
import { buildIngressContextHeaders } from '@/lib/http-security-core'

function getPublicServerIngressHeaders(): Record<string, string> {
	const secret = process.env.BACKEND_PROXY_SECRET?.trim() ?? ''
	if (!secret) {
		if (process.env.NODE_ENV === 'production') {
			throw new Error('BACKEND_PROXY_SECRET is required in production for GraphQL requests')
		}
		return {}
	}
	const subject = createHmac('sha256', secret)
		.update('rate-limit:web-public-rsc')
		.digest('hex')
	return buildIngressContextHeaders(subject, secret)
}

// Use this instead of executeQuery in RSC pages.
// Server-side calls bypass the /api/graphql proxy (which normally adds
// X-User-Context from the session cookie), so protected fields like
// entryTournaments would get a 401 without this wrapper.
export async function executeServerQuery<T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: Omit<ExecuteQueryOptions, 'headers'>,
): Promise<T> {
	const { getServerUserContextHeaders } = await import('@/lib/server-user-context')
	const authHeaders = await getServerUserContextHeaders()
	return executeQuery<T>(query, variables, { ...options, headers: authHeaders })
}

/** Same as executeServerQuery but reuses an already-loaded session (no extra getSession). */
export async function executeServerQueryWithSession<T>(
	session: Session | null,
	query: string,
	variables?: Record<string, unknown>,
	options?: Omit<ExecuteQueryOptions, 'headers'>,
): Promise<T> {
	const { buildServerUserContextHeaders } = await import('@/lib/server-user-context')
	const authHeaders = await buildServerUserContextHeaders(session)
	return executeQuery<T>(query, variables, { ...options, headers: authHeaders })
}

/** Public RSC reads omit request-derived headers so Next's shared fetch cache stays effective. */
export async function executePublicServerQuery<T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: Omit<ExecuteQueryOptions, 'headers'>,
): Promise<T> {
	return executeQuery<T>(query, variables, {
		...options,
		headers: getPublicServerIngressHeaders(),
	})
}
