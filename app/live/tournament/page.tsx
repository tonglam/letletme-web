import { tournaments } from '@/lib/tournament-data'
import TournamentClient from './TournamentClient'

type PageProps = {
	params: Promise<{}>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ searchParams }: PageProps) {
	return <TournamentClient tournaments={tournaments} />
}
