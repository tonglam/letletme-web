import 'server-only'

import { createHmac, randomBytes, randomUUID } from 'crypto'

import { PublicError } from '@/lib/safe-errors'
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
import {
	BUG_REPORT_SCREENSHOT_BUCKET,
	buildBugReportScreenshotPath,
	removeStorageObject,
	uploadBugReportScreenshot,
} from '@/lib/supabase-storage'
import {
	canCleanupBugReportScreenshotAfterDataAttempts,
	type BugReportDataAttemptOutcome,
} from '@/lib/bug-report-retry'
export class BugReportSubmitError extends PublicError {
	constructor(
		message: string,
		readonly status: number,
		readonly retryAfterSeconds?: number
	) {
		super(message, 'BugReportSubmitError')
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

function buildKnownIpIngressSubject(request: Request, secret: string): string {
	return buildOpaqueRateLimitSubject(request.headers, secret)
}

function buildUnknownIpIngressSubject(
	request: Request,
	secret: string,
	identity: { userId: string | null; anonymousId: string | null }
): string {
	const principal = bugReportPrincipal(identity)
	if (!principal) {
		throw new BugReportSubmitError(
			'Too many reports just now. Please try again later.',
			429
		)
	}
	return createHmac('sha256', secret).update(`rate-limit:${principal}`).digest('hex')
}

async function consumeIngressLimit(request: Request, secret: string, subject: string): Promise<void> {
	const result = await checkDatabaseRateLimit({
		scope: 'bug-report-ip',
		subject,
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

export async function enforceBugReportIpLimit(request: Request): Promise<void> {
	if (resolveProviderClientIp(request.headers) === 'unknown') return
	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret) {
		throw new BugReportSubmitError('Request safety checks are unavailable', 503)
	}
	await consumeIngressLimit(request, secret, buildKnownIpIngressSubject(request, secret))
}

export async function enforceBugReportIngressLimit(
	request: Request,
	identity: { userId: string | null; anonymousId: string | null }
): Promise<void> {
	if (resolveProviderClientIp(request.headers) !== 'unknown') return
	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret) {
		throw new BugReportSubmitError('Request safety checks are unavailable', 503)
	}
	await consumeIngressLimit(
		request,
		secret,
		buildUnknownIpIngressSubject(request, secret, identity)
	)
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
	await enforceBugReportIpLimit(request)
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

	const submissionId = randomUUID()
	let screenshotObjectKey: string | null = null
	if (screenshot) {
		screenshotObjectKey = buildBugReportScreenshotPath(
			submissionId,
			screenshot.contentType
		)
		try {
			await uploadBugReportScreenshot(
				screenshot.bytes,
				screenshot.contentType,
				submissionId
			)
		} catch {
			try {
				await removeStorageObject(
					BUG_REPORT_SCREENSHOT_BUCKET,
					screenshotObjectKey
				)
			} catch (cleanupError) {
				console.error('[bug-report] screenshot cleanup failed after upload error', {
					error: cleanupError instanceof Error ? cleanupError.name : 'UnknownError'
				})
			}
			throw new BugReportSubmitError(
				'That picture did not attach. Skip it or try again.',
				502
			)
		}
	}

	const dataAttemptOutcomes: BugReportDataAttemptOutcome[] = []
	try {
		let lastStatus = 502
		let lastMessage = 'Could not send the report.'
		for (let attempt = 0; attempt < 2; attempt += 1) {
			// Cleanup is decided from the complete attempt history. A parse failure
			// can trigger a retry, so a later 4xx must not override an earlier
			// ambiguous outcome.
			try {
				const response = await tournamentApiFetch(
					'/bug-reports',
					{
						method: 'POST',
						body: JSON.stringify({
							source,
							userId,
							entryId,
							body: description,
							submissionId,
							screenshotObjectKey,
							clientMeta: sanitizeBugReportClientMeta(clientMeta),
						}),
					},
					request
				)
				// A 4xx response is a definitive rejection: the Data handler did not
				// persist this submission, so an uploaded attachment can be removed.
				// 5xx responses, malformed bodies, and transport errors are ambiguous;
				// Data may have committed before the response was lost. Leave those
				// objects for the private-bucket retention/orphan sweep.
				const result = (await response.json()) as {
					success?: boolean
					publicId?: string
				}
				if (response.ok && result.success && typeof result.publicId === 'string') {
					dataAttemptOutcomes.push('success')
					return { publicId: result.publicId }
				}
				if (response.status >= 400 && response.status < 500) {
					dataAttemptOutcomes.push('definitive-rejection')
				} else {
					dataAttemptOutcomes.push('ambiguous')
				}
				lastStatus = response.status >= 400 ? response.status : 502
				// The Data API response is an untrusted service boundary. Do not copy
				// its error text into a browser-facing response.
				lastMessage = response.status === 429
					? 'Too many reports just now. Please try again later.'
					: lastMessage
				if (response.status < 500 || attempt === 1) break
			} catch (error) {
				dataAttemptOutcomes.push('ambiguous')
				if (attempt === 1) throw error
			}
		}
		throw new BugReportSubmitError(lastMessage, lastStatus)
	} catch (error) {
		if (
			screenshotObjectKey &&
			canCleanupBugReportScreenshotAfterDataAttempts(dataAttemptOutcomes)
		) {
			try {
				await removeStorageObject(BUG_REPORT_SCREENSHOT_BUCKET, screenshotObjectKey)
			} catch (cleanupError) {
				console.error('[bug-report] screenshot cleanup failed after Data error', {
					error: cleanupError instanceof Error ? cleanupError.name : 'UnknownError'
				})
			}
		}
		throw error
	}
}
