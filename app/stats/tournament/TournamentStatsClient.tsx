'use client'

import { PageLoading } from '@/components/feedback/PageLoading'
import PageShell from '@/components/layout/PageShell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { TournamentPerformance } from './_components/TournamentPerformance'
import { TournamentRanking } from './_components/TournamentRanking'
import { TournamentStatsHeader } from './_components/TournamentStatsHeader'
import { TournamentStatsTabs } from './_components/TournamentStatsTabs'
import { useTournamentStats, type TournamentStatsClientProps } from './_hooks/useTournamentStats'
import { useTranslations } from 'next-intl'

export default function TournamentStatsClient(props: TournamentStatsClientProps) {
	const t = useTranslations('TournamentStats')
	const {
		dataGameweek,
		error,
		filteredStandings,
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
				<h1 className="mb-6 text-3xl font-bold">{t('title')}</h1>

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

				{tournamentStats ? (
					<>
						<TournamentPerformance dataGameweek={dataGameweek} stats={tournamentStats} />
						<TournamentRanking summary={rankingSummary} />
						<TournamentStatsTabs
							filteredStandings={filteredStandings}
							onSearchChange={setStandingsSearch}
							search={standingsSearch}
							stats={tournamentStats}
						/>
					</>
				) : (
					<Card className="p-6" aria-live="polite" aria-busy={isLoading}>
						<p className="text-muted-foreground">
							{isLoading ? t('loading') : t('noStats')}
						</p>
					</Card>
				)}
			</div>
		</PageShell>
	)
}
