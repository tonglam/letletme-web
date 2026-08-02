import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { getCurrentAndNextEvents } from '@/lib/events'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_LIVE_POINTS,
	type LiveCalcData,
	type LiveCalcDataResponse,
} from '@/lib/graphql/operations/live'
import TeamPointsClient from './TeamPointsClient'
import { CalendarX2 } from 'lucide-react'

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

	if (!currentEventId) {
		return (
			<PageShell>
				<PageState
					icon={CalendarX2}
					title="Live gameweek data is unavailable"
					description="The current FPL gameweek could not be confirmed. No fallback gameweek has been assumed."
				/>
			</PageShell>
		)
	}

	if (Number.isInteger(entryId) && entryId > 0) {
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
