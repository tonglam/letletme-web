import 'server-only'

import { createHmac } from 'crypto'

import {
	buildOpaqueRateLimitSubject,
	checkDatabaseRateLimit,
	PayloadTooLargeError,
	readBoundedJson,
} from '@/lib/http-security'
import { MiniProgramAuthError } from '@/lib/miniprogram-account-core'

const MAX_AUTH_BODY_BYTES = 16 * 1024

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
		console.error(`[mini auth] ${scope} rate-limit storage unavailable:`, error)
		throw new MiniProgramAuthError('Request safety checks are unavailable', 503)
	}
}

export function miniProgramErrorResponse(error: unknown, fallback: string): Response {
	const status = error instanceof MiniProgramAuthError ? error.status : 500
	const message = error instanceof MiniProgramAuthError ? error.message : fallback
	if (!(error instanceof MiniProgramAuthError)) console.error(`[mini auth] ${fallback}:`, error)
	const headers = new Headers({ 'Cache-Control': 'no-store' })
	if (error instanceof MiniProgramAuthError && error.retryAfterSeconds) {
		headers.set('Retry-After', String(error.retryAfterSeconds))
	}
	return Response.json({ success: false, error: message }, { status, headers })
}

export function miniProgramSuccessResponse(body: Record<string, unknown>): Response {
	return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
