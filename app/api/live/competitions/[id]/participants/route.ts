import { NextResponse } from 'next/server'
import { executeServerQuery } from '@/lib/graphql-server'
import { GET_TOURNAMENT_LIVE_PARTICIPANTS } from '@/lib/graphql/operations/tournaments'
import { getAuthorizationSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
	const session = await getAuthorizationSession(request.headers).catch(() => null)
	if (!session?.user.fplEntryId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
	const tournamentId = Number((await context.params).id)
	if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) return NextResponse.json({ error: 'Invalid tournament id' }, { status: 400 })
	try {
		const data = await executeServerQuery(GET_TOURNAMENT_LIVE_PARTICIPANTS, { entryId: session.user.fplEntryId, tournamentId }, { cache: 'no-store' })
		return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
	} catch { return NextResponse.json({ error: 'Participants unavailable' }, { status: 502 }) }
}
