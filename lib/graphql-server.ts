import 'server-only'

import type { Session } from '@/lib/auth'
import { capacityRequestIdForCurrentRun } from '@/lib/capacity-run'
import { executeQuery, type ExecuteQueryOptions } from '@/lib/graphql-client'
import {
	buildIngressContextHeadersV2,
	buildOpaqueRscSubject,
	type GraphQLWorkload
} from '@/lib/http-security-core'

function getPublicServerIngressHeaders(
	workload: GraphQLWorkload
): Record<string, string> {
	const secret = process.env.BACKEND_PROXY_SECRET?.trim() ?? ''
	if (!secret) {
		if (process.env.NODE_ENV === 'production') {
			throw new Error('BACKEND_PROXY_SECRET is required in production for GraphQL requests')
		}
		return {}
	}
	return buildIngressContextHeadersV2(
		{
			trafficClass: 'web_rsc',
			subject: buildOpaqueRscSubject(workload, secret),
			abuseSubject: null,
			workload
		},
		secret
	)
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
	workload: GraphQLWorkload,
	query: string,
	variables?: Record<string, unknown>,
	options?: Omit<ExecuteQueryOptions, 'headers'>,
): Promise<T> {
	const cacheResult = options?.cache === 'force-cache' ? 'eligible' : 'bypass'
	const requestId = capacityRequestIdForCurrentRun()
	const ingressHeaders = getPublicServerIngressHeaders(workload)
	if (requestId) ingressHeaders['X-Request-Id'] = requestId
	console.info('[graphql rsc request]', {
		trafficClass: 'web_rsc',
		workload,
		cacheResult
	})
	return executeQuery<T>(query, variables, {
		...options,
		headers: ingressHeaders,
	})
}
