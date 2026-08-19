const BLOCKED_META_KEYS = new Set([
	'token',
	'authorization',
	'cookie',
	'password',
	'secret',
	'otp',
	'code',
])

export const BUG_REPORT_BODY_MIN = 8
export const BUG_REPORT_BODY_MAX = 500
export const BUG_REPORT_SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024
const CLIENT_META_MAX_BYTES = 16 * 1024

export type BugReportSource = 'website' | 'wechat_miniprogram'

export type BugReportClientPayload = {
	body: string
	clientMeta?: unknown
	screenshotBase64?: string | null
	screenshotMime?: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

export function sanitizeBugReportClientMeta(
	value: unknown
): Record<string, unknown> {
	if (!isRecord(value)) return {}
	const cleaned: Record<string, unknown> = {}
	for (const [key, entry] of Object.entries(value)) {
		if (BLOCKED_META_KEYS.has(key.toLowerCase())) continue
		cleaned[key] = entry
	}
	if (Buffer.byteLength(JSON.stringify(cleaned), 'utf8') > CLIENT_META_MAX_BYTES) {
		return { truncated: true }
	}
	return cleaned
}

export function normalizeBugReportBody(body: unknown): string {
	return typeof body === 'string' ? body.trim() : ''
}

export function decodeOptionalScreenshot(
	base64: unknown,
	mime: unknown
): { bytes: Buffer; contentType: string } | null {
	if (typeof base64 !== 'string' || base64.trim().length === 0) return null
	const contentType =
		typeof mime === 'string' && mime.startsWith('image/')
			? mime
			: 'image/jpeg'
	const bytes = Buffer.from(base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ''), 'base64')
	if (bytes.length === 0) return null
	if (bytes.length > BUG_REPORT_SCREENSHOT_MAX_BYTES) {
		throw new Error('SCREENSHOT_TOO_LARGE')
	}
	return { bytes, contentType }
}
