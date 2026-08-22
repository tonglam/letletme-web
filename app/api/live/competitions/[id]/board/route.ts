import { NextResponse } from 'next/server'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { GET_TOURNAMENT_LIVE_DESK } from '@/lib/graphql/operations/tournaments'
import { getVerifiedEntryContext } from '@/lib/session'
import { getCurrentSeasonKey } from '@/lib/season'
import { loadTournamentLiveDeskWithRevisionRecovery } from '@/lib/tournament/liveDesk'

export const dynamic = 'force-dynamic'

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const { entryId, session } = await getVerifiedEntryContext()
	if (!entryId)
		return NextResponse.json(
			{ error: 'Unauthenticated' },
			{ status: 401, headers: { 'Cache-Control': 'private, no-store' } }
		)
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
		const data = await loadTournamentLiveDeskWithRevisionRecovery(
			ref =>
				executeServerQueryWithSession(
					session,
					GET_TOURNAMENT_LIVE_DESK,
					{ entryId, selectedTournamentId: tournamentId, ref },
					{ cache: 'no-store', signal: request.signal }
				),
			{ season: String(getCurrentSeasonKey()), eventId, revision }
		)
		return NextResponse.json(data, {
			headers: { 'Cache-Control': 'private, no-store' }
		})
	} catch (error) {
		const status = String(error).includes('LIVE_REVISION_GONE') ? 409 : 502
		return NextResponse.json(
			{
				error: status === 409 ? 'LIVE_REVISION_GONE' : 'Competition unavailable'
			},
			{ status, headers: { 'Cache-Control': 'private, no-store' } }
		)
	}
}
