import { TournamentLifecycleBadge } from '@/components/tournament/TournamentLifecycleBadge'
import { Card } from '@/components/ui/card'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { cn } from '@/lib/utils'
import { useFormatter, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

interface TournamentStatsHeaderProps {
	onTournamentChange: (value: string) => void
	selectedTournament: EntryTournament | null
	selectedTournamentId: string
	tournaments: EntryTournament[]
}

function MetaChip({ children }: { children: ReactNode }) {
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-md border border-border/70',
				'bg-muted/35 px-2 py-0.5 text-caption font-medium text-muted-foreground',
				'dark:bg-muted/20'
			)}
		>
			{children}
		</span>
	)
}

export function TournamentStatsHeader({
	onTournamentChange,
	selectedTournament,
	selectedTournamentId,
	tournaments
}: TournamentStatsHeaderProps) {
	const t = useTranslations('TournamentStats')
	const lifecycleT = useTranslations('TournamentManage')
	const format = useFormatter()

	const groupModeLabel =
		selectedTournament?.groupMode === 'POINTS_RACES'
			? t('pointsRace')
			: selectedTournament?.groupMode === 'BATTLE_RACES'
				? t('battleRace')
				: null
	const knockoutModeLabel =
		selectedTournament?.knockoutMode === 'SINGLE_ELIMINATION'
			? t('singleElimination')
			: selectedTournament?.knockoutMode === 'DOUBLE_ELIMINATION'
				? t('doubleElimination')
				: selectedTournament?.knockoutMode === 'HEAD_TO_HEAD'
					? t('headToHead')
					: null
	const leagueType =
		selectedTournament?.leagueType === 'H2H'
			? t('headToHead')
			: selectedTournament?.leagueType === 'CLASSIC'
				? t('classic')
				: selectedTournament?.leagueType

	const metaChips: string[] = []
	if (selectedTournament) {
		if (leagueType) metaChips.push(leagueType)
		metaChips.push(
			t('teams', {
				count: format.number(selectedTournament.totalTeamNum, {
					notation: 'compact'
				})
			})
		)
		const rosterTime =
			selectedTournament.rosterMode === 'OFFICIAL_SYNC'
				? selectedTournament.rosterLastSyncedAt
				: selectedTournament.createdAt
		metaChips.push(
			selectedTournament.rosterMode === 'OFFICIAL_SYNC'
				? lifecycleT('officialRoster')
				: lifecycleT('snapshotRoster')
		)
		if (rosterTime) {
			metaChips.push(
				`${lifecycleT(
					selectedTournament.rosterMode === 'OFFICIAL_SYNC'
						? 'lastUpdated'
						: 'created'
				)}: ${format.dateTime(new Date(rosterTime), {
					dateStyle: 'medium',
					timeStyle: 'short'
				})}`
			)
		}
		if (groupModeLabel && selectedTournament.groupStartedEventId != null) {
			metaChips.push(t('groupStage'))
			metaChips.push(groupModeLabel)
			metaChips.push(
				selectedTournament.groupEndedEventId != null
					? t('gameweekRange', {
							start: selectedTournament.groupStartedEventId,
							end: selectedTournament.groupEndedEventId
						})
					: t('gameweekFrom', {
							start: selectedTournament.groupStartedEventId
						})
			)
		}
		if (
			knockoutModeLabel &&
			selectedTournament.knockoutStartedEventId != null
		) {
			metaChips.push(t('knockoutStage'))
			metaChips.push(knockoutModeLabel)
			metaChips.push(
				selectedTournament.knockoutEndedEventId != null
					? t('gameweekRange', {
							start: selectedTournament.knockoutStartedEventId,
							end: selectedTournament.knockoutEndedEventId
						})
					: t('gameweekFrom', {
							start: selectedTournament.knockoutStartedEventId
						})
			)
		}
		if (selectedTournament.groupQualifyNum != null) {
			metaChips.push(
				t('topQualify', { count: selectedTournament.groupQualifyNum })
			)
		}
	}

	return (
		<Card className="mb-5 overflow-hidden shadow-sm sm:mb-6">
			<div className="space-y-3 p-4 sm:space-y-3.5 sm:p-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0 flex-1 space-y-2">
						<label
							htmlFor="tournament-stats-select"
							className="eyebrow"
						>
							{t('selectTournament')}
						</label>
						<Select
							value={selectedTournamentId}
							onValueChange={onTournamentChange}
						>
							<SelectTrigger
								id="tournament-stats-select"
								className="h-11 w-full max-w-md font-display text-base font-semibold tracking-tight"
							>
								<SelectValue placeholder={t('selectTournament')}>
									{selectedTournament?.name ?? t('selectTournament')}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{tournaments.map(tournament => (
									<SelectItem
										key={tournament.id}
										value={String(tournament.id)}
									>
										{tournament.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{selectedTournament ? (
						<div className="shrink-0 sm:pt-6">
							<TournamentLifecycleBadge tournament={selectedTournament} />
						</div>
					) : null}
				</div>

				{selectedTournament ? (
					metaChips.length > 0 ? (
						<ul
							className="flex flex-wrap gap-1.5"
							aria-label={t('formatDetails')}
						>
							{metaChips.map(chip => (
								<li key={chip}>
									<MetaChip>{chip}</MetaChip>
								</li>
							))}
						</ul>
					) : null
				) : null}
			</div>
		</Card>
	)
}
