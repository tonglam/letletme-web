import { auth } from '@/lib/auth'
import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const GRAPHQL_ENDPOINT =
	process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql'

// Queries that carry user-specific entry data and therefore require a session.
const USER_CONTEXT_PATTERNS = [
	'entryHistory(',
	'entryTransferHistory(',
	'calcLivePointsByEntry(',
	'entryTournaments(',
	'tournamentLivePoints(',
	'tournamentEntryRankingSummary(',
]

function requiresUserContext(query: unknown): boolean {
	if (typeof query !== 'string') return false
	return USER_CONTEXT_PATTERNS.some(p => query.includes(p))
}

function isCacheableQuery(query: unknown): boolean {
	if (typeof query !== 'string') return false
	return (
		query.includes('eventOverallResult') ||
		query.includes('GetEventStatsById') ||
		query.includes('event(id:') ||
		query.includes('GetEntryHistory') ||
		query.includes('entryHistory(') ||
		query.includes('GetEntryTransferHistory') ||
		query.includes('entryTransferHistory(')
	)
}

export async function POST(request: NextRequest) {
	let session: Awaited<ReturnType<typeof auth.api.getSession>>
	try {
		session = await auth.api.getSession({ headers: request.headers })
	} catch {
		session = null
	}

	let body: unknown
	try {
		body = await request.json()
	} catch {
		return NextResponse.json({ errors: [{ message: 'Invalid JSON' }] }, { status: 400 })
	}

	if (requiresUserContext((body as Record<string, unknown>)?.query) && !session) {
		return NextResponse.json(
			{ errors: [{ message: 'Unauthenticated' }] },
			{ status: 401 },
		)
	}

	const forwardHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
	}

	if (session?.user && process.env.BACKEND_PROXY_SECRET) {
		const now = Math.floor(Date.now() / 1000)
		const envelope = {
			uid: session.user.id,
			eid: session.user.fplEntryId ?? null,
			iat: now,
			exp: now + 60,
		}
		const payload = JSON.stringify(envelope)
		const sig = createHmac('sha256', process.env.BACKEND_PROXY_SECRET)
			.update(payload)
			.digest('base64url')
		forwardHeaders['X-User-Context'] =
			Buffer.from(payload).toString('base64url')
		forwardHeaders['X-User-Context-Sig'] = sig
	}

	let response: Response
	try {
		response = await fetch(GRAPHQL_ENDPOINT, {
			method: 'POST',
			cache: 'no-store',
			headers: forwardHeaders,
			body: JSON.stringify(body),
		})
	} catch (err) {
		console.error('[graphql proxy] upstream fetch failed:', err)
		return NextResponse.json(
			{ errors: [{ message: 'Upstream unavailable' }] },
			{ status: 502 },
		)
	}

	let data: unknown
	try {
		data = await response.json()
	} catch {
		return NextResponse.json(
			{ errors: [{ message: `Upstream returned non-JSON (status ${response.status})` }] },
			{ status: 502 },
		)
	}
	const cacheable = isCacheableQuery((body as Record<string, unknown>)?.query)

	return NextResponse.json(data, {
		headers: {
			'Cache-Control': cacheable
				? 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600'
				: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
		},
	})
}
