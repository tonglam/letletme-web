import { getAuth } from '@/lib/auth'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import TournamentClient from './TournamentClient'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: Promise<Record<string, never>>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ searchParams }: PageProps) {
	void searchParams
	let entryId = 0
	try {
		const session = await getAuth().api.getSession({ headers: await headers() })
		entryId = session?.user?.fplEntryId ?? 0
	} catch {
		// unauthenticated — show empty state in client
	}

	return (
		<Suspense fallback={<div>Loading...</div>}>
			<TournamentClient entryId={entryId} />
		</Suspense>
	)
}
