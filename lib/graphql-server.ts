import 'server-only'

import { executeQuery, type ExecuteQueryOptions } from '@/lib/graphql-client'
import { getServerUserContextHeaders } from '@/lib/server-user-context'

// Use this instead of executeQuery in RSC pages.
// Server-side calls bypass the /api/graphql proxy (which normally adds
// X-User-Context from the session cookie), so protected fields like
// entryTournaments would get a 401 without this wrapper.
export async function executeServerQuery<T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: Omit<ExecuteQueryOptions, 'headers'>,
): Promise<T> {
	const authHeaders = await getServerUserContextHeaders()
	return executeQuery<T>(query, variables, { ...options, headers: authHeaders })
}

/** Public RSC reads omit request-derived headers so Next's shared fetch cache stays effective. */
export async function executePublicServerQuery<T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: Omit<ExecuteQueryOptions, 'headers'>,
): Promise<T> {
	return executeQuery<T>(query, variables, options)
}
