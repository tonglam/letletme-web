import { Metadata } from 'next'
import { generateStaticParams } from './staticParams'
import TeamPointsClient from './TeamPointsClient'

export { generateStaticParams }

interface PageProps {
	params: { id: string }
	searchParams: { [key: string]: string | undefined }
}

export async function generateMetadata({
	params
}: PageProps): Promise<Metadata> {
	return {
		title: `Points - ${params.id}`
	}
}

export default async function Page({ params, searchParams }: PageProps) {
	return <TeamPointsClient params={params} />
}
