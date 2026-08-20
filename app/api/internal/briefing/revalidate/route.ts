import { revalidateTag } from 'next/cache'

import {
	briefingRevalidateTags,
	parseBriefingRevalidateEvent,
	verifyBriefingRevalidateEnvelope
} from '@/lib/briefing-revalidate'
import { PayloadTooLargeError, readBoundedText } from '@/lib/http-security-core'
import { markPrivateNoStore } from '@/lib/private-no-store'

const MAX_REVALIDATE_BODY_BYTES = 32 * 1024

export async function POST(request: Request) {
	const json = (body: unknown, init?: ResponseInit) =>
		markPrivateNoStore(Response.json(body, init))
	const secret = process.env.BRIEFING_REVALIDATE_SECRET?.trim()
	if (!secret)
		return json(
			{ success: false, error: 'Revalidation is not configured' },
			{ status: 503 }
		)

	const timestamp = request.headers.get('x-briefing-timestamp')?.trim() ?? ''
	const nonce = request.headers.get('x-briefing-nonce')?.trim() ?? ''
	const signature = request.headers.get('x-briefing-signature')?.trim() ?? ''
	let body: string
	try {
		body = await readBoundedText(request, MAX_REVALIDATE_BODY_BYTES)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return json(
				{ success: false, error: 'Payload too large' },
				{ status: 413 }
			)
		}
		return json(
			{ success: false, error: 'Invalid request body' },
			{ status: 400 }
		)
	}
	if (
		!verifyBriefingRevalidateEnvelope({
			secret,
			timestamp,
			nonce,
			signature,
			body
		})
	) {
		return json(
			{ success: false, error: 'Invalid revalidation envelope' },
			{ status: 401 }
		)
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(body)
	} catch {
		return json(
			{ success: false, error: 'Invalid revalidation JSON' },
			{ status: 400 }
		)
	}
	const event = parseBriefingRevalidateEvent(parsed)
	if (!event) {
		return json(
			{ success: false, error: 'Invalid revalidation event' },
			{ status: 400 }
		)
	}

	// Week V1 is no-store. Tag invalidation keeps the later bounded-cache
	// opt-in aligned with the publication contract.
	for (const tag of briefingRevalidateTags(event)) {
		revalidateTag(tag, 'max')
	}
	return json({ success: true, idempotencyKey: `${timestamp}:${nonce}` })
}
