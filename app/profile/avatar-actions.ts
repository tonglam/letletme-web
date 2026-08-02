'use server'

import { getAuthorizationSession } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { uploadAvatar } from '@/lib/supabase-storage'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function updateAvatar(
	formData: FormData,
): Promise<{ errorCode?: 'notAuthenticated' | 'noFile' | 'fileTooLarge' | 'invalidFile' | 'uploadFailed'; imageUrl?: string }> {
	const reqHeaders = await headers()
	const session = await getAuthorizationSession(reqHeaders)
	if (!session) return { errorCode: 'notAuthenticated' }

	const file = formData.get('avatar')
	if (!(file instanceof File) || file.size === 0) {
		return { errorCode: 'noFile' }
	}
	if (file.size > MAX_BYTES) {
		return { errorCode: 'fileTooLarge' }
	}
	if (!file.type.startsWith('image/')) {
		return { errorCode: 'invalidFile' }
	}

	try {
		const imageUrl = await uploadAvatar(session.user.id, file, file.type)

		await db
			.update(schema.user)
			.set({ image: imageUrl })
			.where(eq(schema.user.id, session.user.id))

		return { imageUrl }
	} catch (error) {
		console.error('[avatar] Failed to update:', error)
		return { errorCode: 'uploadFailed' }
	}
}
