'use server'

import { auth } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { uploadAvatar } from '@/lib/supabase-storage'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function updateAvatar(
	formData: FormData,
): Promise<{ error?: string; imageUrl?: string }> {
	const reqHeaders = await headers()
	const session = await auth.api.getSession({ headers: reqHeaders })
	if (!session) return { error: 'Not authenticated' }

	const file = formData.get('avatar')
	if (!(file instanceof File) || file.size === 0) {
		return { error: 'No file provided' }
	}
	if (file.size > MAX_BYTES) {
		return { error: 'Image must be under 5 MB' }
	}
	if (!file.type.startsWith('image/')) {
		return { error: 'File must be an image' }
	}

	const imageUrl = await uploadAvatar(session.user.id, file, file.type)

	await db
		.update(schema.user)
		.set({ image: imageUrl })
		.where(eq(schema.user.id, session.user.id))

	return { imageUrl }
}
