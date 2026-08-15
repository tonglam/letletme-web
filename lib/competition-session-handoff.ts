import { createHmac, timingSafeEqual } from 'crypto'

import type { Session } from '@/lib/auth'

const HEADER = 'x-competition-session-handoff'
const VERSION = 1
const MAX_AGE_SECONDS = 30

type HandoffPayload = {
	v: number
	aud: 'competition'
	uid: string
	eid: number | null
	evat: string | null
	name: string
	iat: number
	exp: number
	path: string
	cookieHash: string
}

function secret(): string | null {
	const value = process.env.BACKEND_PROXY_SECRET?.trim() ?? ''
	if (!value && process.env.NODE_ENV === 'production') {
		throw new Error('BACKEND_PROXY_SECRET is required in production')
	}
	return value || null
}

function sign(value: string, key: string): string {
	return createHmac('sha256', key).update(value).digest('base64url')
}

export function sessionCookieHash(cookieHeader: string | null, key = secret()): string {
	return sign(cookieHeader ?? '', key ?? 'development-only')
}

export function createCompetitionSessionHandoff(
	session: Session,
	path: string,
	cookieHeader: string | null,
	nowSeconds = Math.floor(Date.now() / 1000)
): string | null {
	const key = secret()
	if (!key) return null
	const user = session.user
	const verifiedAt = user.fplEntryVerifiedAt
		? new Date(user.fplEntryVerifiedAt).toISOString()
		: null
	const entryId =
		verifiedAt && typeof user.fplEntryId === 'number' && user.fplEntryId > 0
			? user.fplEntryId
			: null
	const payload: HandoffPayload = {
		v: VERSION,
		aud: 'competition',
		uid: user.id,
		eid: entryId,
		evat: verifiedAt,
		name: typeof user.name === 'string' ? user.name.slice(0, 120) : '',
		iat: nowSeconds,
		exp: nowSeconds + MAX_AGE_SECONDS,
		path,
		cookieHash: sessionCookieHash(cookieHeader, key)
	}
	const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
	return `${encoded}.${sign(encoded, key)}`
}

export function readCompetitionSessionHandoff(
	headerValue: string | null,
	path: string,
	cookieHeader: string | null,
	nowSeconds = Math.floor(Date.now() / 1000)
): HandoffPayload | null {
	const key = secret()
	if (!key || !headerValue) return null
	const [encoded, providedSignature] = headerValue.split('.')
	if (!encoded || !providedSignature) return null
	const expectedSignature = sign(encoded, key)
	const expected = Buffer.from(expectedSignature)
	const actual = Buffer.from(providedSignature)
	if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
	try {
		const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as HandoffPayload
		if (
			payload.v !== VERSION ||
			payload.aud !== 'competition' ||
			!payload.uid ||
			payload.exp < nowSeconds ||
			payload.iat > nowSeconds + 5 ||
			payload.path !== path ||
			payload.cookieHash !== sessionCookieHash(cookieHeader, key)
		) return null
		return payload
	} catch {
		return null
	}
}

export const COMPETITION_SESSION_HANDOFF_HEADER = HEADER
export const COMPETITION_SESSION_PATH_HEADER = 'x-competition-path'
