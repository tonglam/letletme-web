import 'server-only'

import { createHmac } from 'crypto'

import {
	buildOpaqueRateLimitSubject,
	checkDatabaseRateLimit,
	PayloadTooLargeError,
	readBoundedJson,
} from '@/lib/http-security'
import { MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import {
	recordAuthFailure,
	updateAuthObservationContext,
	withObservedAuthRequest
} from '@/lib/auth-observability'
import {
	normalizeAuthErrorCode,
	normalizeMiniProgramLoginContext
} from '@/lib/auth-observability-core'
import { logSafeAuthDiagnostic } from '@/lib/auth-safe-log'
import { getPublicErrorMessage } from '@/lib/safe-errors'

const MAX_AUTH_BODY_BYTES = 16 * 1024

export function withMiniProgramAuthRequest(
	request: Request,
	operation: string,
	handler: () => Promise<Response>
): Promise<Response> {
	return withObservedAuthRequest(request, 'mini', operation, handler)
}

export function setMiniProgramAuthObservation(
	body: Record<string, unknown>
): void {
	updateAuthObservationContext({
		miniDeviceId:
			typeof body.deviceId === 'string' ? body.deviceId : undefined,
		email: typeof body.email === 'string' ? body.email : undefined,
		loginContext: normalizeMiniProgramLoginContext(body.loginContext)
	})
}

export async function readMiniProgramJson(request: Request): Promise<Record<string, unknown>> {
	try {
		const body = await readBoundedJson(request, MAX_AUTH_BODY_BYTES)
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			throw new MiniProgramAuthError('Invalid JSON body', 400)
		}
		return body as Record<string, unknown>
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			throw new MiniProgramAuthError('Payload too large', 413)
		}
		if (error instanceof MiniProgramAuthError) throw error
		throw new MiniProgramAuthError('Invalid JSON body', 400)
	}
}

function keyedSubject(secret: string, kind: string, value: unknown): string {
	const normalized = typeof value === 'string' ? value.trim().toLowerCase() : 'invalid'
	return createHmac('sha256', secret).update(`${kind}:${normalized}`).digest('hex')
}

export async function enforceMiniProgramRateLimits({
	request,
	scope,
	body,
}: {
	request: Request
	scope: 'wechat-login' | 'email-confirm' | 'email-start'
	body: Record<string, unknown>
}): Promise<void> {
	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret) throw new MiniProgramAuthError('Request safety checks are unavailable', 503)
	const checks = [
		{
			suffix: 'ip',
			subject: buildOpaqueRateLimitSubject(request.headers, secret),
			limit: 5,
			windowSeconds: 60,
		},
	]
	if (scope === 'wechat-login' || scope === 'email-confirm') {
		checks.push({
			suffix: 'device',
			subject: keyedSubject(secret, 'device', body.deviceId),
			limit: 5,
			windowSeconds: 60,
		})
	}
	if (scope === 'email-start') {
		checks.push({
			suffix: 'email',
			subject: keyedSubject(secret, 'email', body.email),
			limit: 3,
			windowSeconds: 60 * 60,
		})
	}

	try {
		for (const check of checks) {
			const result = await checkDatabaseRateLimit({
				scope: `mini-${scope}-${check.suffix}`,
				subject: check.subject,
				limit: check.limit,
				windowSeconds: check.windowSeconds,
			})
			if (!result.allowed) {
				throw new MiniProgramAuthError('Too many requests', 429, result.retryAfterSeconds)
			}
		}
	} catch (error) {
		if (error instanceof MiniProgramAuthError) throw error
		logSafeAuthDiagnostic('warn', 'better-auth diagnostic', {
			name: 'MiniRateLimitStorageUnavailable',
			code: 'rate_limit_storage_unavailable'
		})
		throw new MiniProgramAuthError('Request safety checks are unavailable', 503)
	}
}

export async function enforceMiniProgramMutationRateLimits(input: {
	request: Request
	token: string
	scope:
		| 'follow-entry'
		| 'entry-choice'
		| 'account-unlink'
		| 'session-persistence'
}): Promise<void> {
	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret) throw new MiniProgramAuthError('Request safety checks are unavailable', 503)
	const checks = [
		{
			suffix: 'ip',
			subject: buildOpaqueRateLimitSubject(input.request.headers, secret),
			limit: 30,
			windowSeconds: 60,
		},
		{
			suffix: 'account',
			subject: keyedSubject(secret, 'mini-token', input.token),
			limit: 20,
			windowSeconds: 60,
		},
	]
	try {
		for (const check of checks) {
			const result = await checkDatabaseRateLimit({
				scope: `mini-${input.scope}-${check.suffix}`,
				subject: check.subject,
				limit: check.limit,
				windowSeconds: check.windowSeconds,
			})
			if (!result.allowed) {
				throw new MiniProgramAuthError(
					'Too many requests',
					429,
					result.retryAfterSeconds
				)
			}
		}
	} catch (error) {
		if (error instanceof MiniProgramAuthError) throw error
		logSafeAuthDiagnostic('warn', 'better-auth diagnostic', {
			name: 'MiniMutationRateLimitStorageUnavailable',
			code: 'rate_limit_storage_unavailable'
		})
		throw new MiniProgramAuthError('Request safety checks are unavailable', 503)
	}
}

function diagnosticErrorCode(error: unknown, status: number): string {
	if (error instanceof MiniProgramAuthError && error.code) {
		return normalizeAuthErrorCode(error.code) ?? 'service_unavailable'
	}
	if (status === 400) return 'bad_request'
	if (status === 401) return 'unauthorized'
	if (status === 403) return 'forbidden'
	if (status === 429) return 'rate_limited'
	return normalizeAuthErrorCode(`http_${status}`) ?? 'service_unavailable'
}

export function miniProgramErrorResponse(error: unknown, fallback: string): Response {
	const status = error instanceof MiniProgramAuthError ? error.status : 500
	const message = getPublicErrorMessage(error, fallback)
	if (!(error instanceof MiniProgramAuthError)) {
		logSafeAuthDiagnostic('error', 'better-auth diagnostic', {
			name: 'MiniAuthRequestFailed',
			status
		})
	}
	recordAuthFailure(
		diagnosticErrorCode(error, status),
		status,
		status === 429 ? 'rate_limited' : 'upstream_failure'
	)
	const headers = new Headers({ 'Cache-Control': 'no-store' })
	if (error instanceof MiniProgramAuthError && error.retryAfterSeconds) {
		headers.set('Retry-After', String(error.retryAfterSeconds))
	}
	return Response.json({ success: false, error: message }, { status, headers })
}

export function miniProgramSuccessResponse(body: Record<string, unknown>): Response {
	return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
