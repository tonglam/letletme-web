import { Metadata } from 'next'
import { Suspense } from 'react'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_LIVE_POINTS,
	type LiveCalcData,
	type LiveCalcDataResponse
} from '@/lib/graphql/queries'
import TeamPointsClient from './TeamPointsClient'

export const dynamic = 'force-dynamic'

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
	const entryId = Number(id)
	const events = await getCurrentAndNextEvents()
	const currentEventId = events?.current[0]?.id
	let initialLiveData: LiveCalcData | undefined

	if (Number.isInteger(entryId) && entryId > 0 && currentEventId !== undefined) {
		try {
			const liveResponse = await executeServerQuery<LiveCalcDataResponse>(
				GET_LIVE_POINTS,
				{ eventId: currentEventId, entryId },
				{ cache: 'no-store' }
			)
			initialLiveData = liveResponse.calcLivePointsByEntry
		} catch (err) {
			console.error('Failed to seed live points page:', err)
		}
	}

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
				entryId={entryId}
				tournamentId={typeof tournamentId === 'string' ? tournamentId : undefined}
				initialEventId={currentEventId}
				initialLiveData={initialLiveData}
			/>
		</Suspense>
	)
}
