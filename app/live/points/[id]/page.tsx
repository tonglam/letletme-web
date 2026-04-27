import { Metadata } from 'next'
import { Suspense } from 'react'
import TeamPointsClient from './TeamPointsClient'

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
	const { tournamentId } = await searchParams
	return (
		<Suspense
			fallback={
				<div className="container max-w-4xl mx-auto px-4 py-8">
					<div className="bg-card rounded-lg shadow-sm p-6 text-sm text-muted-foreground">
						Loading team points...
					</div>
				</div>
			}
		>
			<TeamPointsClient
				entryId={Number(id)}
				tournamentId={typeof tournamentId === 'string' ? tournamentId : undefined}
			/>
		</Suspense>
	)
}
