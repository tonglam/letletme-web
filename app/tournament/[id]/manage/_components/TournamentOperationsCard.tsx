'use client'

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card'
import { TournamentLifecycleBadge } from '@/components/tournament/TournamentLifecycleBadge'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import {
	isTournamentRosterSyncInFlight,
	isTournamentSetupInFlight
} from '@/lib/tournament/lifecycle'
import { LoaderCircle, Pause, Play, RefreshCw, UsersRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import type { TournamentManagementAction } from '../_hooks/useTournamentManagement'

export function TournamentOperationsCard({
	tournament,
	pendingAction,
	onAction
}: {
	tournament: EntryTournament
	pendingAction: TournamentManagementAction | null
	onAction: (action: TournamentManagementAction) => Promise<boolean>
}) {
	const t = useTranslations('TournamentManage')
	const isEligibleForOfficialSync =
		tournament.leagueType === 'CLASSIC' &&
		tournament.groupMode === 'POINTS_RACES' &&
		tournament.groupNum === 1 &&
		tournament.knockoutMode === 'NO_KNOCKOUT'
	const busy = pendingAction !== null
	const rosterSyncInFlight = isTournamentRosterSyncInFlight(
		tournament.rosterSyncStatus
	)
	const setupInFlight = isTournamentSetupInFlight(tournament.setupStatus)
	const setupFailed = tournament.setupStatus === 'FAILED'
	const setupNeedsFollowUp =
		setupFailed ||
		tournament.setupHasWarnings ||
		Boolean(tournament.warningSummaries?.length)
	const actionIcon = (action: TournamentManagementAction, icon: ReactNode) =>
		pendingAction === action ? (
			<LoaderCircle
				className="animate-spin"
				aria-hidden="true"
			/>
		) : (
			icon
		)

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle
							asChild
							className="text-xl"
						>
							<h2>{t('operations')}</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							{t('operationsDescription')}
						</CardDescription>
					</div>
					<TournamentLifecycleBadge tournament={tournament} />
				</div>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="font-medium">
							{t(
								tournament.state === 'INACTIVE' ? 'resumeTitle' : 'pauseTitle'
							)}
						</p>
						<p className="text-sm text-muted-foreground">
							{t(
								tournament.state === 'INACTIVE'
									? 'resumeDescription'
									: 'pauseDescription'
							)}
						</p>
					</div>
					{tournament.state === 'FINISHED' ? null : tournament.state ===
					  'INACTIVE' ? (
						<Button
							disabled={busy || setupInFlight}
							onClick={() => void onAction('resume')}
						>
							{actionIcon('resume', <Play aria-hidden="true" />)} {t('resume')}
						</Button>
					) : (
						<Button
							variant="outline"
							disabled={busy}
							onClick={() => void onAction('pause')}
						>
							{actionIcon('pause', <Pause aria-hidden="true" />)} {t('pause')}
						</Button>
					)}
				</div>

				{setupNeedsFollowUp ? (
					<div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="font-medium">
								{t(setupFailed ? 'recoverSetupTitle' : 'completeInsightsTitle')}
							</p>
							<p className="text-sm text-muted-foreground">
								{t(
									setupFailed
										? 'recoverSetupDescription'
										: 'backgroundRepairDescription'
								)}
							</p>
						</div>
						{setupFailed ? (
							<Button
								variant="outline"
								disabled={busy}
								onClick={() => void onAction('retry_setup')}
							>
								{actionIcon('retry_setup', <RefreshCw aria-hidden="true" />)}{' '}
								{t('recoverSetup')}
							</Button>
						) : null}
					</div>
				) : null}

				{tournament.rosterMode === 'OFFICIAL_SYNC' ? (
					<div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="font-medium">{t('syncRosterTitle')}</p>
							<p className="text-sm text-muted-foreground">
								{t('syncRosterDescription')}
							</p>
						</div>
						<Button
							variant="outline"
							disabled={
								busy || rosterSyncInFlight || tournament.state === 'FINISHED'
							}
							onClick={() => void onAction('retry_roster')}
						>
							{rosterSyncInFlight ? (
								<LoaderCircle
									className="animate-spin"
									aria-hidden="true"
								/>
							) : (
								actionIcon('retry_roster', <UsersRound aria-hidden="true" />)
							)}{' '}
							{t('syncRoster')}
						</Button>
					</div>
				) : isEligibleForOfficialSync && tournament.state !== 'FINISHED' ? (
					<div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="font-medium">{t('officialSyncTitle')}</p>
							<p className="text-sm text-muted-foreground">
								{t('officialSyncDescription')}
							</p>
						</div>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="outline"
									disabled={busy}
								>
									<UsersRound aria-hidden="true" /> {t('enableOfficialSync')}
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										{t('officialSyncConfirmTitle')}
									</AlertDialogTitle>
									<AlertDialogDescription>
										{t('officialSyncConfirmDescription')}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => void onAction('enable_official_sync')}
									>
										{t('enableOfficialSync')}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				) : null}
			</CardContent>
		</Card>
	)
}
