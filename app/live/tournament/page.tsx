import { getAuth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import TournamentClient from './TournamentClient'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: Promise<Record<string, never>>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ searchParams }: PageProps) {
	const session = await getAuth().api.getSession({ headers: await headers() })

	if (!session) {
		redirect('/auth/login?next=/live/tournament')
	}

	const entryId = session.user.fplEntryId ?? 0

	return (
		<Suspense fallback={<div>Loading...</div>}>
			<TournamentClient entryId={entryId} />
		</Suspense>
	)
}
