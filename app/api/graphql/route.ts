import { type Session, getAuth } from '@/lib/auth'
import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const GRAPHQL_ENDPOINT =
	process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql'

type QueryPolicy = {
	pattern: string
	requiresAuth: boolean
	cacheable: boolean
}

/**
 * Single source of truth for GraphQL proxy behavior.
 * A query must never be both requiresAuth and cacheable — public CDN caches
 * cannot safely store session-scoped responses.
 */
const QUERY_POLICIES: QueryPolicy[] = [
	// Session-gated (never cacheable)
	{ pattern: 'entryHistory(', requiresAuth: true, cacheable: false },
	{ pattern: 'entryTransferHistory(', requiresAuth: true, cacheable: false },
	{ pattern: 'entryTournaments(', requiresAuth: true, cacheable: false },
	{ pattern: 'calcLivePointsForTournament(', requiresAuth: true, cacheable: false },
	{ pattern: 'tournamentEntryRankingSummary(', requiresAuth: true, cacheable: false },
	{ pattern: 'GetEntryHistory', requiresAuth: true, cacheable: false },
	{ pattern: 'GetEntryTransferHistory', requiresAuth: true, cacheable: false },

	// Public and safe to cache briefly
	{ pattern: 'eventOverallResult', requiresAuth: false, cacheable: true },
	{ pattern: 'GetEventStatsById', requiresAuth: false, cacheable: true },
	{ pattern: 'event(id:', requiresAuth: false, cacheable: true },
	{ pattern: 'GetCurrentAndNextEvents', requiresAuth: false, cacheable: true },
	{ pattern: 'GetEventFixtures', requiresAuth: false, cacheable: true },
	{ pattern: 'GetPlayerValues', requiresAuth: false, cacheable: true },
]

function resolveQueryPolicy(query: unknown): { requiresAuth: boolean; cacheable: boolean } {
	if (typeof query !== 'string') {
		return { requiresAuth: false, cacheable: false }
	}

	let requiresAuth = false
	let cacheable = false

	for (const policy of QUERY_POLICIES) {
		if (!query.includes(policy.pattern)) continue
		if (policy.requiresAuth) requiresAuth = true
		if (policy.cacheable) cacheable = true
	}

	// Auth-gated responses must never be publicly cached.
	if (requiresAuth) cacheable = false

	return { requiresAuth, cacheable }
}

export async function POST(request: NextRequest) {
	let session: Session | null
	try {
		session = await getAuth().api.getSession({ headers: request.headers })
	} catch {
		session = null
	}

	let body: unknown
	try {
		body = await request.json()
	} catch {
		return NextResponse.json({ errors: [{ message: 'Invalid JSON' }] }, { status: 400 })
	}

	const query = (body as Record<string, unknown>)?.query
	const { requiresAuth, cacheable } = resolveQueryPolicy(query)

	if (requiresAuth && !session) {
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

	return NextResponse.json(data, {
		headers: {
			'Cache-Control': cacheable
				? 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600'
				: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
		},
	})
}
