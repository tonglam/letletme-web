import 'server-only'

import { createHmac, randomBytes } from 'crypto'

import { tournamentApiFetch } from '@/lib/tournament/backend-client'
import {
	BUG_REPORT_BODY_MAX,
	BUG_REPORT_BODY_MIN,
	decodeOptionalScreenshot,
	normalizeBugReportBody,
	sanitizeBugReportClientMeta,
	type BugReportSource,
} from '@/lib/bug-report-meta'
import { checkDatabaseRateLimit, buildOpaqueRateLimitSubject, resolveProviderClientIp } from '@/lib/http-security'
import { uploadBugReportScreenshot } from '@/lib/supabase-storage'

export class BugReportSubmitError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly retryAfterSeconds?: number
	) {
		super(message)
		this.name = 'BugReportSubmitError'
	}
}

const ANONYMOUS_COOKIE = 'll_report_aid'
const ANONYMOUS_COOKIE_PATTERN = /^[a-f0-9]{32}$/
const IP_REPORTS_PER_HOUR = 30
const REPORTER_REPORTS_PER_HOUR = 5
const RATE_WINDOW_SECONDS = 60 * 60

function parseCookieValue(cookieHeader: string | null, name: string): string | null {
	if (!cookieHeader) return null
	for (const part of cookieHeader.split(';')) {
		const trimmed = part.trim()
		const separator = trimmed.indexOf('=')
		if (separator <= 0) continue
		if (trimmed.slice(0, separator) !== name) continue
		return trimmed.slice(separator + 1)
	}
	return null
}

export function takeAnonymousReportId(request: Request): {
	id: string
	setCookie: string | null
} {
	const existing = parseCookieValue(request.headers.get('cookie'), ANONYMOUS_COOKIE)
	if (existing && ANONYMOUS_COOKIE_PATTERN.test(existing)) {
		return { id: existing, setCookie: null }
	}
	const id = randomBytes(16).toString('hex')
	const parts = [
		`${ANONYMOUS_COOKIE}=${id}`,
		'Path=/api/bug-reports',
		'HttpOnly',
		'SameSite=Lax',
		'Max-Age=31536000',
	]
	if (process.env.NODE_ENV === 'production') parts.push('Secure')
	return { id, setCookie: parts.join('; ') }
}

function bugReportPrincipal(identity: {
	userId: string | null
	anonymousId: string | null
}): string | null {
	return identity.userId
		? `user:${identity.userId}`
		: identity.anonymousId
			? `anon:${identity.anonymousId}`
			: null
}

function buildBugReportIngressSubject(
	request: Request,
	secret: string,
	identity: { userId: string | null; anonymousId: string | null }
): string {
	if (resolveProviderClientIp(request.headers) !== 'unknown') {
		return buildOpaqueRateLimitSubject(request.headers, secret)
	}
	const principal = bugReportPrincipal(identity)
	if (!principal) {
		throw new BugReportSubmitError(
			'Too many reports just now. Please try again later.',
			429
		)
	}
	return createHmac('sha256', secret).update(`rate-limit:${principal}`).digest('hex')
}

async function consumeRateLimit(
	secret: string,
	scope: string,
	subjectSeed: string,
	limit: number
): Promise<void> {
	const result = await checkDatabaseRateLimit({
		scope,
		subject: createHmac('sha256', secret).update(subjectSeed).digest('hex'),
		limit,
		windowSeconds: RATE_WINDOW_SECONDS,
	})
	if (!result.allowed) {
		throw new BugReportSubmitError(
			'Too many reports just now. Please try again later.',
			429,
			result.retryAfterSeconds
		)
	}
}

export async function enforceBugReportIngressLimit(
	request: Request,
	identity: { userId: string | null; anonymousId: string | null }
): Promise<void> {
	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret) {
		throw new BugReportSubmitError('Request safety checks are unavailable', 503)
	}
	const result = await checkDatabaseRateLimit({
		scope: 'bug-report-ip',
		subject: buildBugReportIngressSubject(request, secret, identity),
		limit: IP_REPORTS_PER_HOUR,
		windowSeconds: RATE_WINDOW_SECONDS,
	})
	if (!result.allowed) {
		throw new BugReportSubmitError(
			'Too many reports just now. Please try again later.',
			429,
			result.retryAfterSeconds
		)
	}
}

export async function enforceBugReportReporterLimit(identity: {
	userId: string | null
	anonymousId: string | null
}): Promise<void> {
	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret) {
		throw new BugReportSubmitError('Request safety checks are unavailable', 503)
	}
	const principal = bugReportPrincipal(identity)
	if (!principal) return
	await consumeRateLimit(
		secret,
		'bug-report-reporter',
		`bug-report:${principal}`,
		REPORTER_REPORTS_PER_HOUR
	)
}

export async function enforceBugReportRateLimit(
	request: Request,
	identity: { userId: string | null; anonymousId: string | null }
): Promise<void> {
	await enforceBugReportIngressLimit(request, identity)
	await enforceBugReportReporterLimit(identity)
}

export async function submitBugReportToData({
	request,
	source,
	userId,
	entryId,
	body,
	clientMeta,
	screenshotBase64,
	screenshotMime,
}: {
	request: Request
	source: BugReportSource
	userId: string | null
	entryId: number | null
	body: unknown
	clientMeta: unknown
	screenshotBase64?: unknown
	screenshotMime?: unknown
}): Promise<{ publicId: string }> {
	const description = normalizeBugReportBody(body)
	if (description.length < BUG_REPORT_BODY_MIN) {
		throw new BugReportSubmitError('Please write a little more about what happened.', 400)
	}
	if (description.length > BUG_REPORT_BODY_MAX) {
		throw new BugReportSubmitError('Please keep the description under 500 characters.', 400)
	}

	let screenshot
	try {
		screenshot = decodeOptionalScreenshot(screenshotBase64, screenshotMime)
	} catch (error) {
		const code = error instanceof Error ? error.message : ''
		if (code === 'SCREENSHOT_UNSUPPORTED') {
			throw new BugReportSubmitError(
				'That picture type is not supported. Skip it or pick a photo.',
				400
			)
		}
		throw new BugReportSubmitError('That picture is too large. Skip it or pick a smaller one.', 413)
	}

	let screenshotUrl: string | null = null
	if (screenshot) {
		try {
			screenshotUrl = await uploadBugReportScreenshot(
				screenshot.bytes,
				screenshot.contentType
			)
		} catch {
			throw new BugReportSubmitError(
				'That picture did not attach. Skip it or try again.',
				502
			)
		}
	}

	const response = await tournamentApiFetch(
		'/bug-reports',
		{
			method: 'POST',
			body: JSON.stringify({
				source,
				userId,
				entryId,
				body: description,
				screenshotUrl,
				clientMeta: sanitizeBugReportClientMeta(clientMeta),
			}),
		},
		request
	)
	const result = (await response.json()) as { success?: boolean; publicId?: string; error?: string }
	if (!response.ok || !result.success || typeof result.publicId !== 'string') {
		throw new BugReportSubmitError(
			result.error || 'Could not send the report.',
			response.status >= 400 ? response.status : 502
		)
	}
	return { publicId: result.publicId }
}
