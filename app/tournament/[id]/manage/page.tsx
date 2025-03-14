import { generateStaticParams } from '../staticParams'
import { ManageTournamentClient } from './client'

export { generateStaticParams }

type PageProps = {
	params: Promise<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params }: PageProps) {
	const { id } = await params
	return <ManageTournamentClient params={{ id }} />
}
