import { extractGraphQLOperationName } from '@/lib/cache-policy'
import { buildGraphQLUserContextHeaders } from '@/lib/graphql-envelope'
import {
	isSuccessfulGraphQLResponseBody,
	resolveGraphQLProxyCacheControl,
} from '@/lib/graphql-proxy-cache'
import {
	copySafeGraphQLUpstreamHeaders,
	readForwardableMiniProgramAuthorization
} from '@/lib/graphql-proxy-security'
import {
	buildGraphQLProxyIngress,
	graphQLWorkloadForOperation
} from '@/lib/graphql-ingress'
import {
	PayloadTooLargeError,
	readBoundedJson,
} from '@/lib/http-security-core'
import { shouldResolveGraphQLProxySession } from '@/lib/graphql-proxy-session'
import { RequestTiming, resolveRequestId } from '@/lib/request-timing'
import { NextRequest, NextResponse } from 'next/server'

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql'
const MAX_GRAPHQL_BODY_BYTES = 256 * 1024
const GRAPHQL_UPSTREAM_TIMEOUT_MS = 15_000

function noStoreJson(body: unknown, status: number, headers: Record<string, string> = {}) {
	return NextResponse.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store', ...headers },
	})
}

export async function POST(request: NextRequest) {
	const requestTiming = new RequestTiming()
	const requestId = resolveRequestId(request.headers.get('x-request-id'))
	let body: unknown
	try {
		body = await requestTiming.measure('bodyRead', () =>
			readBoundedJson(request, MAX_GRAPHQL_BODY_BYTES)
		)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return noStoreJson(
				{ errors: [{ message: 'Payload too large', extensions: { code: 'PAYLOAD_TOO_LARGE' } }] },
				413,
			)
		}
		return noStoreJson({ errors: [{ message: 'Invalid JSON' }] }, 400)
	}
	const operationName = extractGraphQLOperationName(body) || 'anonymous'
	const workload = graphQLWorkloadForOperation(operationName)

	const authorization = requestTiming.measureSync('authorizationHeader', () =>
		readForwardableMiniProgramAuthorization(request.headers)
	)
	if (!authorization.ok) {
		return noStoreJson(
			{
				errors: [{
					message: 'Invalid Authorization header',
					extensions: { code: 'INVALID_AUTHORIZATION_HEADER' },
				}],
			},
			400,
		)
	}

	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret && process.env.NODE_ENV === 'production') {
		return noStoreJson({ errors: [{ message: 'Proxy security is unavailable' }] }, 503)
	}
	const ingress = secret
		? buildGraphQLProxyIngress({
				headers: request.headers,
				secret,
				workload
			})
		: null
	if (ingress && !ingress.ok) {
		return noStoreJson(
			{
				errors: [{
					message: ingress.message,
					extensions: { code: 'INVALID_CLIENT_IDENTITY' }
				}]
			},
			400
		)
	}

	let session = null
	if (shouldResolveGraphQLProxySession(request.headers)) {
		try {
			const { getAuthorizationSession } = await import('@/lib/auth')
			session = await requestTiming.measure('sessionLookup', () =>
				getAuthorizationSession(request.headers)
			)
		} catch (error) {
			console.error('[graphql proxy] authorization session lookup failed:', error)
			return noStoreJson({ errors: [{ message: 'Authentication unavailable' }] }, 503)
		}
	}

	const forwardHeaders = requestTiming.measureSync('headerBuild', () => {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-Request-Id': requestId,
		}
		if (authorization.value) {
			headers.Authorization = authorization.value
		}
		if (secret && ingress?.ok) {
			Object.assign(headers, ingress.headers)
			if (session?.user) {
				Object.assign(headers, buildGraphQLUserContextHeaders(session.user, secret))
			}
		}
		return headers
	})

	let response: Response
	const upstreamController = new AbortController()
	const timeoutId = globalThis.setTimeout(
		() => upstreamController.abort(),
		GRAPHQL_UPSTREAM_TIMEOUT_MS,
	)
	const abortUpstream = () => upstreamController.abort()
	if (request.signal.aborted) {
		upstreamController.abort()
	} else {
		request.signal.addEventListener('abort', abortUpstream, { once: true })
	}
	try {
		response = await requestTiming.measure('upstreamFetch', () =>
			fetch(GRAPHQL_ENDPOINT, {
				method: 'POST',
				cache: 'no-store',
				headers: forwardHeaders,
				body: JSON.stringify(body),
				signal: upstreamController.signal,
			})
		)
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return noStoreJson({ errors: [{ message: 'Upstream timed out' }] }, 504)
		}
		console.error('[graphql proxy] upstream fetch failed:', error)
		return noStoreJson({ errors: [{ message: 'Upstream unavailable' }] }, 502)
	} finally {
		globalThis.clearTimeout(timeoutId)
		request.signal.removeEventListener('abort', abortUpstream)
	}

	const responseBody = await requestTiming.measure('responseBody', () => response.arrayBuffer())
	const { responseBodyOk, cacheControl } = requestTiming.measureSync('responsePolicy', () => {
		const bodyOk = isSuccessfulGraphQLResponseBody(new TextDecoder().decode(responseBody))
		return {
			responseBodyOk: bodyOk,
			cacheControl: resolveGraphQLProxyCacheControl({
				body,
				hasSessionUser: Boolean(session?.user),
				hasAuthorization: Boolean(authorization.value),
				responseOk: response.ok,
				responseBodyOk: bodyOk,
			}),
		}
	})
	const safeHeaders = new Headers({
		'Cache-Control': cacheControl,
		'X-Request-Id': requestId,
	})
	copySafeGraphQLUpstreamHeaders(response.headers, safeHeaders)
	const proxyResponse = requestTiming.measureSync(
		'responseBuild',
		() => new NextResponse(responseBody, {
			status: response.status,
			headers: safeHeaders,
		})
	)
	console.info('[graphql proxy timing]', JSON.stringify({
		event: 'graphql_proxy_timing',
		requestId,
		operationName,
		trafficClass: ingress?.ok ? ingress.trafficClass : 'development',
		workload,
		status: response.status,
		totalMs: Number(requestTiming.elapsedMs().toFixed(2)),
		timings: requestTiming.snapshot(),
		responseBodyOk,
		cacheResult: cacheControl === 'no-store' ? 'bypass' : 'eligible',
	}))
	return proxyResponse
}
