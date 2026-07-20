import { toNextJsHandler } from 'better-auth/next-js'

import { getAuth } from '@/lib/auth'
import {
	buildOpaqueRateLimitSubject,
	checkDatabaseRateLimit,
	PayloadTooLargeError,
	readBoundedText,
	resolveProviderClientIp,
} from '@/lib/http-security'

const MAX_AUTH_BODY_BYTES = 16 * 1024

function sanitizedAuthHeaders(request: Request): Headers {
	const headers = new Headers(request.headers)
	const clientIp = resolveProviderClientIp(request.headers)
	headers.delete('x-forwarded-for')
	if (clientIp !== 'unknown') headers.set('x-forwarded-for', clientIp)
	return headers
}

export function GET(request: Request) {
	return toNextJsHandler(getAuth()).GET(
		new Request(request.url, { method: 'GET', headers: sanitizedAuthHeaders(request) }),
	)
}

export async function POST(request: Request) {
	try {
		const secret = process.env.BACKEND_PROXY_SECRET
		if (!secret) {
			return Response.json({ code: 'SERVICE_UNAVAILABLE', message: 'Request safety checks are unavailable' }, { status: 503 })
		}
		const rate = await checkDatabaseRateLimit({
			scope: 'better-auth-ip',
			subject: buildOpaqueRateLimitSubject(request.headers, secret),
			limit: 5,
			windowSeconds: 60,
		})
		if (!rate.allowed) {
			return Response.json(
				{ code: 'RATE_LIMITED', message: 'Too many requests' },
				{ status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } },
			)
		}
		const body = await readBoundedText(request, MAX_AUTH_BODY_BYTES)
		const boundedRequest = new Request(request.url, {
			method: 'POST',
			headers: sanitizedAuthHeaders(request),
			body,
		})
		return toNextJsHandler(getAuth()).POST(boundedRequest)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return Response.json({ code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' }, { status: 413 })
		}
		console.error('[auth] request limiter unavailable:', error)
		return Response.json({ code: 'SERVICE_UNAVAILABLE', message: 'Request safety checks are unavailable' }, { status: 503 })
	}
}
