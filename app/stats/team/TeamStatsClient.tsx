'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import type { EntryEventResult } from '@/lib/graphql/operations/entries'
import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
	const t = useTranslations('TeamStats')
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
				<StatsPageHeader
					eyebrow={t('squad')}
					title={t('title')}
					badge={
						selectedGameweek ? (
							<span className="inline-flex w-fit items-center rounded-md bg-plum px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.14em] text-electric">
								GW{selectedGameweek}
							</span>
						) : null
					}
				/>

				{error ? (
					<Alert variant="destructive" className="mb-6">
						<AlertCircle aria-hidden="true" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}

				<div className="mb-5 sm:mb-6">
					<GameweekSelector
						onGameweekChange={setSelectedGameweek}
						currentGameweek={currentGameweek}
						selectedGameweek={selectedGameweek}
						disabled={isLoading || !currentGameweek}
					/>
				</div>

				{teamStats ? (
					<>
						<TeamStatsSummary stats={teamStats} />
						<TeamStatsTabs
							activeTab={activeTab}
							onTabChange={setActiveTab}
							stats={teamStats}
						/>
					</>
				) : (
					<Card
						className="border-border/80 p-6 shadow-sm"
						aria-live="polite"
						aria-busy={isLoading}
					>
						<p className="text-sm text-muted-foreground">
							{isLoading
								? t('loading')
								: (emptyStateMessage ?? t('noStats'))}
						</p>
					</Card>
				)}
			</div>
		</PageShell>
	)
}
