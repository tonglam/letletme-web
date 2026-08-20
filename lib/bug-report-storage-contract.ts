import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const BUG_REPORT_STORAGE_MAX_SKEW_MS = 5 * 60 * 1000
export const BUG_REPORT_STORAGE_MAX_BODY_BYTES = 16 * 1024

const LEGACY_BUCKET = 'letletme'
const PRIVATE_BUCKET = 'bug-report-screenshots'
const LEGACY_PREFIX = `/storage/v1/object/public/${LEGACY_BUCKET}/bug-reports/`

export class BugReportStorageInputError extends Error {}

function safeEqual(left: string, right: string): boolean {
	const leftBytes = Buffer.from(left, 'utf8')
	const rightBytes = Buffer.from(right, 'utf8')
	return (
		leftBytes.length === rightBytes.length &&
		timingSafeEqual(leftBytes, rightBytes)
	)
}

export function verifyBugReportStorageEnvelope(input: {
	secret: string
	timestamp: string
	nonce: string
	bodyHash: string
	signature: string
	body: string
	nowMs?: number
}): boolean {
	const { secret, timestamp, nonce, bodyHash, signature, body } = input
	if (
		!/^[0-9a-f]{64}$/i.test(bodyHash) ||
		!/^[0-9a-f]{64}$/i.test(signature) ||
		!/^[0-9]{10,13}$/.test(timestamp) ||
		nonce.length < 16 ||
		nonce.length > 128 ||
		!/^[a-f0-9-]+$/i.test(nonce)
	)
		return false

	const timestampMs = Number(timestamp)
	if (!Number.isFinite(timestampMs)) return false
	const eventMs = timestamp.length <= 10 ? timestampMs * 1000 : timestampMs
	if (
		Math.abs((input.nowMs ?? Date.now()) - eventMs) >
		BUG_REPORT_STORAGE_MAX_SKEW_MS
	)
		return false

	const expectedBodyHash = createHash('sha256').update(body, 'utf8').digest('hex')
	if (!safeEqual(bodyHash.toLowerCase(), expectedBodyHash)) return false
	const expectedSignature = createHmac('sha256', secret)
		.update(`${timestamp}.${nonce}.${bodyHash}`)
		.digest('hex')
	return safeEqual(signature.toLowerCase(), expectedSignature)
}

export function configuredSupabaseOrigin(): string {
	const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
	if (!value) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
	const parsed = new URL(value)
	if (
		parsed.protocol !== 'https:' ||
		parsed.username ||
		parsed.password ||
		parsed.pathname !== '/' ||
		parsed.search ||
		parsed.hash
	)
		throw new Error('NEXT_PUBLIC_SUPABASE_URL is invalid')
	return parsed.origin
}

export function buildPrivateBugReportLocator(
	objectKey: string,
	baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
	bucket = PRIVATE_BUCKET
): string {
	if (!baseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
	const url = new URL(baseUrl)
	const encodedPath = objectKey
		.split('/')
		.map(segment => encodeURIComponent(segment))
		.join('/')
	return `${url.origin}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`
}

export function parseManagedBugReportLocator(locator: string): {
	bucket: string
	objectPath: string
} {
	let parsed: URL
	try {
		parsed = new URL(locator)
	} catch {
		throw new BugReportStorageInputError('Unsupported screenshot locator')
	}
	if (
		parsed.protocol !== 'https:' ||
		parsed.origin !== configuredSupabaseOrigin() ||
		parsed.username ||
		parsed.password ||
		parsed.search ||
		parsed.hash
	)
		throw new BugReportStorageInputError('Unsupported screenshot locator')
	let decodedPath: string
	try {
		decodedPath = decodeURIComponent(parsed.pathname)
	} catch {
		throw new BugReportStorageInputError('Unsupported screenshot locator')
	}
	let bucket: string
	let objectPath: string
	if (decodedPath.startsWith(LEGACY_PREFIX)) {
		bucket = LEGACY_BUCKET
		objectPath = `bug-reports/${decodedPath.slice(LEGACY_PREFIX.length)}`
	} else {
		const privatePrefix = `/storage/v1/object/${PRIVATE_BUCKET}/`
		if (!decodedPath.startsWith(privatePrefix))
			throw new BugReportStorageInputError('Unsupported screenshot locator')
		bucket = PRIVATE_BUCKET
		objectPath = decodedPath.slice(privatePrefix.length)
	}
	if (
		!objectPath ||
		!objectPath.startsWith('bug-reports/') ||
		objectPath.split('/').some(segment =>
			segment.length === 0 || segment === '.' || segment === '..'
		)
	)
		throw new BugReportStorageInputError('Unsupported screenshot locator')
	return { bucket, objectPath }
}

export function parseLegacyBugReportLocator(locator: string): string {
	const parsed = parseManagedBugReportLocator(locator)
	if (parsed.bucket !== LEGACY_BUCKET)
		throw new BugReportStorageInputError('Unsupported legacy screenshot locator')
	return parsed.objectPath
}
