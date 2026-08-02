import { PageState } from '@/components/feedback/PageState'
import { Button } from '@/components/ui/button'
import {
	GET_ENTRY_TOURNAMENTS,
	type EntryTournamentsResponse,
} from '@/lib/graphql/operations/tournaments'
import { executeServerQuery } from '@/lib/graphql-server'
import { getCurrentEntryId, getCurrentSession } from '@/lib/session'
import { LockKeyhole } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ManageTournamentClient from './ManageTournamentClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
	title: 'Manage tournament',
	robots: { index: false, follow: false },
}

type PageProps = {
	params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
	const { id } = await params
	const nextPath = `/tournament/${encodeURIComponent(id)}/manage`
	const session = await getCurrentSession()
	if (!session) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`)

	const entryId = await getCurrentEntryId()
	if (!entryId) redirect(`/onboarding/bind-entry?next=${encodeURIComponent(nextPath)}`)

	const tournamentId = /^\d+$/.test(id) ? Number(id) : Number.NaN
	if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) {
		return <NoManagementAccess id={id} />
	}

	let response: EntryTournamentsResponse
	try {
		response = await executeServerQuery<EntryTournamentsResponse>(
			GET_ENTRY_TOURNAMENTS,
			{ entryId },
			{ cache: 'no-store' },
		)
	} catch (error) {
		console.error('[tournament management] Failed to load:', error)
		return (
			<PageState
				icon={LockKeyhole}
				title="Tournament management is temporarily unavailable"
				description="We could not verify your administrator access. Nothing has been changed; please try again."
				actions={
					<>
						<Button asChild><Link href={nextPath}>Try again</Link></Button>
						<Button variant="outline" asChild><Link href="/tournament/list">Back to tournaments</Link></Button>
					</>
				}
			/>
		)
	}

	const tournament = response.entryTournaments.find(item => item.id === tournamentId)
	if (!tournament || tournament.adminEntryId !== entryId) {
		return <NoManagementAccess id={id} />
	}

	return <ManageTournamentClient tournament={tournament} />
}

function NoManagementAccess({ id }: { id: string }) {
	return (
		<PageState
			icon={LockKeyhole}
			title="Administrator access required"
			description="This tournament is unavailable or your verified FPL entry is not its administrator."
			actions={
				<>
					<Button asChild>
						<Link href={`/live/tournament/${id}`}>View tournament</Link>
					</Button>
					<Button variant="outline" asChild>
						<Link href="/tournament/list">Back to tournaments</Link>
					</Button>
				</>
			}
		/>
	)
}
