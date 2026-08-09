'use client'

import { Button } from '@/components/ui/button'
import { cn, formatCompactNumber } from '@/lib/utils'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import type {
	TournamentSeasonField,
	TournamentSeasonStandingRow,
} from '../_lib/tournament-stats-model'

/** First N rows; if You is outside the window, pin at the end. */
function takeVisibleWithPinMe(
	sorted: TournamentSeasonStandingRow[],
	visibleCount: number,
): TournamentSeasonStandingRow[] {
	if (sorted.length <= visibleCount) return sorted
	const top = sorted.slice(0, visibleCount)
	const me = sorted.find(s => s.isMe)
	if (me && !top.some(s => s.entryId === me.entryId)) {
		return [...top, me]
	}
	return top
}

/** Large leagues (~100 teams): preview, load more in steps, pin You. */
const PREVIEW_ROWS = 15
const ROW_STEP = 20

type SortKey = 'rank' | 'totalPoints' | 'overallRank' | 'teamValue'
type SortDir = 'asc' | 'desc'

/** Default direction when switching to a column (lower-better vs higher-better). */
function defaultDir(key: SortKey): SortDir {
	if (key === 'totalPoints' || key === 'teamValue') return 'desc'
	return 'asc' // rank / overallRank: lower is better
}

function compareNullable(
	a: number | null,
	b: number | null,
	dir: SortDir,
): number {
	if (a == null && b == null) return 0
	if (a == null) return 1 // nulls last
	if (b == null) return -1
	const cmp = a - b
	return dir === 'asc' ? cmp : -cmp
}

function sortStandings(
	rows: TournamentSeasonStandingRow[],
	key: SortKey,
	dir: SortDir,
): TournamentSeasonStandingRow[] {
	return [...rows].sort((a, b) => {
		const primary = compareNullable(a[key], b[key], dir)
		if (primary !== 0) return primary
		// Stable tie-break: league rank asc, then entryId
		const rankTie = compareNullable(a.rank, b.rank, 'asc')
		if (rankTie !== 0) return rankTie
		return a.entryId - b.entryId
	})
}

function SortHeader({
	label,
	active,
	dir,
	align = 'left',
	className,
	onClick,
}: {
	label: string
	active: boolean
	dir: SortDir
	align?: 'left' | 'right'
	className?: string
	onClick: () => void
}) {
	const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
	return (
		<th
			className={cn(
				'px-2 py-2.5 font-display sm:px-3',
				align === 'right' && 'text-right',
				className,
			)}
		>
			<button
				type="button"
				onClick={onClick}
				className={cn(
					'inline-flex items-center gap-1 rounded-sm text-[11px] font-medium uppercase tracking-wide',
					'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
					align === 'right' && 'ml-auto flex-row-reverse',
					active ? 'text-foreground' : 'text-muted-foreground',
				)}
				aria-sort={
					active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
				}
			>
				{label}
				<Icon
					className={cn(
						'size-3.5 shrink-0',
						active ? 'opacity-100' : 'opacity-50',
					)}
					aria-hidden="true"
				/>
			</button>
		</th>
	)
}

