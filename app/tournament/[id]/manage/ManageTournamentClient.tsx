'use client'

import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { TournamentInformationCard } from './_components/TournamentInformationCard'
import { TournamentOperationsCard } from './_components/TournamentOperationsCard'
import { TournamentSettingsCard } from './_components/TournamentSettingsCard'
import { useTournamentManagement } from './_hooks/useTournamentManagement'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import dynamic from 'next/dynamic'

const TournamentDangerZone = dynamic(() => import('./_components/TournamentDangerZone').then(mod => mod.TournamentDangerZone))

export default function ManageTournamentClient({ tournament }: { tournament: EntryTournament }) {
	const t = useTranslations('TournamentManage')
	const management = useTournamentManagement(tournament)

	return (
		<PageShell>
			<RouteReadyMarker name="COMPETITIONS_MANAGE_READY" audienceHint="session-hint" goodMs={1000} poorMs={1500} />
			<div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
				<Button variant="ghost" className="-ml-3" asChild>
					<Link href={`/live/competitions/${tournament.id}`} prefetch={false}>
						<ArrowLeft aria-hidden="true" /> {t('back')}
					</Link>
				</Button>

				<StatsPageHeader
					eyebrow={t('eyebrow')}
					title={t('manageTitle', { name: management.currentName })}
					badge={
						<span className="inline-flex w-fit items-center rounded-md border border-border/70 bg-muted/40 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
							{t('tournamentNumber', { id: tournament.id })}
						</span>
					}
				/>

				{management.mutationState.kind === 'error' ? (
					<Alert variant="destructive">
						<TriangleAlert aria-hidden="true" />
						<AlertDescription>{management.mutationState.message}</AlertDescription>
					</Alert>
				) : null}

				<TournamentOperationsCard
					tournament={management.currentTournament}
					pendingAction={management.pendingAction}
					onAction={management.runAction}
				/>
				<TournamentSettingsCard
					currentName={management.currentName}
					isSaving={management.isSaving}
					mutationState={management.mutationState}
					onSubmit={management.renameTournament}
				/>
				<TournamentInformationCard tournament={management.currentTournament} />
				<TournamentDangerZone
					isDeleting={management.isDeleting}
					onDelete={management.deleteTournament}
					tournamentName={management.currentName}
				/>
			</div>
		</PageShell>
	)
}
