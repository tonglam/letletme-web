import { NextResponse } from 'next/server'
import { executeServerQuery } from '@/lib/graphql-server'
import { GET_TOURNAMENT_ENTRY_SQUADS } from '@/lib/graphql/operations/tournaments'
import { getAuthorizationSession } from '@/lib/auth'
import { getCurrentSeasonKey } from '@/lib/season'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
	const session = await getAuthorizationSession(request.headers).catch(() => null)
	if (!session?.user.fplEntryId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
	const tournamentId = Number((await context.params).id); const params = new URL(request.url).searchParams
	const eventId = Number(params.get('eventId')); const revision = params.get('revision'); const entryIds = (params.get('entryIds') ?? '').split(',').map(Number).filter(Number.isSafeInteger)
	if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0 || !Number.isSafeInteger(eventId) || eventId <= 0 || !revision || entryIds.length < 1 || entryIds.length > 2) return NextResponse.json({ error: 'Invalid live comparison parameters' }, { status: 400 })
	try {
		const data = await executeServerQuery(GET_TOURNAMENT_ENTRY_SQUADS, { entryId: session.user.fplEntryId, tournamentId, comparedEntryIds: entryIds, ref: { season: String(getCurrentSeasonKey()), eventId, revision } }, { cache: 'no-store' })
		return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
	} catch { return NextResponse.json({ error: 'Comparison unavailable' }, { status: 502 }) }
}
