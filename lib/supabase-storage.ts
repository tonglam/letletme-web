import 'server-only'

import { createHash, randomUUID } from 'crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { parseBugReportStorageLocator } from './bug-report-storage-locator'

export { parseBugReportStorageLocator } from './bug-report-storage-locator'

let _supabaseAdmin: SupabaseClient | undefined

export function getSupabaseAdmin(): SupabaseClient {
	if (_supabaseAdmin) return _supabaseAdmin

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	const secretKey = process.env.SUPABASE_SECRET_KEY

	if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
	if (!secretKey) throw new Error('SUPABASE_SECRET_KEY is not set')

	_supabaseAdmin = createClient(url, secretKey, {
		auth: { persistSession: false },
	})
	return _supabaseAdmin
}

export const AVATAR_BUCKET = 'letletme'
export const BUG_REPORT_SCREENSHOT_BUCKET = 'bug-report-screenshots'

const BUG_REPORT_SCREENSHOT_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif'
])
const BUG_REPORT_SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024

export async function uploadAvatar(
	userId: string,
	file: Blob,
	contentType: string,
	path = `avatars/${userId}/${randomUUID()}.jpg`
): Promise<{ imageUrl: string; path: string }> {
	const supabaseAdmin = getSupabaseAdmin()

	const { error } = await supabaseAdmin.storage
		.from(AVATAR_BUCKET)
		.upload(path, file, {
			contentType,
			upsert: true,
		})

	if (error) throw new Error(`Storage upload failed: ${error.message}`)

	const { data } = supabaseAdmin.storage
		.from(AVATAR_BUCKET)
		.getPublicUrl(path)

	// Bust the CDN cache so the new image shows immediately.
	return { imageUrl: data.publicUrl, path }
}

function extensionForContentType(contentType: string): string {
	if (contentType === 'image/png') return 'png'
	if (contentType === 'image/webp') return 'webp'
	if (contentType === 'image/gif') return 'gif'
	return 'jpg'
}

