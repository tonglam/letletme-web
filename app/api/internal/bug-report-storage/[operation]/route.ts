import { PayloadTooLargeError, readBoundedText } from '@/lib/http-security-core'
import {
	BugReportStorageObjectMissingError,
	deleteBugReportScreenshot,
	migrateLegacyBugReportScreenshot
} from '@/lib/bug-report-storage-internal'
import {
	BUG_REPORT_STORAGE_MAX_BODY_BYTES,
	BugReportStorageInputError,
	verifyBugReportStorageEnvelope
} from '@/lib/bug-report-storage-contract'
import { markPrivateNoStore } from '@/lib/private-no-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Operation = 'migrate' | 'delete'

function response(body: unknown, status: number): Response {
	return markPrivateNoStore(Response.json(body, { status }))
}

function isOperation(value: string): value is Operation {
	return value === 'migrate' || value === 'delete'
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ operation: string }> }
): Promise<Response> {
	const secret = process.env.BUG_REPORT_CLEANUP_SECRET?.trim()
	if (!secret) return response({ success: false, error: 'Not configured' }, 503)

	const operation = (await params).operation
	if (!isOperation(operation)) return response({ success: false, error: 'Not found' }, 404)

	let body: string
	try {
		body = await readBoundedText(request, BUG_REPORT_STORAGE_MAX_BODY_BYTES)
	} catch (error) {
		if (error instanceof PayloadTooLargeError)
			return response({ success: false, error: 'Payload too large' }, 413)
		return response({ success: false, error: 'Invalid request body' }, 400)
	}

	if (
		!verifyBugReportStorageEnvelope({
			secret,
			timestamp: request.headers.get('x-bug-report-timestamp')?.trim() ?? '',
			nonce: request.headers.get('x-bug-report-nonce')?.trim() ?? '',
			bodyHash: request.headers.get('x-bug-report-body-sha256')?.trim() ?? '',
			signature: request.headers.get('x-bug-report-signature')?.trim() ?? '',
			body
		})
	)
		return response({ success: false, error: 'Invalid request envelope' }, 401)

	let parsed: unknown
	try {
		parsed = JSON.parse(body)
	} catch {
		return response({ success: false, error: 'Invalid request body' }, 400)
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
		return response({ success: false, error: 'Invalid request body' }, 400)
	const locator = (parsed as { locator?: unknown }).locator
	if (typeof locator !== 'string' || locator.length === 0 || locator.length > 4 * 1024)
		return response({ success: false, error: 'Invalid locator' }, 400)

	try {
		if (operation === 'migrate') {
			const targetLocator = await migrateLegacyBugReportScreenshot(locator)
			return response({ success: true, locator: targetLocator }, 200)
		}
		const result = await deleteBugReportScreenshot(locator)
		if (result === 'missing') {
			return response(
				{
					success: true,
					code: 'BUG_REPORT_STORAGE_OBJECT_MISSING',
					objectMissing: true
				},
				404
			)
		}
		return response({ success: true }, 200)
	} catch (error) {
		if (error instanceof BugReportStorageInputError)
			return response({ success: false, error: 'Invalid locator or object' }, 400)
		if (error instanceof BugReportStorageObjectMissingError)
			return response(
				{
					success: true,
					code: 'BUG_REPORT_STORAGE_OBJECT_MISSING',
					objectMissing: true
				},
				404
			)
		return response({ success: false, error: 'Storage operation failed' }, 502)
	}
}
