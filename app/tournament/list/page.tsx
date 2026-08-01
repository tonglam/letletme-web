import { getCurrentEntryId, getCurrentSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import TournamentListClient from './TournamentListClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
	const session = await getCurrentSession()

	if (!session) {
		redirect('/auth/login?next=/tournament/list')
	}

	const entryId = await getCurrentEntryId()
	if (!entryId) {
		redirect('/onboarding/bind-entry')
	}

	return (
		<Suspense fallback={<div>Loading...</div>}>
			<TournamentListClient entryId={entryId} />
		</Suspense>
	)
}
