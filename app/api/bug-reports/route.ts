import { NextResponse } from 'next/server'

import { PayloadTooLargeError, readBoundedJson } from '@/lib/http-security'
import { getVerifiedEntryContext } from '@/lib/session'
import {
	BugReportSubmitError,
	enforceBugReportRateLimit,
	submitBugReportToData,
} from '@/lib/bug-report-submit'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 3 * 1024 * 1024

export async function POST(request: Request) {
	try {
		const { session, entryId } = await getVerifiedEntryContext()
		await enforceBugReportRateLimit(request, session?.user.id ?? null)

		const payload = await readBoundedJson(request, MAX_BODY_BYTES)
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
		}

		const result = await submitBugReportToData({
			request,
			source: 'website',
			userId: session?.user.id ?? null,
			entryId,
			body: 'body' in payload ? payload.body : '',
			clientMeta: 'clientMeta' in payload ? payload.clientMeta : {},
			screenshotBase64: 'screenshotBase64' in payload ? payload.screenshotBase64 : null,
			screenshotMime: 'screenshotMime' in payload ? payload.screenshotMime : null,
		})
		return NextResponse.json({ success: true, publicId: result.publicId }, { status: 201 })
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 413 })
		}
		if (error instanceof BugReportSubmitError) {
			const headers = new Headers()
			if (error.retryAfterSeconds) headers.set('Retry-After', String(error.retryAfterSeconds))
			return NextResponse.json(
				{ success: false, error: error.message },
				{ status: error.status, headers }
			)
		}
		return NextResponse.json({ success: false, error: 'Could not send the report.' }, { status: 500 })
	}
}
