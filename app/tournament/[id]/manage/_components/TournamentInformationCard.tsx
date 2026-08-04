import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { useFormatter, useTranslations } from 'next-intl'

const Detail = ({ label, value }: { label: string; value: string | number }) => (
	<div className="rounded-lg border bg-muted/30 p-3">
		<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
		<dd className="mt-1 font-medium text-foreground">{value}</dd>
	</div>
)

export function TournamentInformationCard({ tournament }: { tournament: EntryTournament }) {
	const t = useTranslations('TournamentManage')
	const format = useFormatter()
	const groupStage = tournament.groupMode === 'NONE' ? t('noGroup') : tournament.groupMode === 'BATTLE_RACES' ? t('headToHeadGroups') : t('pointsRaceGroups')
	const knockoutStage = tournament.knockoutMode === 'NO_KNOCKOUT' ? t('noKnockout') : tournament.knockoutMode === 'DOUBLE_ELIMINATION' ? t('homeAwayKnockout') : t('singleKnockout')
	const gameweekRange = (start: number | null, end: number | null) => start && end ? t('gameweekRange', { start, end }) : t('notScheduled')
	const state = tournament.state === 'ACTIVE' ? t('active') : tournament.state === 'FINISHED' ? t('completed') : t('paused')
	const leagueType = tournament.leagueType === 'CLASSIC' ? t('classic') : tournament.leagueType === 'H2H' ? t('headToHead') : tournament.leagueType
	const date = (value: string) => {
		const timestamp = Date.parse(value)
		return Number.isFinite(timestamp) ? format.dateTime(new Date(timestamp), { day: 'numeric', month: 'short', year: 'numeric' }) : t('unknown')
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle asChild className="text-xl">
					<h2>{t('information')}</h2>
				</CardTitle>
				<CardDescription>{t('informationDescription')}</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="grid gap-3 sm:grid-cols-2">
					<Detail label={t('administrator')} value={tournament.creator} />
					<Detail label={t('status')} value={state} />
					<Detail label={t('leagueType')} value={leagueType} />
					<Detail label={t('sourceLeague')} value={tournament.sourceLeagueName ?? t('unknown')} />
					<Detail label={t('rosterMode')} value={t(tournament.rosterMode === 'OFFICIAL_SYNC' ? 'officialRoster' : 'snapshotRoster')} />
					<Detail label={t('participants')} value={tournament.totalTeamNum} />
					<Detail label={t('groupStage')} value={groupStage} />
					<Detail label={t('groupGameweeks')} value={gameweekRange(tournament.groupStartedEventId, tournament.groupEndedEventId)} />
					<Detail label={t('knockoutStage')} value={knockoutStage} />
					<Detail label={t('knockoutGameweeks')} value={gameweekRange(tournament.knockoutStartedEventId, tournament.knockoutEndedEventId)} />
					<Detail label={t('created')} value={date(tournament.createdAt)} />
					<Detail label={t('lastUpdated')} value={date(tournament.updatedAt)} />
				</dl>
			</CardContent>
		</Card>
	)
}
