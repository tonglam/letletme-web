import { NextResponse } from 'next/server'
import { GraphQLRequestError } from '@/lib/graphql-client'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { GET_TOURNAMENT_SELECTION_INDEX } from '@/lib/graphql/operations/tournaments'
import { getVerifiedEntryContext } from '@/lib/session'
import { getCurrentSeasonKey } from '@/lib/season'

export const dynamic = 'force-dynamic'

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const { entryId, session } = await getVerifiedEntryContext()
	if (!entryId)
		return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
	const tournamentId = Number((await context.params).id)
	const params = new URL(request.url).searchParams
	const eventId = Number(params.get('eventId'))
	const revision = params.get('revision')
	if (
		!Number.isSafeInteger(tournamentId) ||
		tournamentId <= 0 ||
		!Number.isSafeInteger(eventId) ||
		eventId <= 0 ||
		!revision
	)
		return NextResponse.json(
			{ error: 'Invalid live competition parameters' },
			{ status: 400 }
		)
	try {
		const data = await executeServerQueryWithSession(
			session,
			GET_TOURNAMENT_SELECTION_INDEX,
			{
				entryId,
				tournamentId,
				ref: { season: String(getCurrentSeasonKey()), eventId, revision }
			},
			{ cache: 'no-store', signal: request.signal }
		)
		return NextResponse.json(data, {
			headers: { 'Cache-Control': 'private, no-store' }
		})
	} catch (error) {
		const code = error instanceof GraphQLRequestError ? error.code : null
		const status =
			code === 'LIVE_BOARD_REVISION_GONE' || code === 'LIVE_REVISION_GONE'
				? 409
				: code === 'UNAUTHENTICATED'
					? 401
					: code === 'FORBIDDEN'
						? 403
						: 502
		return NextResponse.json(
			{
				error:
					status === 409
						? code
						: status === 401
							? 'UNAUTHENTICATED'
							: status === 403
								? 'FORBIDDEN'
								: 'Selection index unavailable'
			},
			{ status, headers: { 'Cache-Control': 'private, no-store' } }
		)
	}
}
