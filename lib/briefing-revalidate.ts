import { createHmac, timingSafeEqual } from 'node:crypto'

export const MAX_BRIEFING_REVALIDATE_SKEW_MS = 5 * 60 * 1000

const BRIEFING_SCOPES = new Set(['week', 'story'])

export type BriefingRevalidateScope = 'week' | 'story'

export type BriefingRevalidateEvent = {
	scopeKey: BriefingRevalidateScope
	publicationId: string
	revision: number
	storyId: string | null
	canonicalSlug: string | null
	aliasSlugs: string[]
}

export function briefingPublishIdempotencyKey(
	editionId: string,
	revision: number
): string {
	return `web:briefing:publish:${editionId}:${revision}`
}

function safeEqual(left: string, right: string): boolean {
	const leftBytes = Buffer.from(left, 'utf8')
	const rightBytes = Buffer.from(right, 'utf8')
	return (
		leftBytes.length === rightBytes.length &&
		timingSafeEqual(leftBytes, rightBytes)
	)
}

function readString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value.flatMap(item => {
		const text = readString(item)
		return text ? [text] : []
	})
}

export function parseBriefingRevalidateEvent(
	event: unknown
): BriefingRevalidateEvent | null {
	if (event === null || typeof event !== 'object') return null
	const record = event as Record<string, unknown>
	const scopeKey = record.scopeKey
	if (typeof scopeKey !== 'string' || !BRIEFING_SCOPES.has(scopeKey))
		return null
	const publicationId = readString(record.publicationId)
	if (!publicationId) return null
	if (!Number.isSafeInteger(record.revision)) return null
	return {
		scopeKey: scopeKey as BriefingRevalidateScope,
		publicationId,
		revision: record.revision as number,
		storyId: readString(record.storyId),
		canonicalSlug: readString(record.canonicalSlug),
		aliasSlugs: readStringList(record.aliasSlugs),
	}
}

export function briefingRevalidateTags(
	event: BriefingRevalidateEvent
): string[] {
	const tags = new Set<string>(['briefing:week'])
	if (event.storyId) tags.add(`briefing:story:${event.storyId}`)
	if (event.canonicalSlug)
		tags.add(`briefing:story-slug:${event.canonicalSlug}`)
	for (const slug of event.aliasSlugs)
		tags.add(`briefing:story-slug:${slug}`)
	return Array.from(tags)
}

export function verifyBriefingRevalidateEnvelope(input: {
	secret: string
	timestamp: string
	nonce: string
	signature: string
	body: string
	nowMs?: number
}): boolean {
	const { secret, timestamp, nonce, signature, body } = input
	const nowMs = input.nowMs ?? Date.now()
	if (!/^\d{10,13}$/.test(timestamp) || nonce.length < 16 || nonce.length > 128 || !/^[a-f0-9-]+$/i.test(nonce)) {
		return false
	}
	const timestampMs = Number(timestamp)
	if (!Number.isFinite(timestampMs)) return false
	const eventMs = timestamp.length <= 10 ? timestampMs * 1000 : timestampMs
	if (Math.abs(nowMs - eventMs) > MAX_BRIEFING_REVALIDATE_SKEW_MS) return false
	const expected = createHmac('sha256', secret)
		.update(`${timestamp}.${nonce}.${body}`, 'utf8')
		.digest('hex')
	return safeEqual(signature, expected)
}
