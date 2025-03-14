import { Metadata } from 'next'
import { generateStaticParams } from './staticParams'
import TeamPointsClient from './TeamPointsClient'

export { generateStaticParams }

type Props = {
	params: { id: string }
	searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	return {
		title: `Points - ${params.id}`
	}
}

export default async function Page({ params, searchParams }: Props) {
	return <TeamPointsClient params={params} />
}