function sniffBugReportContentType(bytes: Buffer): string | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'image/jpeg'
	}
	if (
		bytes.length >= 8 &&
		bytes
			.subarray(0, 8)
			.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
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

export function buildBugReportScreenshotPath(
	submissionId: string,
	contentType: string
): string {
	return `bug-reports/${submissionId}.${extensionForContentType(contentType)}`
}

export async function uploadBugReportScreenshot(
	file: Buffer,
	contentType: string,
	submissionId: string
): Promise<string> {
	if (
		!BUG_REPORT_SCREENSHOT_TYPES.has(contentType) ||
		file.length === 0 ||
		file.length > BUG_REPORT_SCREENSHOT_MAX_BYTES ||
		sniffBugReportContentType(file) !== contentType
	) {
		throw new Error('Unsupported bug report screenshot type')
	}
	const supabaseAdmin = getSupabaseAdmin()
	const path = buildBugReportScreenshotPath(submissionId, contentType)
	const { error } = await supabaseAdmin.storage
		.from(BUG_REPORT_SCREENSHOT_BUCKET)
		.upload(path, file, {
			contentType,
			upsert: false,
		})
	if (error) throw new Error(`Storage upload failed: ${error.message}`)
	return path
}

export async function removeStorageObject(bucket: string, path: string): Promise<void> {
	const { error } = await getSupabaseAdmin().storage.from(bucket).remove([path])
	if (error) throw new Error(`Storage delete failed: ${error.message}`)
}

export function extractManagedAvatarPath(
	value: string | null | undefined,
	userId: string
): string | null {
	if (!value || !userId || userId.includes('/')) return null
	try {
		const url = new URL(value)
		const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
		if (!configuredUrl || new URL(configuredUrl).origin !== url.origin) return null
		const prefix = `/storage/v1/object/public/${AVATAR_BUCKET}/`
		if (!url.pathname.startsWith(prefix)) return null
		const path = decodeURIComponent(url.pathname.slice(prefix.length))
		if (path === `${userId}.jpg`) return path
		if (
			path.startsWith(`avatars/${userId}/`) &&
			/[0-9a-f-]{36}\.jpg$/i.test(path.slice(`avatars/${userId}/`.length))
		) {
			return path
		}
		return null
	} catch {
		return null
	}
}

function privateBugReportStorageUrl(path: string): string {
	const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
	if (!baseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
	return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(BUG_REPORT_SCREENSHOT_BUCKET)}/${path}`
}

export async function deleteBugReportStorageLocator(locator: string): Promise<void> {
	const parsed = parseBugReportStorageLocator(locator)
	if (
		!parsed ||
		parsed.public ||
		parsed.bucket !== BUG_REPORT_SCREENSHOT_BUCKET ||
		!parsed.path.startsWith('bug-reports/')
	) {
		throw new Error('BUG_REPORT_STORAGE_LOCATOR_INVALID')
	}
	const { error } = await getSupabaseAdmin()
		.storage.from(parsed.bucket)
		.remove([parsed.path])
	if (error) throw new Error(`Storage delete failed: ${error.message}`)
}

export async function deleteAllowedBugReportStorageLocator(locator: string): Promise<void> {
	const parsed = parseBugReportStorageLocator(locator)
	if (!parsed || ![BUG_REPORT_SCREENSHOT_BUCKET, AVATAR_BUCKET].includes(parsed.bucket)) {
		throw new Error('BUG_REPORT_STORAGE_LOCATOR_INVALID')
	}
	const allowed =
		(parsed.bucket === BUG_REPORT_SCREENSHOT_BUCKET &&
			!parsed.public &&
			parsed.path.startsWith('bug-reports/')) ||
		(parsed.bucket === AVATAR_BUCKET &&
			parsed.public &&
			parsed.path.startsWith('bug-reports/'))
	if (!allowed) throw new Error('BUG_REPORT_STORAGE_PATH_INVALID')
	const { error } = await getSupabaseAdmin()
		.storage.from(parsed.bucket)
		.remove([parsed.path])
	if (error && !/not found|does not exist/i.test(error.message)) {
		throw new Error(`Storage delete failed: ${error.message}`)
	}
}

export async function migrateBugReportStorageLocator(locator: string): Promise<string> {
	const parsed = parseBugReportStorageLocator(locator)
	if (
		!parsed ||
		!parsed.public ||
		parsed.bucket !== AVATAR_BUCKET ||
		!parsed.path.startsWith('bug-reports/')
	) {
		throw new Error('BUG_REPORT_STORAGE_LOCATOR_INVALID')
	}
	const source = await getSupabaseAdmin().storage.from(parsed.bucket).download(parsed.path)
	if (source.error) {
		if (/not found|does not exist/i.test(source.error.message)) {
			throw new Error('BUG_REPORT_STORAGE_NOT_FOUND')
		}
		throw new Error(`Storage download failed: ${source.error.message}`)
	}
	const bytes = Buffer.from(await source.data.arrayBuffer())
	if (bytes.length === 0 || bytes.length > BUG_REPORT_SCREENSHOT_MAX_BYTES) {
		throw new Error('BUG_REPORT_SCREENSHOT_INVALID')
	}
	const contentType = sniffBugReportContentType(bytes)
	if (!contentType) throw new Error('BUG_REPORT_SCREENSHOT_INVALID')
	const path = `bug-reports/migrated-${createHash('sha256')
		.update(locator)
		.digest('hex')}.${extensionForContentType(contentType)}`
	const { error } = await getSupabaseAdmin().storage
		.from(BUG_REPORT_SCREENSHOT_BUCKET)
		.upload(path, bytes, { contentType, upsert: false })
	if (error && !/already exists/i.test(error.message)) {
		throw new Error(`Storage migration failed: ${error.message}`)
	}
	return privateBugReportStorageUrl(path)
}
