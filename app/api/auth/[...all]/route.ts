import { toNextJsHandler } from 'better-auth/next-js'

import { getAuth } from '@/lib/auth'
import {
	getAuthObservationContext,
	recordAuthFailure,
	updateAuthObservationContext,
	withAuthDeviceCookie,
	withObservedAuthRequest
} from '@/lib/auth-observability'
import { withPrivateNoStore } from '@/lib/auth-response'
import {
	formatAuthServerTiming,
	isGetSessionRequest
} from '@/lib/auth-request-timing'
import { withAuthDatabaseTiming } from '@/lib/auth-database-timing'
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
	for (const internalHeader of [
		'x-letletme-client-ip',
		'x-letletme-origin-token',
		'x-letletme-proxy-client-ip',
		'x-letletme-proxy-secret'
	]) {
		headers.delete(internalHeader)
	}
	if (clientIp !== 'unknown') headers.set('x-forwarded-for', clientIp)
	return headers
}

function authOperation(request: Request): string {
	try {
		const path = new URL(request.url).pathname
		const suffix = path.split('/api/auth/')[1] ?? ''
		if (suffix === 'get-session') return 'get-session'
		if (suffix === 'sign-in/email') return 'email-login'
		if (suffix === 'sign-up/email') return 'register'
		if (suffix === 'sign-in/social') return 'google-login-start'
		if (suffix.includes('callback/google')) return 'google-login-callback'
		if (suffix === 'send-verification-email') return 'email-verification-send'
		if (suffix === 'verify-email') return 'email-verification'
		if (suffix === 'request-password-reset') return 'password-reset-start'
		if (suffix === 'reset-password') return 'password-reset'
		if (suffix === 'sign-out') return 'logout'
		if (suffix === 'revoke-session') return 'session-revoke'
		if (suffix === 'revoke-sessions') return 'session-revoke-all'
		if (suffix === 'revoke-other-sessions') return 'session-revoke-other'
		return suffix || 'auth-request'
	} catch {
		return 'auth-request'
	}
}

function responseWithPolicies(request: Request, response: Response): Response {
	return withAuthDeviceCookie(request, withPrivateNoStore(response))
}

export async function GET(request: Request) {
	const getSession = isGetSessionRequest(request.url)
	return withObservedAuthRequest(
		request,
		'web',
		authOperation(request),
		async () => {
			if (!getSession) {
				const response = await toNextJsHandler(getAuth()).GET(
					new Request(request.url, {
						method: 'GET',
						headers: sanitizedAuthHeaders(request)
					})
				)
				return responseWithPolicies(request, response)
			}

			const timing = new RequestTiming()
			const authRequest = timing.measureSync(
				'handler',
				() =>
					new Request(request.url, {
						method: 'GET',
						headers: sanitizedAuthHeaders(request)
					})
			)
			const response = await withAuthDatabaseTiming(
				() => timing.start('database'),
				() =>
					timing.measure('sessionTotal', () =>
						toNextJsHandler(getAuth()).GET(authRequest)
					)
			)
			const output = timing.measureSync('handler', () =>
				responseWithPolicies(request, response)
			)
			const measured = timing.snapshot()
			const databaseMs = measured.database ?? 0
			const sessionTotalMs = measured.sessionTotal ?? 0
			const durations = {
				handlerMs: measured.handler ?? 0,
				sessionMs: Math.max(0, sessionTotalMs - databaseMs),
				databaseMs,
				totalMs: timing.elapsedMs()
			}
			output.headers.set('Server-Timing', formatAuthServerTiming(durations))
			console.info(
				JSON.stringify({
					event: 'auth_request_timing',
					operation: 'get-session',
					requestId: getAuthObservationContext()?.requestId,
					status: output.status,
					timings: {
						handler: Number(durations.handlerMs.toFixed(2)),
						session: Number(durations.sessionMs.toFixed(2)),
						database: Number(durations.databaseMs.toFixed(2)),
						total: Number(durations.totalMs.toFixed(2))
					},
					release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'local'
				})
			)
			return output
		},
		{ persistEvents: !getSession }
	)
}

export async function POST(request: Request) {
	return withObservedAuthRequest(request, 'web', authOperation(request), async () => {
		try {
			const secret = process.env.BACKEND_PROXY_SECRET
			if (!secret) {
				return responseWithPolicies(
					request,
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
				recordAuthFailure('rate_limited', 429, 'rate_limited')
				return responseWithPolicies(
					request,
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
			try {
				const parsed = JSON.parse(body) as Record<string, unknown>
				updateAuthObservationContext({
					email: typeof parsed.email === 'string' ? parsed.email : undefined
				})
			} catch {
				// Better Auth owns the response for malformed JSON; no raw body is logged.
			}
			const boundedRequest = new Request(request.url, {
				method: 'POST',
				headers: sanitizedAuthHeaders(request),
				body
			})
			return responseWithPolicies(
				request,
				await toNextJsHandler(getAuth()).POST(boundedRequest)
			)
		} catch (error) {
			if (error instanceof PayloadTooLargeError) {
				return responseWithPolicies(
					request,
					Response.json(
						{ code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' },
						{ status: 413 }
					)
				)
			}
			// Error.message may contain provider or SQL details; the route only
			// emits the stable category through the allow-listed event recorder.
			recordAuthFailure('service_unavailable', 503)
			return responseWithPolicies(
				request,
				Response.json(
					{
						code: 'SERVICE_UNAVAILABLE',
						message: 'Request safety checks are unavailable'
					},
						{ status: 503 }
					)
				)
			}
	})
}
