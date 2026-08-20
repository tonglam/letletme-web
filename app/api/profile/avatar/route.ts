import { createHmac } from 'node:crypto'

import { getAuthorizationSession } from '@/lib/auth'
import {
	AVATAR_CONTENT_TYPES,
	AVATAR_INPUT_MAX_BYTES,
	InvalidAvatarError,
	normalizeAvatar,
} from '@/lib/avatar-processing'
import { checkDatabaseRateLimit } from '@/lib/http-security'
import { PayloadTooLargeError, readBoundedBytes } from '@/lib/http-security-core'
import {
	AVATAR_BUCKET,
	extractManagedAvatarPath,
	removeStorageObject,
	uploadAvatar,
} from '@/lib/supabase-storage'
import { isTrustedSameSiteRequest } from '@/lib/request-origin'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MAX_MULTIPART_BODY_BYTES = AVATAR_INPUT_MAX_BYTES + 64 * 1024
const AVATAR_RATE_LIMIT = 10
const AVATAR_RATE_WINDOW_SECONDS = 60 * 60

type AvatarErrorCode =
	| 'notAuthenticated'
	| 'forbidden'
	| 'noFile'
	| 'fileTooLarge'
	| 'invalidFile'
	| 'rateLimited'
	| 'uploadFailed'

function errorResponse(errorCode: AvatarErrorCode, status: number) {
	return NextResponse.json({ success: false, errorCode }, { status })
}

export async function POST(request: Request) {
	if (!isTrustedSameSiteRequest(request)) {
		return errorResponse('forbidden', 403)
	}

	let session: Awaited<ReturnType<typeof getAuthorizationSession>>
	try {
		session = await getAuthorizationSession(request.headers)
	} catch {
		return errorResponse('uploadFailed', 502)
	}
	if (!session) return errorResponse('notAuthenticated', 401)

	const rateSecret = process.env.BACKEND_PROXY_SECRET
	if (!rateSecret) return errorResponse('uploadFailed', 502)
	const rateSubject = createHmac('sha256', rateSecret)
		.update(`avatar:${session.user.id}`)
		.digest('hex')
	let rate
	try {
		rate = await checkDatabaseRateLimit({
			scope: 'avatar-upload-user',
			subject: rateSubject,
			limit: AVATAR_RATE_LIMIT,
			windowSeconds: AVATAR_RATE_WINDOW_SECONDS,
		})
	} catch {
		return errorResponse('uploadFailed', 502)
	}
	if (!rate.allowed) {
		const response = errorResponse('rateLimited', 429)
		response.headers.set('Retry-After', String(rate.retryAfterSeconds))
		return response
	}

	let body: Uint8Array
	try {
		body = await readBoundedBytes(request, MAX_MULTIPART_BODY_BYTES)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return errorResponse('fileTooLarge', 413)
		}
		return errorResponse('uploadFailed', 400)
	}

	let form: FormData
	try {
		form = await new Request(request.url, {
			method: 'POST',
			headers: request.headers,
			body: body as unknown as BodyInit,
		}).formData()
	} catch {
		return errorResponse('invalidFile', 400)
	}

	const file = form.get('avatar')
	if (!(file instanceof File) || file.size === 0) {
		return errorResponse('noFile', 400)
	}
	if (file.size > AVATAR_INPUT_MAX_BYTES) {
		return errorResponse('fileTooLarge', 413)
	}
	if (!AVATAR_CONTENT_TYPES.has(file.type)) {
		return errorResponse('invalidFile', 415)
	}

	let normalized: Buffer
	try {
		normalized = await normalizeAvatar(
			new Uint8Array(await file.arrayBuffer()),
			file.type
		)
	} catch (error) {
		if (error instanceof InvalidAvatarError) return errorResponse('invalidFile', 415)
		return errorResponse('uploadFailed', 502)
	}

	let previous: Array<{ image: string | null }>
	try {
		previous = await db
			.select({ image: schema.user.image })
			.from(schema.user)
			.where(eq(schema.user.id, session.user.id))
			.limit(1)
	} catch (error) {
		console.error('[avatar] previous image lookup failed', {
			error: error instanceof Error ? error.name : 'UnknownError',
		})
		return errorResponse('uploadFailed', 502)
	}
	const previousPath = extractManagedAvatarPath(previous[0]?.image)

	let uploaded: { imageUrl: string; path: string } | null = null
	try {
		uploaded = await uploadAvatar(
			session.user.id,
			new Blob([new Uint8Array(normalized)]),
			'image/jpeg'
		)
		const [updated] = await db
			.update(schema.user)
			.set({ image: uploaded.imageUrl })
			.where(eq(schema.user.id, session.user.id))
			.returning({ id: schema.user.id })
		if (!updated) throw new Error('Avatar owner was not found')
	} catch (error) {
		if (uploaded) {
			try {
				await removeStorageObject(AVATAR_BUCKET, uploaded.path)
			} catch (cleanupError) {
				console.error('[avatar] failed to remove uncommitted object', {
					error: cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
				})
			}
		}
		console.error('[avatar] upload failed', {
			error: error instanceof Error ? error.name : 'UnknownError',
		})
		return errorResponse('uploadFailed', 502)
	}

	if (!uploaded) return errorResponse('uploadFailed', 502)

	if (previousPath && previousPath !== uploaded.path) {
		try {
			await removeStorageObject(AVATAR_BUCKET, previousPath)
		} catch (error) {
			console.warn('[avatar] previous object cleanup failed', {
				error: error instanceof Error ? error.name : 'UnknownError',
			})
		}
	}

	return NextResponse.json({ success: true, imageUrl: uploaded.imageUrl })
}
