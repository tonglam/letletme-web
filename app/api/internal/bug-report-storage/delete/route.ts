import { NextResponse } from 'next/server'

import { PayloadTooLargeError, readBoundedText } from '@/lib/http-security-core'
import {
	BUG_REPORT_STORAGE_BODY_MAX_BYTES,
	consumeBugReportStorageNonce,
	deleteBugReportStorage,
	verifyBugReportStorageSignature
} from '@/lib/bug-report-storage-internal'
import { markPrivateNoStore } from '@/lib/private-no-store'

export const dynamic = 'force-dynamic'

function response(body: unknown, status = 200): Response {
	return markPrivateNoStore(NextResponse.json(body, { status }))
}

export async function POST(request: Request) {
	let body: string
	try {
		body = await readBoundedText(request, BUG_REPORT_STORAGE_BODY_MAX_BYTES)
	} catch (error) {
		return response(
			{ success: false, error: error instanceof PayloadTooLargeError ? 'Payload too large' : 'Invalid body' },
			error instanceof PayloadTooLargeError ? 413 : 400
		)
	}
	if (!verifyBugReportStorageSignature(request, body)) {
		return response({ success: false, error: 'Unauthorized' }, 401)
	}
	try {
		if (
			!(await consumeBugReportStorageNonce(
				request.headers.get('x-bug-report-nonce') || ''
			))
		) {
			return response({ success: false, error: 'Unauthorized' }, 401)
		}
		const payload = JSON.parse(body) as { locator?: unknown }
		if (typeof payload.locator !== 'string')
			return response({ success: false, error: 'Invalid locator' }, 400)
		const result = await deleteBugReportStorage(payload.locator)
		if (result === 'missing')
			return response(
				{
					success: true,
					code: 'BUG_REPORT_STORAGE_OBJECT_MISSING',
					objectMissing: true
				},
				404
			)
		return response({ success: true })
	} catch (error) {
		if (error instanceof SyntaxError)
			return response({ success: false, error: 'Invalid JSON' }, 400)
		return response({ success: false, error: 'Storage delete failed' }, 502)
	}
}
