'use client'

import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Button } from '@/components/ui/button'
import type {
	LiveCalcData,
	LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import { Link } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LivePointsDashboard } from '../_components/LivePointsDashboard'
import { LivePointsLoading } from '../_components/LivePointsLoading'
import { useLivePoints } from '../_hooks/useLivePoints'

interface TeamPointsClientProps {
	entryId: number
	tournamentId?: string
	initialEventId: number
	initialLiveData?: LiveCalcData
	initialSnapshot?: LiveSnapshotStatus | null
}

export default function TeamPointsClient({
	entryId,
	tournamentId,
	initialEventId,
	initialLiveData,
	initialSnapshot
}: TeamPointsClientProps) {
	const t = useTranslations('LivePoints')
	const livePoints = useLivePoints({
		initialEntryId: entryId,
		initialEventId,
		initialLiveData,
		initialSnapshot
	})
	const backHref = tournamentId
		? `/live/competitions/${tournamentId}`
		: '/live/competitions'

	let content
	if (livePoints.isLoading && !livePoints.liveData) {
		content = (
			<LivePointsLoading
				activeEntryId={entryId}
				currentGameweek={livePoints.currentGameweek}
				selectedGameweek={livePoints.selectedGameweek}
			/>
		)
	} else {
		content = (
			<LivePointsDashboard
				currentGameweek={livePoints.currentGameweek}
				selectedGameweek={livePoints.selectedGameweek}
				isLoading={livePoints.isLoading}
				isRefreshing={livePoints.isRefreshing}
				error={livePoints.error}
				isPageActive={livePoints.isPageActive}
				shouldAutoRefresh={livePoints.shouldAutoRefresh}
				liveData={livePoints.liveData}
				startingPlayers={livePoints.startingPlayers}
				benchPlayers={livePoints.benchPlayers}
				onGameweekChange={livePoints.changeGameweek}
				onAutoRefresh={livePoints.autoRefresh}
				onRefresh={livePoints.refresh}
			/>
		)
	}

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<Button
					variant="ghost"
					className="-ml-3 mb-2"
					asChild
				>
					<Link href={backHref}>
						<ArrowLeft aria-hidden="true" /> {t('backTournament')}
					</Link>
				</Button>
				<StatsPageHeader eyebrow={t('livePoints')} title={t('teamTitle')} />
				{content}
			</div>
		</PageShell>
	)
}
