import { auth } from '@/lib/auth'
import { tournamentApiFetch } from '@/lib/tournament/backend-client'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session) {
		return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
	}

	try {
		const body = await request.json()
		const response = await tournamentApiFetch(
			'/tournaments',
			{
				method: 'POST',
				body: JSON.stringify(body),
				headers: {
					'X-User-Id': session.user.id,
					...(session.user.fplEntryId
						? { 'X-Fpl-Entry-Id': String(session.user.fplEntryId) }
						: {}),
				},
			},
			request,
		)

		const payload = await response.json()
		return NextResponse.json(payload, { status: response.status })
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Failed to create tournament.'
		return NextResponse.json({ success: false, error: message }, { status: 500 })
	}
}
