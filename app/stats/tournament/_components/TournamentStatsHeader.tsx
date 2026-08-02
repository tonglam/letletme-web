import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { formatCompactNumber } from '@/lib/utils'
import { Calendar, Trophy, Users } from 'lucide-react'
import {
	formatGroupMode,
	formatKnockoutMode,
	formatLeagueType,
	formatStateBadge,
} from '../_lib/tournament-stats-model'

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
	tournaments,
}: TournamentStatsHeaderProps) {
	const stateBadge = selectedTournament ? formatStateBadge(selectedTournament.state) : null
	const groupPhaseLabel = selectedTournament ? formatGroupMode(selectedTournament.groupMode) : null
	const knockoutPhaseLabel = selectedTournament ? formatKnockoutMode(selectedTournament.knockoutMode) : null

	return (
		<Card className="mb-6 p-6">
			<div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
				<label htmlFor="tournament-stats-select" className="flex items-center gap-2 font-medium">
					<Trophy className="size-5 text-primary" aria-hidden="true" />
					Tournament
				</label>
				<Select value={selectedTournamentId} onValueChange={onTournamentChange}>
					<SelectTrigger id="tournament-stats-select" className="w-full sm:w-[250px]">
						<SelectValue placeholder="Select tournament" />
					</SelectTrigger>
					<SelectContent>
						{tournaments.map((tournament) => (
							<SelectItem key={tournament.id} value={String(tournament.id)}>
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
							{stateBadge ? <Badge variant="outline" className={stateBadge.className}>{stateBadge.label}</Badge> : null}
							<Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
								{formatLeagueType(selectedTournament.leagueType)}
							</Badge>
							<Badge variant="outline" className="gap-1 border-primary/20 bg-primary/10 text-primary">
								<Users aria-hidden="true" />
								{formatCompactNumber(selectedTournament.totalTeamNum)} teams
							</Badge>
							{dataGameweek !== null ? (
								<Badge variant="outline" className="gap-1 border-border bg-muted text-muted-foreground">
									<Calendar aria-hidden="true" /> as of GW{dataGameweek}
								</Badge>
							) : null}
						</div>
					</div>

					<div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
						{groupPhaseLabel && selectedTournament.groupStartedEventId !== null ? (
							<span>
								Group ({groupPhaseLabel}): GW{selectedTournament.groupStartedEventId}
								{selectedTournament.groupEndedEventId !== null ? `–${selectedTournament.groupEndedEventId}` : '+'}
							</span>
						) : null}
						{knockoutPhaseLabel && selectedTournament.knockoutStartedEventId !== null ? (
							<span>
								Knockout ({knockoutPhaseLabel}): GW{selectedTournament.knockoutStartedEventId}
								{selectedTournament.knockoutEndedEventId !== null ? `–${selectedTournament.knockoutEndedEventId}` : '+'}
							</span>
						) : null}
						{selectedTournament.groupQualifyNum !== null ? (
							<span>Top {selectedTournament.groupQualifyNum} qualify per group</span>
						) : null}
					</div>
				</div>
			) : (
				<p className="text-sm text-muted-foreground">No tournaments are linked to this FPL entry.</p>
			)}
		</Card>
	)
}
