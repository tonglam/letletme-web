import 'server-only'

import { randomUUID } from 'crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _supabaseAdmin: SupabaseClient | undefined

function getSupabaseAdmin(): SupabaseClient {
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

export async function uploadAvatar(
	userId: string,
	file: Blob,
	contentType: string,
): Promise<string> {
	const supabaseAdmin = getSupabaseAdmin()
	const path = `${userId}.jpg`

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
	return `${data.publicUrl}?t=${Date.now()}`
}

function extensionForContentType(contentType: string): string {
	if (contentType === 'image/png') return 'png'
	if (contentType === 'image/webp') return 'webp'
	if (contentType === 'image/gif') return 'gif'
	return 'jpg'
}

export async function uploadBugReportScreenshot(
	file: Buffer,
	contentType: string
): Promise<string> {
	const supabaseAdmin = getSupabaseAdmin()
	const path = `bug-reports/${randomUUID()}.${extensionForContentType(contentType)}`
	const { error } = await supabaseAdmin.storage.from(AVATAR_BUCKET).upload(path, file, {
		contentType,
		upsert: false,
	})
	if (error) throw new Error(`Storage upload failed: ${error.message}`)
	const { data } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(path)
	return data.publicUrl
}
