'use client'

import { StatsTable, type StatsTableColumn } from '@/components/data/StatsTable'
import { Input } from '@/components/ui/input'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { formatMoneyValue, type StandingRow } from '../_lib/tournament-stats-model'
import { useFormatter, useTranslations } from 'next-intl'

interface TournamentStandingsTabProps {
	onSearchChange: (value: string) => void
	rows: StandingRow[]
	search: string
}

export function TournamentStandingsTab({ onSearchChange, rows, search }: TournamentStandingsTabProps) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	const columns: StatsTableColumn[] = [
		{
			key: 'rank', label: t('rank'), className: 'text-center', sortable: true, sortDefault: 'asc',
			format: (value, row) => {
				const standing = row as unknown as StandingRow
				const rank = Number(value)
				const movement = standing.previousRank - rank
				return (
					<div className="flex flex-col items-center">
						<span className="font-bold">{rank}</span>
						{movement > 0 ? (
							<span className="inline-flex items-center gap-0.5 text-xs text-success" aria-label={t('upPlaces', { count: movement })}>
								<ArrowUp className="size-3" aria-hidden="true" /> {movement}
							</span>
						) : movement < 0 ? (
							<span className="inline-flex items-center gap-0.5 text-xs text-destructive" aria-label={t('downPlaces', { count: Math.abs(movement) })}>
								<ArrowDown className="size-3" aria-hidden="true" /> {Math.abs(movement)}
							</span>
						) : <span className="text-xs text-muted-foreground" aria-label={t('noRankChange')}>—</span>}
					</div>
				)
			},
		},
		{
			key: 'teamName', label: t('team'), sortable: true, sortDefault: 'asc',
			sortValue: (row) => {
				const standing = row as StandingRow
				return `${standing.teamName.toLowerCase()}\u0000${standing.managerName.toLowerCase()}`
			},
			format: (value, row) => (
				<div className="flex flex-col">
					<span className="font-medium">{String(value)}</span>
					<span className="text-xs text-muted-foreground">{(row as unknown as StandingRow).managerName}</span>
				</div>
			),
		},
		{ key: 'gameweekPoints', label: t('gameweekPoints'), className: 'text-center font-medium', sortable: true, sortDefault: 'desc' },
		{ key: 'totalPoints', label: t('totalPoints'), className: 'text-right font-bold', sortable: true, sortDefault: 'desc' },
		{ key: 'overallRank', label: t('overallRankShort'), className: 'text-right font-medium', sortable: true, sortDefault: 'asc', format: (value) => format.number(Number(value), { notation: 'compact' }) },
		{ key: 'teamValue', label: t('value'), className: 'hidden text-right text-muted-foreground md:table-cell', sortable: true, sortDefault: 'desc', format: (value) => formatMoneyValue(value == null ? null : Number(value)) },
	]

	return (
		<section aria-labelledby="tournament-standings-title">
			<div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h2 id="tournament-standings-title" className="text-xl font-bold">{t('standings')}</h2>
				<Input
					aria-label={t('searchStandings')}
					value={search}
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder={t('searchPlaceholder')}
					className="sm:max-w-xs"
				/>
			</div>
			<StatsTable data={rows} rowKeyField="entryId" columns={columns} />
		</section>
	)
}
