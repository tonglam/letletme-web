import { Metadata } from 'next'
import { generateStaticParams } from './staticParams'
import TeamPointsClient from './TeamPointsClient'

export { generateStaticParams }

type PageParams = { id: string }

export async function generateMetadata({
	params
}: {
	params: PageParams
}): Promise<Metadata> {
	return {
		title: `Points - ${params.id}`
	}
}

export default function Page({
	params,
	searchParams
}: {
	params: PageParams
	searchParams: { [key: string]: string | undefined }
}) {
	return <TeamPointsClient params={params} />
}
