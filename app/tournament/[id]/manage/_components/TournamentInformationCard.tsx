import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import {
	formatTournamentDate,
	getTournamentStructure,
} from '../_lib/tournament-management'

const Detail = ({ label, value }: { label: string; value: string | number }) => (
	<div className="rounded-lg border bg-muted/30 p-3">
		<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
		<dd className="mt-1 font-medium text-foreground">{value}</dd>
	</div>
)

export function TournamentInformationCard({ tournament }: { tournament: EntryTournament }) {
	const structure = getTournamentStructure(tournament)

	return (
		<Card>
			<CardHeader>
				<CardTitle asChild className="text-xl">
					<h2>Tournament information</h2>
				</CardTitle>
				<CardDescription>Read-only details from the current tournament record.</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="grid gap-3 sm:grid-cols-2">
					<Detail label="Administrator" value={tournament.creator} />
					<Detail label="Status" value={structure.state} />
					<Detail label="League type" value={structure.type} />
					<Detail label="Participants" value={tournament.totalTeamNum} />
					<Detail label="Group stage" value={structure.groupStage} />
					<Detail label="Group gameweeks" value={structure.groupGameweeks} />
					<Detail label="Knockout stage" value={structure.knockoutStage} />
					<Detail label="Knockout gameweeks" value={structure.knockoutGameweeks} />
					<Detail label="Created" value={formatTournamentDate(tournament.createdAt)} />
					<Detail label="Last updated" value={formatTournamentDate(tournament.updatedAt)} />
				</dl>
			</CardContent>
		</Card>
	)
}
