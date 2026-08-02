'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import type { EntryEventResult } from '@/lib/graphql/operations/entries'
import { AlertCircle } from 'lucide-react'
import { TeamStatsSummary } from './_components/TeamStatsSummary'
import { TeamStatsTabs } from './_components/TeamStatsTabs'
import { useTeamStats } from './_hooks/useTeamStats'

interface TeamStatsClientProps {
	entryId: number
	currentGameweek: number
	initialEntryEventResult: EntryEventResult | null
	initialError: string | null
	initialRequestComplete: boolean
}

export default function TeamStatsClient(props: TeamStatsClientProps) {
	const {
		activeTab,
		currentGameweek,
		emptyStateMessage,
		error,
		isLoading,
		selectedGameweek,
		setActiveTab,
		setSelectedGameweek,
		teamStats,
	} = useTeamStats(props)

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<h1 className="mb-6 text-3xl font-bold">My Team Stats</h1>

				{error ? (
					<Alert variant="destructive" className="mb-6">
						<AlertCircle aria-hidden="true" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}

				<GameweekSelector
					className="mb-6"
					onGameweekChange={setSelectedGameweek}
					currentGameweek={currentGameweek}
					selectedGameweek={selectedGameweek}
					disabled={isLoading || !currentGameweek}
				/>

				{teamStats ? (
					<>
						<TeamStatsSummary stats={teamStats} />
						<TeamStatsTabs activeTab={activeTab} onTabChange={setActiveTab} stats={teamStats} />
					</>
				) : (
					<Card className="p-6" aria-live="polite" aria-busy={isLoading}>
						<p className="text-muted-foreground">
							{isLoading ? 'Loading team stats…' : (emptyStateMessage ?? 'No team stats available.')}
						</p>
					</Card>
				)}
			</div>
		</PageShell>
	)
}
