'use client'

import { Button } from '@/components/ui/button'
import {
	DataTable,
	DataTd,
	DataTh,
	DataThead,
	DataTr
} from '@/components/data/DataTable'
import { cn, formatCompactNumber } from '@/lib/utils'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import type {
	TournamentSeasonField,
	TournamentSeasonStandingRow
} from '../_lib/tournament-stats-model'

/** First N rows; if You is outside the window, pin at the end. */
function takeVisibleWithPinMe(
	sorted: TournamentSeasonStandingRow[],
	visibleCount: number
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
	dir: SortDir
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
	dir: SortDir
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
	onClick
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
		<DataTh
			align={align}
			className={className}
		>
			<button
				type="button"
				onClick={onClick}
				className={cn(
					'inline-flex items-center gap-1 rounded-sm text-caption font-medium uppercase tracking-wide',
					'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
					align === 'right' && 'ml-auto flex-row-reverse',
					active ? 'text-foreground' : 'text-muted-foreground'
				)}
				aria-sort={
					active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
				}
			>
				{label}
				<Icon
					className={cn(
						'size-3.5 shrink-0',
						active ? 'opacity-100' : 'opacity-50'
					)}
					aria-hidden="true"
				/>
			</button>
		</DataTh>
	)
}

export function TournamentSeasonField({
	field,
	hasMoreServerRows = false,
	isLoadingServerRows = false,
	onLoadMoreServerRows
}: {
	field: TournamentSeasonField | null
	hasMoreServerRows?: boolean
	isLoadingServerRows?: boolean
	onLoadMoreServerRows?: () => void
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
		[sortedStandings, visibleCount]
	)

	if (!field) {
		return (
			<section className="mb-5 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm sm:mb-6">
				<div className="px-4 py-5 sm:px-5">
					<p className="eyebrow">{t('tournamentField')}</p>
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
	const showServerMore = hasMoreServerRows && onLoadMoreServerRows !== undefined

	return (
		<section
			className="mb-5 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm sm:mb-6"
			aria-labelledby="tournament-field-title"
		>
			<div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
				<p
					id="tournament-field-title"
					className="eyebrow"
				>
					{t('tournamentField')}
				</p>
				<p className="mt-1 text-sm text-muted-foreground">
					{t('tournamentFieldAsOf', { gameweek: field.asOfGameweek })}
				</p>

				<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
					<div className="rounded-lg border border-border/70 px-3 py-2.5">
						<p className="text-caption font-medium text-muted-foreground">
							{t('fieldTeams')}
						</p>
						<p className="mt-0.5 font-display text-xl font-bold tabular-nums">
							{format.number(field.entryCount)}
						</p>
					</div>
					<div className="rounded-lg border border-border/70 px-3 py-2.5">
						<p className="text-caption font-medium text-muted-foreground">
							{t('fieldLeaderPoints')}
						</p>
						<p className="mt-0.5 font-display text-xl font-bold tabular-nums text-primary-ink">
							{field.leaderPoints == null
								? '—'
								: format.number(field.leaderPoints)}
						</p>
					</div>
					<div className="rounded-lg border border-border/70 px-3 py-2.5">
						<p className="text-caption font-medium text-muted-foreground">
							{t('fieldAveragePoints')}
						</p>
						<p className="mt-0.5 font-display text-xl font-bold tabular-nums">
							{field.averagePoints == null
								? '—'
								: format.number(field.averagePoints)}
						</p>
					</div>
					<div className="rounded-lg border border-border/70 px-3 py-2.5">
						<p className="text-caption font-medium text-muted-foreground">
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
						<p className="mb-2 eyebrow">{t('fieldLeaders')}</p>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{field.metrics.map(metric => (
								<div
									key={metric.key}
									className="rounded-lg border border-border/60 px-3 py-2.5"
								>
									<p className="text-caption font-medium text-muted-foreground">
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
										<p className="truncate text-caption text-muted-foreground">
											{metric.leaderManagerName}
										</p>
									) : null}
									<p className="mt-1 font-mono text-caption tabular-nums text-muted-foreground">
										{t('fieldMetricAverage', {
											value: metric.averageDisplay
										})}
									</p>
								</div>
							))}
						</div>
					</div>
				) : null}

				<DataTable
					minWidthClass="min-w-[20rem]"
					className="mx-0 mt-4 rounded-lg border border-border/70 px-0"
				>
					<DataThead>
						<SortHeader
							label={t('rank')}
							active={sortKey === 'rank'}
							dir={sortDir}
							className="w-10 sm:w-12"
							onClick={() => handleSort('rank')}
						/>
						<DataTh className="min-w-[7rem]">{t('team')}</DataTh>
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
					</DataThead>
					<tbody>
						{rows.map(row => (
							<DataTr
								key={row.entryId}
								className={cn(row.isMe && 'row-self')}
							>
								<DataTd className="font-mono tabular-nums text-muted-foreground">
									{row.rank == null ? '—' : format.number(row.rank)}
								</DataTd>
								<DataTd className="min-w-0">
									<p
										className={cn(
											'truncate font-medium',
											row.isMe && 'text-primary-ink'
										)}
									>
										{row.teamName}
										{row.isMe ? (
											<span className="ml-1.5 text-caption font-semibold text-primary-ink">
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
								</DataTd>
								<DataTd
									align="right"
									className="font-display font-semibold tabular-nums"
								>
									{row.totalPoints == null
										? '—'
										: format.number(row.totalPoints)}
								</DataTd>
								<DataTd
									align="right"
									className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:table-cell"
								>
									{row.overallRank == null
										? '—'
										: formatCompactNumber(row.overallRank)}
								</DataTd>
								<DataTd
									align="right"
									className="font-mono text-xs tabular-nums text-muted-foreground"
								>
									{row.teamValue == null
										? '—'
										: `£${(row.teamValue / 10).toFixed(1)}m`}
								</DataTd>
							</DataTr>
						))}
					</tbody>
				</DataTable>

				{hasMore || canCollapse || showServerMore ? (
					<div className="mt-3 flex flex-wrap items-center justify-center gap-2">
						{total > PREVIEW_ROWS ? (
							<p className="w-full text-center text-xs text-muted-foreground sm:w-auto sm:text-left">
								{t('standingsShowing', {
									shown: Math.min(visibleCount, total),
									total
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
						{showServerMore ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="text-xs"
								disabled={isLoadingServerRows}
								onClick={onLoadMoreServerRows}
							>
								{isLoadingServerRows ? t('loading') : t('standingsLoadMore')}
							</Button>
						) : null}
					</div>
				) : null}
			</div>
		</section>
	)
}
