import { NextResponse } from 'next/server'

import { PayloadTooLargeError } from '@/lib/http-security'
import {
	InvalidBugReportJsonError,
	readBugReportJson
} from '@/lib/bug-report-request'
import { getVerifiedEntryContext } from '@/lib/session'
import {
	BugReportSubmitError,
	enforceBugReportRateLimit,
	submitBugReportToData,
	takeAnonymousReportId
} from '@/lib/bug-report-submit'
import { markPrivateNoStore } from '@/lib/private-no-store'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 3 * 1024 * 1024

function jsonResponse(
	body: unknown,
	init: { status: number; headers?: Headers },
	setCookie: string | null
) {
	const response = markPrivateNoStore(NextResponse.json(body, init))
	if (setCookie) response.headers.append('Set-Cookie', setCookie)
	return response
}

export async function POST(request: Request) {
	const anonymous = takeAnonymousReportId(request)
	try {
		const { session, entryId } = await getVerifiedEntryContext()
		const userId = session?.user.id ?? null
		await enforceBugReportRateLimit(request, {
			userId,
			anonymousId: userId ? null : anonymous.id
		})

		let payload: unknown
		try {
			payload = await readBugReportJson(request, MAX_BODY_BYTES)
		} catch (error) {
			if (error instanceof InvalidBugReportJsonError) {
				return jsonResponse(
					{ success: false, error: 'Invalid JSON body' },
					{ status: 400 },
					anonymous.setCookie
				)
			}
			throw error
		}
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return jsonResponse(
				{ success: false, error: 'Invalid JSON body' },
				{ status: 400 },
				anonymous.setCookie
			)
		}

		const result = await submitBugReportToData({
			request,
			source: 'website',
			userId,
			entryId,
			body: 'body' in payload ? payload.body : '',
			clientMeta: 'clientMeta' in payload ? payload.clientMeta : {},
			screenshotBase64:
				'screenshotBase64' in payload ? payload.screenshotBase64 : null,
			screenshotMime:
				'screenshotMime' in payload ? payload.screenshotMime : null
		})
		return jsonResponse(
			{ success: true, publicId: result.publicId },
			{ status: 201 },
			anonymous.setCookie
		)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return jsonResponse(
				{ success: false, error: 'Payload too large' },
				{ status: 413 },
				anonymous.setCookie
			)
		}
		if (error instanceof BugReportSubmitError) {
			const headers = new Headers()
			if (error.retryAfterSeconds)
				headers.set('Retry-After', String(error.retryAfterSeconds))
			return jsonResponse(
				{ success: false, error: error.message },
				{ status: error.status, headers },
				anonymous.setCookie
			)
		}
		return jsonResponse(
			{ success: false, error: 'Could not send the report.' },
			{ status: 500 },
			anonymous.setCookie
		)
	}
}
