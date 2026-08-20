const BLOCKED_META_KEYS = new Set([
	'token',
	'authorization',
	'cookie',
	'password',
	'secret',
	'otp',
	'code',
])
const ALLOWED_META_KEYS = new Set([
	'route',
	'currentGw',
	'envVersion',
	'clientTime',
	'platform',
	'osMajor',
	'sdkVersion',
	'language',
	'viewportBucket',
	'operations',
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
		if (BLOCKED_META_KEYS.has(key.toLowerCase()) || !ALLOWED_META_KEYS.has(key)) continue
		if (key === 'operations') {
			if (!Array.isArray(entry)) continue
			cleaned.operations = entry.slice(-3).flatMap((item) => {
				if (!isRecord(item)) return []
				const operation: Record<string, string> = {}
				for (const field of ['operation', 'requestId', 'code', 'message']) {
					if (typeof item[field] !== 'string') continue
					const text = item[field]
						.replace(/https?:\/\/[^\s]+/gi, '[url]')
						.replace(/([A-Za-z0-9_-]+)=(?:[^\s&]+)/g, '$1=[redacted]')
						.slice(0, 160)
					if (text) operation[field] = text
				}
				return Object.keys(operation).length ? [operation] : []
			})
			continue
		}
		if (typeof entry === 'string') cleaned[key] = entry.slice(0, 160)
		else if (typeof entry === 'number' && Number.isFinite(entry)) cleaned[key] = entry
		else if (typeof entry === 'boolean') cleaned[key] = entry
	}
	if (Buffer.byteLength(JSON.stringify(cleaned), 'utf8') > CLIENT_META_MAX_BYTES) {
		return { truncated: true }
	}
	return cleaned
}

export function normalizeBugReportBody(body: unknown): string {
	return typeof body === 'string' ? body.trim() : ''
}

function looksLikeSvgOrXml(bytes: Buffer): boolean {
	const head = bytes.subarray(0, 256).toString('utf8').trimStart()
	return head.startsWith('<')
}

function sniffImageContentType(bytes: Buffer): string | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'image/jpeg'
	}
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47
	) {
		return 'image/png'
	}
	if (bytes.length >= 6 && bytes.subarray(0, 3).toString('ascii') === 'GIF') {
		return 'image/gif'
	}
	if (
		bytes.length >= 12 &&
		bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
		bytes.subarray(8, 12).toString('ascii') === 'WEBP'
	) {
		return 'image/webp'
	}
	return null
}

export function decodeOptionalScreenshot(
	base64: unknown,
	_mime: unknown
): { bytes: Buffer; contentType: string } | null {
	if (typeof base64 !== 'string' || base64.trim().length === 0) return null
	const bytes = Buffer.from(base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ''), 'base64')
	if (bytes.length === 0) return null
	if (bytes.length > BUG_REPORT_SCREENSHOT_MAX_BYTES) {
		throw new Error('SCREENSHOT_TOO_LARGE')
	}
	if (looksLikeSvgOrXml(bytes)) {
		throw new Error('SCREENSHOT_UNSUPPORTED')
	}
	const contentType = sniffImageContentType(bytes)
	if (!contentType) {
		throw new Error('SCREENSHOT_UNSUPPORTED')
	}
	return { bytes, contentType }
}
