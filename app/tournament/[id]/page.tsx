import { generateStaticParams } from './staticParams'
import TournamentDetailClient from './TournamentDetailClient'

export { generateStaticParams }

type PageProps = {
	params: Promise<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params }: PageProps) {
	const { id } = await params
	return <TournamentDetailClient params={{ id }} />
}
