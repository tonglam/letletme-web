import { NextResponse } from 'next/server'
import { GraphQLRequestError } from '@/lib/graphql-client'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { GET_TOURNAMENT_LIVE_PARTICIPANTS } from '@/lib/graphql/operations/tournaments'
import { getVerifiedEntryContext } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	let entryId: number | null
	let session: Awaited<ReturnType<typeof getVerifiedEntryContext>>['session']
	try {
		const context = await getVerifiedEntryContext()
		entryId = context.entryId
		session = context.session
	} catch {
		return NextResponse.json(
			{ error: 'DEPENDENCY_UNAVAILABLE' },
			{
				status: 503,
				headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '30' }
			}
		)
	}
	if (!entryId)
		return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
	const tournamentId = Number((await context.params).id)
	if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0)
		return NextResponse.json(
			{ error: 'Invalid tournament id' },
			{ status: 400 }
		)
	try {
		const data = await executeServerQueryWithSession(
			session,
			GET_TOURNAMENT_LIVE_PARTICIPANTS,
			{ entryId, tournamentId },
			{ cache: 'no-store', signal: request.signal }
		)
		return NextResponse.json(data, {
			headers: { 'Cache-Control': 'private, no-store' }
		})
	} catch (error) {
		if (error instanceof GraphQLRequestError && error.code === 'REQUEST_TIMEOUT') {
			return NextResponse.json(
				{ error: 'Participants request timed out' },
				{ status: 504, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } }
			)
		}
		if (error instanceof GraphQLRequestError && error.code === 'REQUEST_CANCELLED') {
			return NextResponse.json(
				{ error: 'Participants request was cancelled' },
				{ status: 499, headers: { 'Cache-Control': 'no-store' } }
			)
		}
		const dependency =
			error instanceof GraphQLRequestError &&
			(error.code === 'DEPENDENCY_UNAVAILABLE' || error.status === 503)
		const headers: Record<string, string> = { 'Cache-Control': 'no-store' }
		if (dependency && error instanceof GraphQLRequestError)
			headers['Retry-After'] = String(Math.max(1, error.retryAfterSeconds ?? 30))
		return NextResponse.json(
			{ error: dependency ? 'DEPENDENCY_UNAVAILABLE' : 'Participants unavailable' },
			{ status: dependency ? 503 : 502, headers }
		)
	}
}
