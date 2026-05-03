import { getAuth } from '@/lib/auth'
import { headers } from 'next/headers'
import TournamentDetailClient from './TournamentDetailClient'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: Promise<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params }: PageProps) {
	const { id } = await params
	let entryId = 0
	try {
		const session = await getAuth().api.getSession({ headers: await headers() })
		entryId = session?.user?.fplEntryId ?? 0
	} catch {
		// unauthenticated — show empty state in client
	}

	return <TournamentDetailClient params={{ id }} entryId={entryId} />
}
