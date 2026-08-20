import 'server-only'

import type { Session } from '@/lib/auth'
import { capacityRequestIdForCurrentRun } from '@/lib/capacity-run'
import { executeQuery, type ExecuteQueryOptions } from '@/lib/graphql-client'
import {
	buildIngressContextHeadersV2,
	buildOpaqueRscSubject,
	buildOpaqueRateLimitSubject,
	type GraphQLWorkload
} from '@/lib/http-security-core'
import { AsyncLocalStorage } from 'node:async_hooks'

type PublicRouteIngressContext = {
	subject: string | null
}

const currentPublicRouteIngress =
	new AsyncLocalStorage<PublicRouteIngressContext>()

function backendProxySecret(): string {
	const secret = process.env.BACKEND_PROXY_SECRET?.trim() ?? ''
	if (!secret && process.env.NODE_ENV === 'production') {
		throw new Error('BACKEND_PROXY_SECRET is required in production for GraphQL requests')
	}
	return secret
}

function getPublicServerIngressHeaders(
	workload: GraphQLWorkload
): Record<string, string> {
	const secret = backendProxySecret()
	if (!secret) return {}
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

function getPublicRouteIngressHeaders(
	context: PublicRouteIngressContext,
	workload: GraphQLWorkload
): Record<string, string> {
	const secret = backendProxySecret()
	if (!secret || !context.subject) return {}
	return buildIngressContextHeadersV2(
		{
			trafficClass: 'web_browser',
			subject: context.subject,
			abuseSubject: null,
			workload
		},
		secret
	)
}

/** Keep public API-route cache fills on the originating browser/IP identity. */
export function withPublicRouteGraphQLIngress<T>(
	request: Pick<Request, 'headers'>,
	task: () => Promise<T>
): Promise<T> {
	const secret = backendProxySecret()
	const subject = secret
		? buildOpaqueRateLimitSubject(request.headers, secret)
		: null
	return currentPublicRouteIngress.run({ subject }, task)
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
	const routeIngress = currentPublicRouteIngress.getStore()
	const cacheResult = options?.cache === 'force-cache' ? 'eligible' : 'bypass'
	const requestId = routeIngress ? null : capacityRequestIdForCurrentRun()
	const ingressHeaders = routeIngress
		? getPublicRouteIngressHeaders(routeIngress, workload)
		: getPublicServerIngressHeaders(workload)
	if (requestId) ingressHeaders['X-Request-Id'] = requestId
	console.info('[graphql public request]', {
		trafficClass: routeIngress ? 'web_browser' : 'web_rsc',
		workload,
		cacheResult
	})
	return executeQuery<T>(query, variables, {
		...options,
		headers: ingressHeaders,
	})
}
