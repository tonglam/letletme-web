import 'server-only'

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
