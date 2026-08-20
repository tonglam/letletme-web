import { NextResponse } from 'next/server'

import { PayloadTooLargeError, readBoundedText } from '@/lib/http-security-core'
import {
	BUG_REPORT_STORAGE_BODY_MAX_BYTES,
	consumeBugReportStorageNonce,
	migrateBugReportStorage,
	verifyBugReportStorageSignature
} from '@/lib/bug-report-storage-internal'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	let body: string
	try {
		body = await readBoundedText(request, BUG_REPORT_STORAGE_BODY_MAX_BYTES)
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: error instanceof PayloadTooLargeError ? 'Payload too large' : 'Invalid body' },
			{ status: error instanceof PayloadTooLargeError ? 413 : 400 }
		)
	}
	if (!verifyBugReportStorageSignature(request, body)) {
		return NextResponse.json(
			{ success: false, error: 'Unauthorized' },
			{ status: 401 }
		)
	}
	try {
		if (
			!(await consumeBugReportStorageNonce(
				request.headers.get('x-bug-report-nonce') || ''
			))
		) {
			return NextResponse.json(
				{ success: false, error: 'Unauthorized' },
				{ status: 401 }
			)
		}
		const payload = JSON.parse(body) as { locator?: unknown }
		if (typeof payload.locator !== 'string')
			return NextResponse.json(
				{ success: false, error: 'Invalid locator' },
				{ status: 400 }
			)
		const locator = await migrateBugReportStorage(payload.locator)
		return NextResponse.json({ success: true, locator })
	} catch (error) {
		if (error instanceof SyntaxError)
			return NextResponse.json(
				{ success: false, error: 'Invalid JSON' },
				{ status: 400 }
			)
		return NextResponse.json(
			{ success: false, error: 'Storage migration failed' },
			{ status: 502 }
		)
	}
}
