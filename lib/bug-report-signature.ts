import { createHash, createHmac, timingSafeEqual } from 'crypto'

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
const nonceExpiry = new Map<string, number>()

function rememberNonce(nonce: string, now: number): boolean {
	nonceExpiry.forEach((expires, key) => {
		if (expires <= now) nonceExpiry.delete(key)
	})
	if (!nonce || nonce.length > 128 || nonceExpiry.has(nonce)) return false
	nonceExpiry.set(nonce, now + MAX_CLOCK_SKEW_MS)
	return true
}

function constantTimeHexEqual(left: string, right: string): boolean {
	const a = Buffer.from(left, 'hex')
	const b = Buffer.from(right, 'hex')
	return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
}

export function verifyBugReportStorageSignature(
	request: Request,
	body: string
): boolean {
	const secret = process.env.BUG_REPORT_CLEANUP_SECRET
	if (!secret) return false
	const timestamp = request.headers.get('x-bug-report-timestamp') || ''
	const nonce = request.headers.get('x-bug-report-nonce') || ''
	const bodyHash = request.headers.get('x-bug-report-body-sha256') || ''
	const provided = request.headers.get('x-bug-report-signature') || ''
	const parsed = Number(timestamp)
	const now = Date.now()
	if (
		!Number.isSafeInteger(parsed) ||
		Math.abs(now - parsed) > MAX_CLOCK_SKEW_MS
	)
		return false
	const expectedBodyHash = createHash('sha256').update(body).digest('hex')
	if (!constantTimeHexEqual(bodyHash, expectedBodyHash)) return false
	const expected = createHmac('sha256', secret)
		.update(`${timestamp}.${nonce}.${bodyHash}`)
		.digest('hex')
	if (!constantTimeHexEqual(provided, expected)) return false
	return rememberNonce(nonce, now)
}
