'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import { Card } from '@/components/ui/card'
import type { LiveCalcData } from '@/lib/graphql/operations/live'
import { EntrySearchForm } from './_components/EntrySearchForm'
import { LivePointsDashboard } from './_components/LivePointsDashboard'
import { LivePointsLoading } from './_components/LivePointsLoading'
import { useLivePoints } from './_hooks/useLivePoints'

interface LivePointsClientProps {
	initialEntryId: number
	initialEventId: number
	initialLiveData?: LiveCalcData
}

export default function LivePointsClient({
	initialEntryId,
	initialEventId,
	initialLiveData,
}: LivePointsClientProps) {
	const livePoints = useLivePoints({ initialEntryId, initialEventId, initialLiveData })
	const entrySearch = (
		<EntrySearchForm
			value={livePoints.entryIdInput}
			onChange={livePoints.setEntryIdInput}
			onSubmit={livePoints.submitEntry}
		/>
	)

	let content
	if (!livePoints.activeEntryId && !livePoints.isLoading) {
		content = (
			<Card className="p-6 sm:p-8">
				<p className="mb-4 text-muted-foreground">Enter an FPL entry ID to view live points.</p>
				{entrySearch}
				{livePoints.error ? <p className="mt-3 text-sm text-destructive" role="alert">{livePoints.error}</p> : null}
			</Card>
		)
	} else if (livePoints.isLoading && !livePoints.liveData) {
		content = (
			<LivePointsLoading
				entrySearch={entrySearch}
				activeEntryId={livePoints.activeEntryId}
				currentGameweek={livePoints.currentGameweek}
				selectedGameweek={livePoints.selectedGameweek}
			/>
		)
	} else if (!livePoints.liveData) {
		content = (
			<>
				<Card className="mb-6 p-4">{entrySearch}</Card>
				<GameweekSelector
					onGameweekChange={livePoints.changeGameweek}
					currentGameweek={livePoints.currentGameweek}
					selectedGameweek={livePoints.selectedGameweek}
				/>
				<p className="mt-6 text-center text-sm text-destructive" role="alert">
					{livePoints.error ?? 'No live data available for this team.'}
				</p>
			</>
		)
	} else {
		content = (
			<LivePointsDashboard
				entrySearch={entrySearch}
				currentGameweek={livePoints.currentGameweek}
				selectedGameweek={livePoints.selectedGameweek}
				isLoading={livePoints.isLoading}
				isRefreshing={livePoints.isRefreshing}
				isPageActive={livePoints.isPageActive}
				shouldAutoRefresh={livePoints.shouldAutoRefresh}
				liveData={livePoints.liveData}
				startingPlayers={livePoints.startingPlayers}
				benchPlayers={livePoints.benchPlayers}
				onGameweekChange={livePoints.changeGameweek}
				onRefresh={livePoints.refresh}
			/>
		)
	}

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<h1 className="mb-6 text-3xl font-bold">Live Points</h1>
				{content}
			</div>
		</PageShell>
	)
}
