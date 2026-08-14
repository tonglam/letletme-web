import { NextResponse } from 'next/server'
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
	} catch {
		return NextResponse.json(
			{ error: 'Selection index unavailable' },
			{ status: 502 }
		)
	}
}
