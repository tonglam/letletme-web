import { getAuthorizationSession } from '@/lib/auth'
import { buildGraphQLUserContextHeaders } from '@/lib/graphql-envelope'
import {
	isSuccessfulGraphQLResponseBody,
	resolveGraphQLProxyCacheControl,
} from '@/lib/graphql-proxy-cache'
import { readForwardableMiniProgramAuthorization } from '@/lib/graphql-proxy-security'
import {
	buildIngressContextHeaders,
	buildOpaqueRateLimitSubject,
	checkDatabaseRateLimit,
	PayloadTooLargeError,
	readBoundedJson,
} from '@/lib/http-security'
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
	let body: unknown
	try {
		body = await readBoundedJson(request, MAX_GRAPHQL_BODY_BYTES)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return noStoreJson(
				{ errors: [{ message: 'Payload too large', extensions: { code: 'PAYLOAD_TOO_LARGE' } }] },
				413,
			)
		}
		return noStoreJson({ errors: [{ message: 'Invalid JSON' }] }, 400)
	}

	const authorization = readForwardableMiniProgramAuthorization(request.headers)
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
	const subject = buildOpaqueRateLimitSubject(request.headers, secret || 'development-only')
	try {
		const rate = await checkDatabaseRateLimit({
			scope: 'graphql-proxy-ip',
			subject,
			limit: 120,
			windowSeconds: 60,
		})
		if (!rate.allowed) {
			return noStoreJson(
				{ errors: [{ message: 'Too many requests', extensions: { code: 'RATE_LIMITED' } }] },
				429,
				{ 'Retry-After': String(rate.retryAfterSeconds) },
			)
		}
	} catch (error) {
		console.error('[graphql proxy] rate-limit storage unavailable:', error)
		return noStoreJson(
			{
				errors: [{
					message: 'Request safety checks are unavailable',
					extensions: { code: 'RATE_LIMIT_STORAGE_UNAVAILABLE' },
				}],
			},
			503,
		)
	}

	let session = null
	try {
		session = await getAuthorizationSession(request.headers)
	} catch (error) {
		console.error('[graphql proxy] authorization session lookup failed:', error)
		return noStoreJson({ errors: [{ message: 'Authentication unavailable' }] }, 503)
	}

	const forwardHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
	if (authorization.value) {
		forwardHeaders.Authorization = authorization.value
	}
	if (secret) {
		Object.assign(forwardHeaders, buildIngressContextHeaders(subject, secret))
		if (session?.user) {
			Object.assign(forwardHeaders, buildGraphQLUserContextHeaders(session.user, secret))
		}
	}

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
		response = await fetch(GRAPHQL_ENDPOINT, {
			method: 'POST',
			cache: 'no-store',
			headers: forwardHeaders,
			body: JSON.stringify(body),
			signal: upstreamController.signal,
		})
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

	const responseBody = await response.arrayBuffer()
	const responseBodyOk = isSuccessfulGraphQLResponseBody(
		new TextDecoder().decode(responseBody),
	)
	const cacheControl = resolveGraphQLProxyCacheControl({
		body,
		hasSessionUser: Boolean(session?.user),
		hasAuthorization: Boolean(authorization.value),
		responseOk: response.ok,
		responseBodyOk,
	})
	const safeHeaders = new Headers({ 'Cache-Control': cacheControl })
	for (const name of ['content-type', 'content-language', 'retry-after']) {
		const value = response.headers.get(name)
		if (value) safeHeaders.set(name, value)
	}
	return new NextResponse(responseBody, {
		status: response.status,
		headers: safeHeaders,
	})
}
