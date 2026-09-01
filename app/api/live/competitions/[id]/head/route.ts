import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { GraphQLRequestError } from '@/lib/graphql-client'
import {
	GET_LEAGUE_LIVE_HEAD,
	type LeagueLiveHeadResponse
} from '@/lib/graphql/operations/tournaments'
import { getVerifiedEntryContext } from '@/lib/session'

export const dynamic = 'force-dynamic'

const headersFor = (requestId: string, etag?: string): Record<string, string> => ({
	'Cache-Control': 'private, max-age=1, must-revalidate',
	'X-Request-Id': requestId,
	...(etag ? { ETag: etag } : {})
})

const isPositiveInteger = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value > 0

export async function POST(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const requestId = randomUUID()
	const { entryId, session } = await getVerifiedEntryContext()
	if (!entryId)
		return NextResponse.json(
			{ error: 'UNAUTHENTICATED' },
			{ status: 401, headers: headersFor(requestId) }
		)
	const tournamentId = Number((await context.params).id)
	const body = (await request.json().catch(() => null)) as {
		eventId?: unknown
		mode?: unknown
	} | null
	const eventId = body?.eventId
	const mode = body?.mode
	if (
		!isPositiveInteger(tournamentId) ||
		!isPositiveInteger(eventId) ||
		eventId > 38 ||
		(mode !== 'CLASSIC' && mode !== 'H2H')
	)
		return NextResponse.json(
			{ error: 'BAD_USER_INPUT' },
			{ status: 400, headers: headersFor(requestId) }
		)
	try {
		const data = await executeServerQueryWithSession<LeagueLiveHeadResponse>(
			session,
			GET_LEAGUE_LIVE_HEAD,
			{ entryId, tournamentId, eventId, mode },
			{ cache: 'no-store', signal: request.signal, timeoutMs: 2_000, contract: 'live-points-v2' }
		)
		const head = data.leagueLiveHead
		const publication = head.publication?.revisions
		const etag = `"${head.mode}:${head.eventId}:${head.tournamentId}:${publication?.publicationId ?? head.availability}:${publication?.generation ?? 'none'}:${head.contentRevision ?? 'none'}"`
		if (request.headers.get('if-none-match') === etag)
			return new NextResponse(null, { status: 304, headers: headersFor(requestId, etag) })
		return NextResponse.json(data, { headers: headersFor(requestId, etag) })
	} catch (error) {
		const code = error instanceof GraphQLRequestError ? error.code : null
		const status =
			code === 'RATE_LIMITED' ||
			code === 'UPSTREAM_RATE_LIMITED' ||
			(error instanceof GraphQLRequestError && error.status === 429)
				? 429
				: code === 'UNAUTHENTICATED'
					? 401
					: code === 'FORBIDDEN'
						? 403
						: 502
		const responseHeaders = headersFor(requestId)
		if (status === 429 && error instanceof GraphQLRequestError)
			responseHeaders['Retry-After'] = String(Math.max(1, error.retryAfterSeconds ?? 30))
		return NextResponse.json(
			{
				error:
					status === 429
						? 'RATE_LIMITED'
						: status === 401
							? 'UNAUTHENTICATED'
							: status === 403
								? 'FORBIDDEN'
								: 'COMPETITION_UNAVAILABLE'
			},
			{ status, headers: responseHeaders }
		)
	}
}
