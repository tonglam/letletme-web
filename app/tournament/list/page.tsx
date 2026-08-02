import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_ENTRY_TOURNAMENTS,
	type EntryTournament,
	type EntryTournamentsResponse,
} from '@/lib/graphql/operations/tournaments'
import { getCurrentEntryId, getCurrentSession } from '@/lib/session'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import TournamentListClient from './TournamentListClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
	title: 'Tournaments',
	description: 'Browse and filter the FPL tournaments linked to your entry.',
}

export default async function Page() {
	const session = await getCurrentSession()

	if (!session) {
		redirect('/auth/login?next=/tournament/list')
	}

	const entryId = await getCurrentEntryId()
	if (!entryId) {
		redirect('/onboarding/bind-entry')
	}

	let initialTournaments: EntryTournament[] = []
	let initialError: string | null = null
	try {
		const response = await executeServerQuery<EntryTournamentsResponse>(
			GET_ENTRY_TOURNAMENTS,
			{ entryId },
			{ cache: 'no-store' },
		)
		initialTournaments = response.entryTournaments
	} catch (error) {
		console.error('[tournament list] Failed to load:', error)
		initialError = 'Tournaments are temporarily unavailable.'
	}

	return (
		<TournamentListClient
			currentEntryId={entryId}
			initialTournaments={initialTournaments}
			initialError={initialError}
		/>
	)
}
