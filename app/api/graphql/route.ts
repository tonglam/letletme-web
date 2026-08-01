import { getAuthorizationSession } from '@/lib/auth'
import { buildGraphQLUserContextHeaders } from '@/lib/graphql-envelope'
import {
	buildIngressContextHeaders,
	buildOpaqueRateLimitSubject,
	checkDatabaseRateLimit,
	PayloadTooLargeError,
	readBoundedJson,
} from '@/lib/http-security'
import { getOperationAST, parse } from 'graphql'
import { NextRequest, NextResponse } from 'next/server'

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql'
const MAX_GRAPHQL_BODY_BYTES = 256 * 1024

function isReadOnlyGraphQL(body: unknown): boolean {
	if (!body || typeof body !== 'object') return false
	const value = body as { query?: unknown; operationName?: unknown }
	if (typeof value.query !== 'string') return false
	try {
		const operation = getOperationAST(
			parse(value.query),
			typeof value.operationName === 'string' ? value.operationName : undefined,
		)
		return operation?.operation === 'query'
	} catch {
		return false
	}
}

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
		// Only valid read-only GraphQL operations may fail open while the limiter is unavailable.
		if (!isReadOnlyGraphQL(body)) {
			console.error('[graphql proxy] rate-limit storage unavailable:', error)
			return noStoreJson(
				{ errors: [{ message: 'Request safety checks are unavailable' }] },
				503,
			)
		}
		console.warn('[graphql proxy] rate-limit storage unavailable; read-only request allowed')
	}

	let session = null
	try {
		session = await getAuthorizationSession(request.headers)
	} catch (error) {
		console.error('[graphql proxy] authorization session lookup failed:', error)
		return noStoreJson({ errors: [{ message: 'Authentication unavailable' }] }, 503)
	}

	const forwardHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
	if (secret) {
		Object.assign(forwardHeaders, buildIngressContextHeaders(subject, secret))
		if (session?.user) {
			Object.assign(forwardHeaders, buildGraphQLUserContextHeaders(session.user, secret))
		}
	}

	let response: Response
	try {
		response = await fetch(GRAPHQL_ENDPOINT, {
			method: 'POST',
			cache: 'no-store',
			headers: forwardHeaders,
			body: JSON.stringify(body),
		})
	} catch (error) {
		console.error('[graphql proxy] upstream fetch failed:', error)
		return noStoreJson({ errors: [{ message: 'Upstream unavailable' }] }, 502)
	}

	const safeHeaders = new Headers({ 'Cache-Control': 'no-store' })
	for (const name of ['content-type', 'content-language', 'retry-after']) {
		const value = response.headers.get(name)
		if (value) safeHeaders.set(name, value)
	}
	return new NextResponse(await response.arrayBuffer(), {
		status: response.status,
		headers: safeHeaders,
	})
}
