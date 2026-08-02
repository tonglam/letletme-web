'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import { PlayerList } from '@/components/live/PlayerList'
import { TeamStats } from '@/components/live/TeamStats'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LiveCalcData } from '@/lib/graphql/operations/live'
import type { Player } from '@/types/player'
import { Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { deriveLiveTeamStats } from '../_lib/live-points-model'
import { LivePointsAutoRefreshCountdown } from './LivePointsAutoRefreshCountdown'

export function LivePointsDashboard({
	entrySearch,
	currentGameweek,
	selectedGameweek,
	isLoading,
	isRefreshing,
	isPageActive,
	shouldAutoRefresh,
	liveData,
	startingPlayers,
	benchPlayers,
	onGameweekChange,
	onRefresh,
}: {
	entrySearch?: ReactNode
	currentGameweek: number
	selectedGameweek?: number
	isLoading: boolean
	isRefreshing: boolean
	isPageActive: boolean
	shouldAutoRefresh: boolean
	liveData: LiveCalcData
	startingPlayers: Player[]
	benchPlayers: Player[]
	onGameweekChange: (gameweek: number) => void
	onRefresh: () => Promise<void>
}) {
	const autoRefreshEnabled = shouldAutoRefresh && isPageActive

	return (
		<>
			<div className="mb-6">
				{entrySearch ? <Card className="mb-4 p-4">{entrySearch}</Card> : null}
				<GameweekSelector
					onGameweekChange={onGameweekChange}
					currentGameweek={currentGameweek}
					selectedGameweek={selectedGameweek}
					disabled={isLoading || isRefreshing}
				/>
				<div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-xs text-muted-foreground">
						{autoRefreshEnabled
							? 'Auto refreshes every minute while this page is active.'
							: shouldAutoRefresh
								? 'Auto refresh paused while this tab is hidden or offline.'
								: 'Auto refresh paused for past or unavailable gameweeks.'}
					</p>
					<div className="flex items-center gap-3">
						<LivePointsAutoRefreshCountdown enabled={autoRefreshEnabled} onRefresh={onRefresh} />
						<Button
							size="sm"
							variant="outline"
							onClick={() => void onRefresh()}
							disabled={isLoading || isRefreshing || selectedGameweek === undefined}
						>
							<RefreshCw data-icon="inline-start" className={isRefreshing ? 'animate-spin' : undefined} />
							Refresh
						</Button>
					</div>
				</div>
			</div>

			<div aria-live="polite" className="min-h-5">
				{isRefreshing ? (
					<div className="mb-3 flex items-center justify-end gap-2 text-sm text-muted-foreground">
						<Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
						<span>Updating live points…</span>
					</div>
				) : null}
			</div>

			<div className={cn(isRefreshing && 'opacity-75 transition-opacity')}>
				<TeamStats stats={deriveLiveTeamStats(liveData)} />
			</div>

			<section aria-labelledby="live-squad-heading">
				<h2 id="live-squad-heading" className="mb-3 text-xl font-bold">Squad</h2>
				<Card className={cn('overflow-hidden', isRefreshing && 'opacity-75 transition-opacity')}>
					<PlayerList startingPlayers={startingPlayers} benchPlayers={benchPlayers} />
				</Card>
			</section>
		</>
	)
}
