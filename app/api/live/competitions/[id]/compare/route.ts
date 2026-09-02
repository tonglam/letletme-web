import { NextResponse } from 'next/server'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { GraphQLRequestError } from '@/lib/graphql-client'
import { GET_TOURNAMENT_ENTRY_SQUADS } from '@/lib/graphql/operations/tournaments'
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
	const scoreCoreRevision = params.get('scoreCoreRevision')
	const entryIds = (params.get('entryIds') ?? '')
		.split(',')
		.map(Number)
		.filter(entryId => Number.isSafeInteger(entryId) && entryId > 0)
	if (
		!Number.isSafeInteger(tournamentId) ||
		tournamentId <= 0 ||
		!Number.isSafeInteger(eventId) ||
		eventId <= 0 ||
		!scoreCoreRevision ||
		entryIds.length < 1 ||
		entryIds.length > 2 ||
		new Set(entryIds).size !== entryIds.length
	)
		return NextResponse.json(
			{ error: 'Invalid live comparison parameters' },
			{ status: 400 }
		)
	try {
		const data = await executeServerQueryWithSession(
			session,
			GET_TOURNAMENT_ENTRY_SQUADS,
			{
				entryId,
				tournamentId,
				comparedEntryIds: entryIds,
				ref: {
					season: String(getCurrentSeasonKey()),
					eventId,
					scoreCoreRevision
				}
			},
			{ cache: 'no-store', signal: request.signal, contract: 'live-points-v2' }
		)
		return NextResponse.json(data, {
			headers: { 'Cache-Control': 'private, no-store' }
		})
	} catch (error) {
		const code = error instanceof GraphQLRequestError ? error.code : null
		const status =
			code === 'CLIENT_UPGRADE_REQUIRED'
				? 426
				: code === 'LIVE_SCORE_REVISION_GONE'
				? 409
				: code === 'UNAUTHENTICATED'
					? 401
					: code === 'FORBIDDEN'
						? 403
						: 502
		return NextResponse.json(
			{
				error:
					status === 426
						? 'CLIENT_UPGRADE_REQUIRED'
						: status === 409
						? code
						: status === 401
							? 'UNAUTHENTICATED'
							: status === 403
								? 'FORBIDDEN'
								: 'Comparison unavailable'
			},
			{ status, headers: { 'Cache-Control': 'private, no-store' } }
		)
	}
}
