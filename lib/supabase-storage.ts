import 'server-only'

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
if (!secretKey) throw new Error('SUPABASE_SECRET_KEY is not set')

// Secret-key client — server only, bypasses RLS for storage operations.
export const supabaseAdmin = createClient(url, secretKey, {
	auth: { persistSession: false },
})

export const AVATAR_BUCKET = 'letletme'

export async function uploadAvatar(
	userId: string,
	file: Blob,
	contentType: string,
): Promise<string> {
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
