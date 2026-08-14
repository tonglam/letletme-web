import { NextResponse } from 'next/server'

import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { getVerifiedEntryContext } from '@/lib/session'
import {
	GET_TOURNAMENT_DETAIL_DESK,
	type TournamentDetailDeskResponse
} from '@/lib/graphql/operations/tournaments'

export const dynamic = 'force-dynamic'

function uniqueParam(
	params: URLSearchParams,
	key: string
): string | null | undefined {
	const values = params.getAll(key)
	if (values.length > 1) return undefined
	return values[0] ?? null
}

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const url = new URL(request.url)
	const eventValue = uniqueParam(url.searchParams, 'eventId')
	const revision = uniqueParam(url.searchParams, 'revision')
	if (
		eventValue === undefined ||
		revision === undefined ||
		(eventValue !== null && !/^(?:[1-9]|[12]\d|3[0-8])$/.test(eventValue))
	) {
		return NextResponse.json(
			{ error: 'Invalid desk parameters.' },
			{
				status: 400,
				headers: { 'Cache-Control': 'private, no-store, no-transform' }
			}
		)
	}
	const { id } = await context.params
	if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
		return NextResponse.json(
			{ error: 'Invalid tournament id.' },
			{ status: 400 }
		)
	}
	const { entryId, session } = await getVerifiedEntryContext()
	if (!entryId)
		return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
	try {
		const data =
			await executeServerQueryWithSession<TournamentDetailDeskResponse>(
				session,
				GET_TOURNAMENT_DETAIL_DESK,
				{
					tournamentId: Number(id),
					entryId,
					eventId: eventValue ? Number(eventValue) : null
				},
				{ cache: 'no-store', signal: request.signal }
			)
		const desk = data.tournamentDetailDesk
		if (!desk)
			return NextResponse.json(
				{ error: 'Forbidden.' },
				{
					status: 403,
					headers: { 'Cache-Control': 'private, no-store, no-transform' }
				}
			)
		if (revision !== null && revision !== desk.revision) {
			return NextResponse.json(
				{ error: 'Revision mismatch.', revision: desk.revision },
				{
					status: 409,
					headers: { 'Cache-Control': 'private, no-store, no-transform' }
				}
			)
		}
		return NextResponse.json(desk, {
			headers: { 'Cache-Control': 'private, no-store, no-transform' }
		})
	} catch (error) {
		console.error(
			'[tournament desk] failed:',
			error instanceof Error ? error.name : 'UnknownError'
		)
		return NextResponse.json(
			{ error: 'Tournament desk unavailable.' },
			{
				status: 502,
				headers: { 'Cache-Control': 'private, no-store, no-transform' }
			}
		)
	}
}
