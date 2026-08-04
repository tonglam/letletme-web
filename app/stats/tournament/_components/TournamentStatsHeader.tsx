import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { Calendar, Trophy, Users } from 'lucide-react'
import { formatStateBadge } from '../_lib/tournament-stats-model'
import { useFormatter, useTranslations } from 'next-intl'

interface TournamentStatsHeaderProps {
	dataGameweek: number | null
	onTournamentChange: (value: string) => void
	selectedTournament: EntryTournament | null
	selectedTournamentId: string
	tournaments: EntryTournament[]
}

export function TournamentStatsHeader({
	dataGameweek,
	onTournamentChange,
	selectedTournament,
	selectedTournamentId,
	tournaments
}: TournamentStatsHeaderProps) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	const stateBadge = selectedTournament
		? formatStateBadge(selectedTournament.state)
		: null
	const stateLabel =
		selectedTournament?.state === 'ACTIVE'
			? t('live')
			: selectedTournament?.state === 'FINISHED'
				? t('completed')
				: selectedTournament?.state === 'INACTIVE'
					? t('paused')
					: selectedTournament?.state
	const groupPhaseLabel =
		selectedTournament?.groupMode === 'POINTS_RACES'
			? t('pointsRace')
			: selectedTournament?.groupMode === 'BATTLE_RACES'
				? t('battleRace')
				: null
	const knockoutPhaseLabel =
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

	return (
		<Card className="mb-6 p-6">
			<div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
				<label
					htmlFor="tournament-stats-select"
					className="flex items-center gap-2 font-medium"
				>
					<Trophy
						className="size-5 text-primary-ink"
						aria-hidden="true"
					/>
					{t('tournament')}
				</label>
				<Select
					value={selectedTournamentId}
					onValueChange={onTournamentChange}
				>
					<SelectTrigger
						id="tournament-stats-select"
						className="w-full sm:w-[250px]"
					>
						<SelectValue placeholder={t('selectTournament')} />
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
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<h2 className="text-xl font-bold">{selectedTournament.name}</h2>
						<div className="flex flex-wrap gap-1.5">
							{stateBadge ? (
								<Badge
									variant="outline"
									className={stateBadge.className}
								>
									{stateLabel}
								</Badge>
							) : null}
							<Badge
								variant="outline"
								className="border-primary/20 bg-primary/10 text-primary-ink"
							>
								{leagueType}
							</Badge>
							<Badge
								variant="outline"
								className="gap-1 border-primary/20 bg-primary/10 text-primary-ink"
							>
								<Users aria-hidden="true" />
								{t('teams', {
									count: format.number(selectedTournament.totalTeamNum, {
										notation: 'compact'
									})
								})}
							</Badge>
							{dataGameweek !== null ? (
								<Badge
									variant="outline"
									className="gap-1 border-border bg-muted text-muted-foreground"
								>
									<Calendar aria-hidden="true" />{' '}
									{t('asOfGameweek', { gameweek: dataGameweek })}
								</Badge>
							) : null}
						</div>
					</div>

					<div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
						{groupPhaseLabel &&
						selectedTournament.groupStartedEventId !== null ? (
							<span>
								{t('groupRange', {
									mode: groupPhaseLabel,
									start: selectedTournament.groupStartedEventId,
									end:
										selectedTournament.groupEndedEventId !== null
											? `–${selectedTournament.groupEndedEventId}`
											: '+'
								})}
							</span>
						) : null}
						{knockoutPhaseLabel &&
						selectedTournament.knockoutStartedEventId !== null ? (
							<span>
								{t('knockoutRange', {
									mode: knockoutPhaseLabel,
									start: selectedTournament.knockoutStartedEventId,
									end:
										selectedTournament.knockoutEndedEventId !== null
											? `–${selectedTournament.knockoutEndedEventId}`
											: '+'
								})}
							</span>
						) : null}
						{selectedTournament.groupQualifyNum !== null ? (
							<span>
								{t('topQualify', { count: selectedTournament.groupQualifyNum })}
							</span>
						) : null}
					</div>
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{t('noLinked')}</p>
			)}
		</Card>
	)
}
