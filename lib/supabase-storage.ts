import 'server-only'

import { randomUUID } from 'crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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
	if (!BUG_REPORT_SCREENSHOT_TYPES.has(contentType)) {
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
