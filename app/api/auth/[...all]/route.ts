import { toNextJsHandler } from 'better-auth/next-js'

import { getAuth } from '@/lib/auth'
import { withPrivateNoStore } from '@/lib/auth-response'
import {
	formatAuthServerTiming,
	isGetSessionRequest
} from '@/lib/auth-request-timing'
import {
	buildOpaqueRateLimitSubject,
	checkDatabaseRateLimit,
	PayloadTooLargeError,
	readBoundedText,
	resolveProviderClientIp
} from '@/lib/http-security'
import { RequestTiming } from '@/lib/request-timing'

const MAX_AUTH_BODY_BYTES = 16 * 1024

function sanitizedAuthHeaders(request: Request): Headers {
	const headers = new Headers(request.headers)
	const clientIp = resolveProviderClientIp(request.headers)
	headers.delete('x-forwarded-for')
	if (clientIp !== 'unknown') headers.set('x-forwarded-for', clientIp)
	return headers
}

export async function GET(request: Request) {
	const timing = new RequestTiming()
	const response = await timing.measure('session', () =>
		toNextJsHandler(getAuth()).GET(
			new Request(request.url, {
				method: 'GET',
				headers: sanitizedAuthHeaders(request)
			})
		)
	)
	const output = withPrivateNoStore(response)
	if (isGetSessionRequest(request.url)) {
		const sessionMs = timing.snapshot().session ?? 0
		const totalMs = timing.elapsedMs()
		const durations = {
			handlerMs: Math.max(0, totalMs - sessionMs),
			sessionMs,
			totalMs
		}
		output.headers.set('Server-Timing', formatAuthServerTiming(durations))
		console.info(
			JSON.stringify({
				event: 'auth_request_timing',
				operation: 'get-session',
				status: output.status,
				timings: {
					handler: Number(durations.handlerMs.toFixed(2)),
					session: Number(durations.sessionMs.toFixed(2)),
					total: Number(durations.totalMs.toFixed(2))
				},
				release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'local'
			})
		)
	}
	return output
}

export async function POST(request: Request) {
	try {
		const secret = process.env.BACKEND_PROXY_SECRET
		if (!secret) {
			return withPrivateNoStore(
				Response.json(
					{
						code: 'SERVICE_UNAVAILABLE',
						message: 'Request safety checks are unavailable'
					},
					{ status: 503 }
				)
			)
		}
		const rate = await checkDatabaseRateLimit({
			scope: 'better-auth-ip',
			subject: buildOpaqueRateLimitSubject(request.headers, secret),
			limit: 5,
			windowSeconds: 60
		})
		if (!rate.allowed) {
			return withPrivateNoStore(
				Response.json(
					{ code: 'RATE_LIMITED', message: 'Too many requests' },
					{
						status: 429,
						headers: { 'Retry-After': String(rate.retryAfterSeconds) }
					}
				)
			)
		}
		const body = await readBoundedText(request, MAX_AUTH_BODY_BYTES)
		const boundedRequest = new Request(request.url, {
			method: 'POST',
			headers: sanitizedAuthHeaders(request),
			body
		})
		return withPrivateNoStore(
			await toNextJsHandler(getAuth()).POST(boundedRequest)
		)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return withPrivateNoStore(
				Response.json(
					{ code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' },
					{ status: 413 }
				)
			)
		}
		console.error('[auth] request limiter unavailable:', error)
		return withPrivateNoStore(
			Response.json(
				{
					code: 'SERVICE_UNAVAILABLE',
					message: 'Request safety checks are unavailable'
				},
				{ status: 503 }
			)
		)
	}
}
