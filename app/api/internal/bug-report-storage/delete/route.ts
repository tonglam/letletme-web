import { NextResponse } from 'next/server'

import {
	consumeBugReportStorageNonce,
	deleteBugReportStorage,
	verifyBugReportStorageSignature
} from '@/lib/bug-report-storage-internal'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const body = await request.text()
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
		await deleteBugReportStorage(payload.locator)
		return NextResponse.json({ success: true })
	} catch (error) {
		if (error instanceof SyntaxError)
			return NextResponse.json(
				{ success: false, error: 'Invalid JSON' },
				{ status: 400 }
			)
		return NextResponse.json(
			{ success: false, error: 'Storage delete failed' },
			{ status: 502 }
		)
	}
}
