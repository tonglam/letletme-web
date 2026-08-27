import { TournamentLifecycleBadge } from '@/components/tournament/TournamentLifecycleBadge'
import { Card } from '@/components/ui/card'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import type { FplClassicLeagueRank } from '@/lib/graphql/operations/leagues'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { cn } from '@/lib/utils'
import { useFormatter, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

interface TournamentStatsHeaderProps {
	fplClassicRanks: FplClassicLeagueRank[]
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
	fplClassicRanks,
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
					timeStyle: 'medium'
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

				{fplClassicRanks.length > 0 ? (
					<div className="space-y-3 border-t border-border/70 pt-3.5">
						<div>
							<p
								id="fpl-classic-ranks-title"
								className="eyebrow"
							>
								{t('fplClassicRanks')}
							</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{t('fplClassicRanksHint')}
							</p>
						</div>
						<ul
							className="grid gap-2 sm:grid-cols-2"
							aria-labelledby="fpl-classic-ranks-title"
						>
							{fplClassicRanks.map(league => {
								const movement =
									league.rank !== null && league.previousRank !== null
										? league.previousRank - league.rank
										: null
								return (
									<li
										key={league.leagueId}
										className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5"
									>
										<span className="min-w-0 truncate text-sm font-semibold">
											{league.name}
										</span>
										<span className="shrink-0 text-right">
											<span className="block font-display text-base font-bold tabular-nums">
												{league.rank === null
													? t('noData')
													: `#${format.number(league.rank)}`}
											</span>
											{movement !== null ? (
												<span className="block text-caption text-muted-foreground">
													{movement > 0
														? t('up', { count: movement })
														: movement < 0
															? t('down', { count: Math.abs(movement) })
															: t('noChange')}
												</span>
											) : null}
										</span>
									</li>
								)
							})}
						</ul>
					</div>
				) : null}
			</div>
		</Card>
	)
}
