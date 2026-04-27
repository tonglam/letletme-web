import { getAuth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import TournamentDetailClient from './TournamentDetailClient'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: Promise<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params }: PageProps) {
	const { id } = await params
	const session = await getAuth().api.getSession({ headers: await headers() })

	if (!session) {
		redirect(`/auth/login?next=/live/tournament/${id}`)
	}

	const entryId = session.user.fplEntryId ?? 0

	return <TournamentDetailClient params={{ id }} entryId={entryId} />
}
