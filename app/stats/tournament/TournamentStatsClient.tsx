'use client'

import { PageLoading } from '@/components/feedback/PageLoading'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { TournamentPerformance } from './_components/TournamentPerformance'
import { TournamentRanking } from './_components/TournamentRanking'
import { TournamentStatsHeader } from './_components/TournamentStatsHeader'
import { TournamentStatsTabs } from './_components/TournamentStatsTabs'
import {
	useTournamentStats,
	type TournamentStatsClientProps,
} from './_hooks/useTournamentStats'

export default function TournamentStatsClient(props: TournamentStatsClientProps) {
	const t = useTranslations('TournamentStats')
	const lifecycleT = useTranslations('TournamentLifecycle')
	const {
		dataGameweek,
		error,
		filteredStandings,
		insightsReady,
		isBootstrapping,
		isLoading,
		rankingSummary,
		selectedTournament,
		selectedTournamentId,
		setSelectedTournamentId,
		setStandingsSearch,
		standingsSearch,
		tournamentStats,
		tournaments,
	} = useTournamentStats(props)

	if (isBootstrapping) return <PageLoading label={t('loadingPage')} />

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<StatsPageHeader
					eyebrow={t('standings')}
					title={t('title')}
					badge={
						dataGameweek !== null ? (
							<span className="inline-flex w-fit items-center rounded-md bg-plum px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.14em] text-electric">
								GW{dataGameweek}
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

				<TournamentStatsHeader
					dataGameweek={dataGameweek}
					onTournamentChange={setSelectedTournamentId}
					selectedTournament={selectedTournament}
					selectedTournamentId={selectedTournamentId}
					tournaments={tournaments}
				/>

				{insightsReady && tournamentStats ? (
					<>
						<TournamentPerformance
							dataGameweek={dataGameweek}
							stats={tournamentStats}
						/>
						<TournamentRanking summary={rankingSummary} />
						<TournamentStatsTabs
							filteredStandings={filteredStandings}
							onSearchChange={setStandingsSearch}
							search={standingsSearch}
							stats={tournamentStats}
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
								: selectedTournament && !insightsReady
									? selectedTournament.setupStatus === 'FAILED'
										? lifecycleT('memberFailure')
										: selectedTournament.setupHasWarnings
											? lifecycleT('warningSummary')
											: selectedTournament.standingsReadyAt
												? lifecycleT('enrichingMessage')
												: lifecycleT('leavePageMessage')
									: t('noStats')}
						</p>
					</Card>
				)}
			</div>
		</PageShell>
	)
}
