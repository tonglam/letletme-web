import { tournaments } from '@/lib/tournament-data'
import { Suspense } from 'react'
import TournamentClient from './TournamentClient'

type PageProps = {
	params: Promise<{}>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ searchParams }: PageProps) {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<TournamentClient tournaments={tournaments} />
		</Suspense>
	)
}
