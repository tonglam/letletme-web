'use client'

import PageShell from '@/components/layout/PageShell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { ArrowLeft, TriangleAlert, Trophy } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { TournamentDangerZone } from './_components/TournamentDangerZone'
import { TournamentInformationCard } from './_components/TournamentInformationCard'
import { TournamentSettingsCard } from './_components/TournamentSettingsCard'
import { useTournamentManagement } from './_hooks/useTournamentManagement'

export default function ManageTournamentClient({ tournament }: { tournament: EntryTournament }) {
	const t = useTranslations('TournamentManage')
	const management = useTournamentManagement(tournament)

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
				<Button variant="ghost" className="-ml-3" asChild>
					<Link href={`/live/tournament/${tournament.id}`}>
						<ArrowLeft aria-hidden="true" /> {t('back')}
					</Link>
				</Button>

				<header className="flex items-start gap-3">
					<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-ink">
						<Trophy className="size-6" aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<p className="text-sm font-medium text-muted-foreground">{t('tournamentNumber', { id: tournament.id })}</p>
						<h1 className="break-words text-3xl font-bold tracking-tight">{t('manageTitle', { name: management.currentName })}</h1>
					</div>
				</header>

				{management.mutationState.kind === 'error' ? (
					<Alert variant="destructive">
						<TriangleAlert aria-hidden="true" />
						<AlertDescription>{management.mutationState.message}</AlertDescription>
					</Alert>
				) : null}

				<TournamentSettingsCard
					currentName={management.currentName}
					isSaving={management.isSaving}
					mutationState={management.mutationState}
					onSubmit={management.renameTournament}
				/>
				<TournamentInformationCard tournament={tournament} />
				<TournamentDangerZone
					isDeleting={management.isDeleting}
					onDelete={management.deleteTournament}
					tournamentName={management.currentName}
				/>
			</div>
		</PageShell>
	)
}
