'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import type { LiveCalcData } from '@/lib/graphql/operations/live'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { LivePointsDashboard } from '../_components/LivePointsDashboard'
import { LivePointsLoading } from '../_components/LivePointsLoading'
import { useLivePoints } from '../_hooks/useLivePoints'

interface TeamPointsClientProps {
	entryId: number
	tournamentId?: string
	initialEventId: number
	initialLiveData?: LiveCalcData
}

export default function TeamPointsClient({
	entryId,
	tournamentId,
	initialEventId,
	initialLiveData,
}: TeamPointsClientProps) {
	const livePoints = useLivePoints({
		initialEntryId: entryId,
		initialEventId,
		initialLiveData,
	})
	const backHref = tournamentId ? `/live/tournament/${tournamentId}` : '/live/tournament'

	let content
	if (livePoints.isLoading && !livePoints.liveData) {
		content = (
			<LivePointsLoading
				activeEntryId={entryId}
				currentGameweek={livePoints.currentGameweek}
				selectedGameweek={livePoints.selectedGameweek}
			/>
		)
	} else if (!livePoints.liveData) {
		content = (
			<>
				<GameweekSelector
					onGameweekChange={livePoints.changeGameweek}
					currentGameweek={livePoints.currentGameweek}
					selectedGameweek={livePoints.selectedGameweek}
				/>
				<p className="mt-6 text-center text-sm text-destructive" role="alert">
					{livePoints.error ?? 'No live data is available for this team.'}
				</p>
			</>
		)
	} else {
		content = (
			<LivePointsDashboard
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
				<Button variant="ghost" className="-ml-3 mb-4" asChild>
					<Link href={backHref}><ArrowLeft aria-hidden="true" /> Back to tournament</Link>
				</Button>
				<h1 className="mb-6 text-3xl font-bold">Team live points</h1>
				{content}
			</div>
		</PageShell>
	)
}