export function TournamentSeasonField({
	field,
}: {
	field: TournamentSeasonField | null
}) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	const [visibleCount, setVisibleCount] = useState(PREVIEW_ROWS)
	const [sortKey, setSortKey] = useState<SortKey>('rank')
	const [sortDir, setSortDir] = useState<SortDir>('asc')

	const handleSort = (key: SortKey) => {
		if (key === sortKey) {
			setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
			return
		}
		setSortKey(key)
		setSortDir(defaultDir(key))
	}

	const sortedStandings = useMemo(() => {
		if (!field) return []
		return sortStandings(field.standings, sortKey, sortDir)
	}, [field, sortKey, sortDir])

	useEffect(() => {
		setVisibleCount(PREVIEW_ROWS)
	}, [field?.asOfGameweek, field?.entryCount, sortKey, sortDir])

	const rows = useMemo(
		() => takeVisibleWithPinMe(sortedStandings, visibleCount),
		[sortedStandings, visibleCount],
	)

	if (!field) {
		return (
			<section className="mb-5 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm sm:mb-6">
				<div className="px-4 py-5 sm:px-5">
					<p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						{t('tournamentField')}
					</p>
					<p className="mt-3 text-sm text-muted-foreground">
						{t('tournamentFieldEmpty')}
					</p>
				</div>
			</section>
		)
	}

	const total = field.standings.length
	const hasMore = total > visibleCount
	const remaining = Math.max(0, total - visibleCount)
	const canCollapse = visibleCount > PREVIEW_ROWS && total > PREVIEW_ROWS
	const nextStep = Math.min(ROW_STEP, remaining)

	return (
		<section
			className="mb-5 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm sm:mb-6"
			aria-labelledby="tournament-field-title"
		>
			<div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
				<p
					id="tournament-field-title"
					className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
				>
					{t('tournamentField')}
				</p>
				<p className="mt-1 text-sm text-muted-foreground">
					{t('tournamentFieldAsOf', { gameweek: field.asOfGameweek })}
				</p>

				<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
					<div className="rounded-lg border border-border/70 px-3 py-2.5">
						<p className="text-[11px] font-medium text-muted-foreground">
							{t('fieldTeams')}
						</p>
						<p className="mt-0.5 font-display text-xl font-bold tabular-nums">
							{format.number(field.entryCount)}
						</p>
					</div>
					<div className="rounded-lg border border-border/70 px-3 py-2.5">
						<p className="text-[11px] font-medium text-muted-foreground">
							{t('fieldLeaderPoints')}
						</p>
						<p className="mt-0.5 font-display text-xl font-bold tabular-nums text-primary-ink">
							{field.leaderPoints == null
								? '—'
								: format.number(field.leaderPoints)}
						</p>
					</div>
					<div className="rounded-lg border border-border/70 px-3 py-2.5">
						<p className="text-[11px] font-medium text-muted-foreground">
							{t('fieldAveragePoints')}
						</p>
						<p className="mt-0.5 font-display text-xl font-bold tabular-nums">
							{field.averagePoints == null
								? '—'
								: format.number(field.averagePoints)}
						</p>
					</div>
					<div className="rounded-lg border border-border/70 px-3 py-2.5">
						<p className="text-[11px] font-medium text-muted-foreground">
							{t('fieldGapFirstSecond')}
						</p>
						<p className="mt-0.5 font-display text-xl font-bold tabular-nums">
							{field.gapFirstSecond == null
								? '—'
								: format.number(field.gapFirstSecond)}
						</p>
					</div>
				</div>

				{field.metrics.length > 0 ? (
					<div className="mt-4">
						<p className="mb-2 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
							{t('fieldLeaders')}
						</p>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{field.metrics.map(metric => (
								<div
									key={metric.key}
									className="rounded-lg border border-border/60 px-3 py-2.5"
								>
									<p className="text-[11px] font-medium text-muted-foreground">
										{t(metric.labelKey as 'metricOverallPoints')}
									</p>
									<p className="mt-0.5 truncate font-display text-sm font-bold text-foreground">
										{metric.leaderTeamName ?? t('noData')}
										{metric.leaderTeamName ? (
											<>
												{' '}
												<span className="font-mono text-xs font-semibold tabular-nums text-primary-ink">
													{metric.leaderValueDisplay}
												</span>
											</>
										) : null}
									</p>
									{metric.leaderManagerName ? (
										<p className="truncate text-[11px] text-muted-foreground">
											{metric.leaderManagerName}
										</p>
									) : null}
									<p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
										{t('fieldMetricAverage', {
											value: metric.averageDisplay,
										})}
									</p>
								</div>
							))}
						</div>
					</div>
				) : null}

				<div className="mt-4 overflow-x-auto overscroll-x-contain rounded-lg border border-border/70">
					<table className="w-full min-w-[20rem] text-sm">
						<thead>
							<tr className="border-b border-border/60 bg-muted/25">
								<SortHeader
									label={t('rank')}
									active={sortKey === 'rank'}
									dir={sortDir}
									className="w-10 sm:w-12"
									onClick={() => handleSort('rank')}
								/>
								<th className="min-w-[7rem] px-2 py-2.5 text-left font-display text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:px-3">
									{t('team')}
								</th>
								<SortHeader
									label={t('totalPoints')}
									active={sortKey === 'totalPoints'}
									dir={sortDir}
									align="right"
									onClick={() => handleSort('totalPoints')}
								/>
								<SortHeader
									label={t('overallRankShort')}
									active={sortKey === 'overallRank'}
									dir={sortDir}
									align="right"
									className="hidden sm:table-cell"
									onClick={() => handleSort('overallRank')}
								/>
								<SortHeader
									label={t('value')}
									active={sortKey === 'teamValue'}
									dir={sortDir}
									align="right"
									onClick={() => handleSort('teamValue')}
								/>
							</tr>
						</thead>
						<tbody>
							{rows.map(row => (
								<tr
									key={row.entryId}
									className={cn(
										'border-t border-border/50',
										row.isMe && 'bg-primary/5 dark:bg-primary/10',
									)}
								>
									<td className="px-2 py-2.5 font-mono tabular-nums text-muted-foreground sm:px-3">
										{row.rank == null ? '—' : format.number(row.rank)}
									</td>
									<td className="min-w-0 px-2 py-2.5 sm:px-3">
										<p
											className={cn(
												'truncate font-medium',
												row.isMe && 'text-primary-ink',
											)}
										>
											{row.teamName}
											{row.isMe ? (
												<span className="ml-1.5 text-[11px] font-semibold text-primary-ink">
													{t('youBadge')}
												</span>
											) : null}
										</p>
										<p className="truncate text-xs text-muted-foreground">
											{row.managerName}
											{row.overallRank != null ? (
												<span className="sm:hidden">
													{' · '}
													{t('overallRankShort')}{' '}
													{formatCompactNumber(row.overallRank)}
												</span>
											) : null}
										</p>
									</td>
									<td className="px-2 py-2.5 text-right font-display font-semibold tabular-nums sm:px-3">
										{row.totalPoints == null
											? '—'
											: format.number(row.totalPoints)}
									</td>
									<td className="hidden px-2 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground sm:table-cell sm:px-3">
										{row.overallRank == null
											? '—'
											: formatCompactNumber(row.overallRank)}
									</td>
									<td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground sm:px-3">
										{row.teamValue == null
											? '—'
											: `£${(row.teamValue / 10).toFixed(1)}m`}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{hasMore || canCollapse ? (
					<div className="mt-3 flex flex-wrap items-center justify-center gap-2">
						{total > PREVIEW_ROWS ? (
							<p className="w-full text-center text-xs text-muted-foreground sm:w-auto sm:text-left">
								{t('standingsShowing', {
									shown: Math.min(visibleCount, total),
									total,
								})}
							</p>
						) : null}
						{hasMore ? (
							<>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="text-xs"
									onClick={() =>
										setVisibleCount(c => Math.min(c + ROW_STEP, total))
									}
								>
									{t('standingsShowMore', { count: nextStep })}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="text-xs"
									onClick={() => setVisibleCount(total)}
								>
									{t('standingsShowAll', { count: total })}
								</Button>
							</>
						) : null}
						{canCollapse ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-xs"
								onClick={() => setVisibleCount(PREVIEW_ROWS)}
							>
								{t('standingsShowLess')}
							</Button>
						) : null}
					</div>
				) : null}
			</div>
		</section>
	)
}
