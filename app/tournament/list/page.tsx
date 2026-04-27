import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import TournamentListClient from './TournamentListClient'

export default async function Page() {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session) {
		redirect('/auth/login?next=/tournament/list')
	}

	const entryId = session.user.fplEntryId ?? 0

	return (
		<Suspense fallback={<div>Loading...</div>}>
			<TournamentListClient entryId={entryId} />
		</Suspense>
	)
}
