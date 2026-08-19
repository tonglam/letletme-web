import 'server-only'

import { createHmac } from 'crypto'

import { tournamentApiFetch } from '@/lib/tournament/backend-client'
import {
	BUG_REPORT_BODY_MAX,
	BUG_REPORT_BODY_MIN,
	decodeOptionalScreenshot,
	normalizeBugReportBody,
	sanitizeBugReportClientMeta,
	type BugReportSource,
} from '@/lib/bug-report-meta'
import { checkDatabaseRateLimit, buildOpaqueRateLimitSubject } from '@/lib/http-security'
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

export async function enforceBugReportRateLimit(
	request: Request,
	identityKey: string | null
): Promise<void> {
	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret) {
		throw new BugReportSubmitError('Request safety checks are unavailable', 503)
	}
	const ipSubject = buildOpaqueRateLimitSubject(request.headers, secret)
	const checks: Array<{ subject: string; limit: number; windowSeconds: number }> = [
		{ subject: ipSubject, limit: 8, windowSeconds: 60 * 60 },
	]
	if (identityKey) {
		checks.push({
			subject: createHmac('sha256', secret)
				.update(`bug-report:${identityKey}`)
				.digest('hex'),
			limit: 5,
			windowSeconds: 60 * 60,
		})
	}
	for (const check of checks) {
		const result = await checkDatabaseRateLimit({
			scope: 'bug-report',
			subject: check.subject,
			limit: check.limit,
			windowSeconds: check.windowSeconds,
		})
		if (!result.allowed) {
			throw new BugReportSubmitError(
				'Too many reports just now. Please try again later.',
				429,
				result.retryAfterSeconds
			)
		}
	}
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
