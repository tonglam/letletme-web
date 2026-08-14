import { NextResponse } from 'next/server'

import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { getVerifiedEntryContext } from '@/lib/session'
import {
	GET_MANAGED_TOURNAMENT_STATUS,
	type ManagedTournamentStatusResponse
} from '@/lib/graphql/operations/tournaments'

export const dynamic = 'force-dynamic'

function single(query: URLSearchParams, key: string): string | null {
	const values = query.getAll(key)
	return values.length === 1 ? values[0] : null
}

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const query = new URL(request.url).searchParams
	const revision = single(query, 'revision')
	if (
		query.getAll('revision').length > 1 ||
		(revision !== null && revision.trim() !== revision)
	) {
		return NextResponse.json(
			{ error: 'Invalid revision.' },
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
			await executeServerQueryWithSession<ManagedTournamentStatusResponse>(
				session,
				GET_MANAGED_TOURNAMENT_STATUS,
				{
					tournamentId: Number(id),
					entryId
				},
				{ cache: 'no-store' }
			)
		const status = data.managedTournamentStatus
		if (!status)
			return NextResponse.json(
				{ error: 'Forbidden.' },
				{
					status: 403,
					headers: { 'Cache-Control': 'private, no-store, no-transform' }
				}
			)
		if (revision !== null && revision !== status.revision) {
			return NextResponse.json(
				{ error: 'Revision mismatch.', revision: status.revision },
				{
					status: 409,
					headers: { 'Cache-Control': 'private, no-store, no-transform' }
				}
			)
		}
		return NextResponse.json(status, {
			headers: { 'Cache-Control': 'private, no-store, no-transform' }
		})
	} catch (error) {
		console.error(
			'[tournament status] failed:',
			error instanceof Error ? error.name : 'UnknownError'
		)
		return NextResponse.json(
			{ error: 'Tournament status unavailable.' },
			{
				status: 502,
				headers: { 'Cache-Control': 'private, no-store, no-transform' }
			}
		)
	}
}
