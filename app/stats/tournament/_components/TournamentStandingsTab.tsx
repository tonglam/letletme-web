'use client'

import { StatsTable, type StatsTableColumn } from '@/components/data/StatsTable'
import { Input } from '@/components/ui/input'
import { formatCompactNumber } from '@/lib/utils'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { formatMoneyValue, type StandingRow } from '../_lib/tournament-stats-model'

const STANDING_COLUMNS: StatsTableColumn[] = [
	{
		key: 'rank',
		label: 'Rank',
		className: 'text-center',
		sortable: true,
		sortDefault: 'asc',
		format: (value, row) => {
			const standing = row as unknown as StandingRow
			const rank = Number(value)
			const movement = standing.previousRank - rank
			return (
				<div className="flex flex-col items-center">
					<span className="font-bold">{rank}</span>
					{movement > 0 ? (
						<span className="inline-flex items-center gap-0.5 text-xs text-success" aria-label={`Up ${movement} places`}>
							<ArrowUp className="size-3" aria-hidden="true" /> {movement}
						</span>
					) : movement < 0 ? (
						<span className="inline-flex items-center gap-0.5 text-xs text-destructive" aria-label={`Down ${Math.abs(movement)} places`}>
							<ArrowDown className="size-3" aria-hidden="true" /> {Math.abs(movement)}
						</span>
					) : (
						<span className="text-xs text-muted-foreground" aria-label="No rank change">—</span>
					)}
				</div>
			)
		},
	},
	{
		key: 'teamName',
		label: 'Team',
		sortable: true,
		sortDefault: 'asc',
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
	{ key: 'gameweekPoints', label: 'GW Points', className: 'text-center font-medium', sortable: true, sortDefault: 'desc' },
	{ key: 'totalPoints', label: 'Total Points', className: 'text-right font-bold', sortable: true, sortDefault: 'desc' },
	{
		key: 'overallRank',
		label: 'OR',
		className: 'text-right font-medium',
		sortable: true,
		sortDefault: 'asc',
		format: (value) => formatCompactNumber(Number(value)),
	},
	{
		key: 'teamValue',
		label: 'Value',
		className: 'hidden text-right text-muted-foreground md:table-cell',
		sortable: true,
		sortDefault: 'desc',
		format: (value) => formatMoneyValue(value == null ? null : Number(value)),
	},
]

interface TournamentStandingsTabProps {
	onSearchChange: (value: string) => void
	rows: StandingRow[]
	search: string
}

export function TournamentStandingsTab({ onSearchChange, rows, search }: TournamentStandingsTabProps) {
	return (
		<section aria-labelledby="tournament-standings-title">
			<div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h2 id="tournament-standings-title" className="text-xl font-bold">Standings</h2>
				<Input
					aria-label="Search tournament standings"
					value={search}
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder="Search team or manager"
					className="sm:max-w-xs"
				/>
			</div>
			<StatsTable data={rows} rowKeyField="entryId" columns={STANDING_COLUMNS} />
		</section>
	)
}
