import { Metadata } from 'next'
import { generateStaticParams } from './staticParams'
import TeamPointsClient from './TeamPointsClient'

export { generateStaticParams }

export async function generateMetadata({
	params
}: {
	params: Promise<{ id: string }>
}): Promise<Metadata> {
	const { id } = await params
	return {
		title: `Points - ${id}`
	}
}

type PageProps = {
	params: Promise<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params, searchParams }: PageProps) {
	const { id } = await params
	return <TeamPointsClient params={{ id }} />
}
