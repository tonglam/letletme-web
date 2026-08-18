import { createHmac, timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

function safeEqual(left: string, right: string): boolean {
	const leftBytes = Buffer.from(left, 'utf8')
	const rightBytes = Buffer.from(right, 'utf8')
	return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

export async function POST(request: Request) {
	const secret = process.env.BRIEFING_REVALIDATE_SECRET?.trim()
	if (!secret) return Response.json({ success: false, error: 'Revalidation is not configured' }, { status: 503 })

	const timestamp = request.headers.get('x-briefing-timestamp')?.trim() ?? ''
	const nonce = request.headers.get('x-briefing-nonce')?.trim() ?? ''
	const signature = request.headers.get('x-briefing-signature')?.trim() ?? ''
	const timestampMs = Number(timestamp)
	if (!/^\d{10,13}$/.test(timestamp) || !Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS || nonce.length < 16 || nonce.length > 128 || !/^[a-f0-9-]+$/i.test(nonce)) {
		return Response.json({ success: false, error: 'Invalid revalidation envelope' }, { status: 401 })
	}

	const body = await request.text()
	const expected = createHmac('sha256', secret).update(`${timestamp}.${nonce}.${body}`, 'utf8').digest('hex')
	if (!safeEqual(signature, expected)) {
		return Response.json({ success: false, error: 'Invalid revalidation signature' }, { status: 401 })
	}

	let event: unknown
	try {
		event = JSON.parse(body)
	} catch {
		return Response.json({ success: false, error: 'Invalid revalidation JSON' }, { status: 400 })
	}
	if (
		event === null ||
		typeof event !== 'object' ||
		(event as Record<string, unknown>).scopeKey !== 'week' ||
		typeof (event as Record<string, unknown>).publicationId !== 'string' ||
		!Number.isSafeInteger((event as Record<string, unknown>).revision)
	) {
		return Response.json({ success: false, error: 'Invalid revalidation event' }, { status: 400 })
	}

	// Week V1 is no-store. Keeping this endpoint tag-scoped makes the later
	// bounded cache opt-in safe without changing the publication contract.
	revalidateTag('briefing:week', 'max')
	return Response.json({ success: true, idempotencyKey: `${timestamp}:${nonce}` })
}
