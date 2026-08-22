'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DeltaBadge } from '@/components/data/DeltaBadge'
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
import {
	formatMoneyValue,
	type StandingRow
} from '../_lib/tournament-stats-model'

/** Large leagues (~100 teams): preview first, load more in steps, pin You. */
const PREVIEW_ROWS = 20
const ROW_STEP = 20

type SortKey =
	| 'rank'
	| 'teamName'
	| 'gameweekPoints'
	| 'totalPoints'
	| 'overallRank'
	| 'teamValue'

type SortDir = 'asc' | 'desc'

function defaultDir(key: SortKey): SortDir {
	if (
		key === 'gameweekPoints' ||
		key === 'totalPoints' ||
		key === 'teamValue'
	) {
		return 'desc'
	}
	return 'asc'
}

function compareNullable(
	a: number | null | undefined,
	b: number | null | undefined,
	dir: SortDir
): number {
	const aNull = a == null || !Number.isFinite(a)
	const bNull = b == null || !Number.isFinite(b)
	if (aNull && bNull) return 0
	if (aNull) return 1
	if (bNull) return -1
	const cmp = (a as number) - (b as number)
	return dir === 'asc' ? cmp : -cmp
}

function sortRows(
	rows: StandingRow[],
	key: SortKey,
	dir: SortDir
): StandingRow[] {
	return [...rows].sort((a, b) => {
		if (key === 'teamName') {
			const sa = `${a.teamName}\u0000${a.managerName}`.toLowerCase()
			const sb = `${b.teamName}\u0000${b.managerName}`.toLowerCase()
			const cmp = sa.localeCompare(sb, undefined, { sensitivity: 'base' })
			return dir === 'asc' ? cmp : -cmp
		}
		if (key === 'rank') {
			return compareNullable(a.displayRank, b.displayRank, dir)
		}
		const primary = compareNullable(a[key], b[key], dir)
		if (primary !== 0) return primary
		return (
			compareNullable(a.displayRank, b.displayRank, 'asc') ||
			a.entryId - b.entryId
		)
	})
}

/** First N rows; if You is outside the window, pin at the end so you stay visible. */
function takeVisibleWithPinMe(
	sorted: StandingRow[],
	visibleCount: number
): StandingRow[] {
	if (sorted.length <= visibleCount) return sorted
	const top = sorted.slice(0, visibleCount)
	const me = sorted.find(s => s.isMe)
	if (me && !top.some(s => s.entryId === me.entryId)) {
		return [...top, me]
	}
	return top
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
	align?: 'left' | 'right' | 'center'
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
					align === 'center' && 'mx-auto',
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

function RankCell({ row }: { row: StandingRow }) {
	const t = useTranslations('TournamentStats')
	const rank = row.displayRank
	if (rank == null) {
		return <span className="text-muted-foreground">—</span>
	}
	const prev = row.previousRank
	const hasPrev = Number.isFinite(prev) && prev < Number.MAX_SAFE_INTEGER / 2
	const movement = hasPrev ? prev - rank : 0

	return (
		<div className="flex flex-col items-start gap-0.5 sm:items-center">
			<span className="font-mono tabular-nums text-muted-foreground">
				{rank}
			</span>
			{movement > 0 ? (
				<span aria-label={t('upPlaces', { count: movement })}>
					<DeltaBadge
						value={movement}
						size="sm"
						format={v => Math.abs(v)}
					/>
				</span>
			) : movement < 0 ? (
				<span aria-label={t('downPlaces', { count: Math.abs(movement) })}>
					<DeltaBadge
						value={movement}
						size="sm"
						format={v => Math.abs(v)}
					/>
				</span>
			) : null}
		</div>
	)
}

interface TournamentStandingsTabProps {
	onSearchChange: (value: string) => void
	rows: StandingRow[]
	search: string
	hasMoreServerRows?: boolean
	isLoadingServerRows?: boolean
	onLoadMoreServerRows?: () => void
}

/**
 * GW standings table — same visual language as Season field table
 * (bordered strip, sort headers, mono ranks / display numbers).
 * Progressive reveal for large fields (~100 teams); pins You when off-screen.
 */
export function TournamentStandingsTab({
	onSearchChange,
	rows,
	search,
	hasMoreServerRows = false,
	isLoadingServerRows = false,
	onLoadMoreServerRows
}: TournamentStandingsTabProps) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	const [sortKey, setSortKey] = useState<SortKey>('rank')
	const [sortDir, setSortDir] = useState<SortDir>('asc')
	const [visibleCount, setVisibleCount] = useState(PREVIEW_ROWS)

	const handleSort = (key: SortKey) => {
		if (key === sortKey) {
			setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
			return
		}
		setSortKey(key)
		setSortDir(defaultDir(key))
	}

	const sorted = useMemo(
		() => sortRows(rows, sortKey, sortDir),
		[rows, sortKey, sortDir]
	)

	// Reset window when the list identity changes (search / sort / tournament).
	useEffect(() => {
		setVisibleCount(PREVIEW_ROWS)
	}, [rows, sortKey, sortDir, search])

	const displayRows = useMemo(
		() => takeVisibleWithPinMe(sorted, visibleCount),
		[sorted, visibleCount]
	)

	const total = sorted.length
	const hasMore = total > visibleCount
	const remaining = Math.max(0, total - visibleCount)
	const canCollapse = visibleCount > PREVIEW_ROWS && total > PREVIEW_ROWS
	const nextStep = Math.min(ROW_STEP, remaining)

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				{total > PREVIEW_ROWS ? (
					<p className="text-xs text-muted-foreground">
						{t('standingsShowing', {
							shown: Math.min(visibleCount, total),
							total
						})}
					</p>
				) : (
					<span />
				)}
				<Input
					aria-label={t('searchStandings')}
					value={search}
					onChange={e => onSearchChange(e.target.value)}
					placeholder={t('searchPlaceholder')}
					className="h-9 sm:max-w-xs"
				/>
			</div>

			<DataTable
				minWidthClass="min-w-[22rem]"
				className="mx-0 rounded-lg border border-border/70 px-0"
			>
				<DataThead>
					<SortHeader
						label={t('rank')}
						active={sortKey === 'rank'}
						dir={sortDir}
						align="center"
						className="w-12 sm:w-14"
						onClick={() => handleSort('rank')}
					/>
					<SortHeader
						label={t('team')}
						active={sortKey === 'teamName'}
						dir={sortDir}
						className="min-w-[7.5rem]"
						onClick={() => handleSort('teamName')}
					/>
					<SortHeader
						label={t('gameweekPoints')}
						active={sortKey === 'gameweekPoints'}
						dir={sortDir}
						align="right"
						onClick={() => handleSort('gameweekPoints')}
					/>
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
						className="hidden md:table-cell"
						onClick={() => handleSort('teamValue')}
					/>
				</DataThead>
				<tbody>
					{displayRows.length === 0 ? (
						<DataTr>
							<DataTd
								colSpan={6}
								className="px-3 py-8 text-center text-sm text-muted-foreground"
							>
								{t('noData')}
							</DataTd>
						</DataTr>
					) : (
						displayRows.map(row => (
							<DataTr
								key={row.entryId}
								className={cn(row.isMe && 'row-self')}
							>
								<DataTd>
									<RankCell row={row} />
								</DataTd>
								<DataTd className="min-w-0">
									<p
										className={cn(
											'truncate font-medium text-foreground',
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
										{row.overallRank > 0 ? (
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
									{format.number(row.gameweekPoints)}
								</DataTd>
								<DataTd
									align="right"
									className="font-display font-bold tabular-nums"
								>
									{format.number(row.totalPoints)}
								</DataTd>
								<DataTd
									align="right"
									className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:table-cell"
								>
									{row.overallRank > 0
										? formatCompactNumber(row.overallRank)
										: '—'}
								</DataTd>
								<DataTd
									align="right"
									className="hidden font-mono text-xs tabular-nums text-muted-foreground md:table-cell"
								>
									{formatMoneyValue(row.teamValue)}
								</DataTd>
							</DataTr>
						))
					)}
				</tbody>
			</DataTable>

			{hasMore || canCollapse ? (
				<div className="flex flex-wrap items-center justify-center gap-2">
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
			{hasMoreServerRows && onLoadMoreServerRows ? (
				<div className="flex justify-center">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={isLoadingServerRows}
						onClick={onLoadMoreServerRows}
					>
						{isLoadingServerRows
							? t('loading')
							: t('standingsShowMore', { count: 100 })}
					</Button>
				</div>
			) : null}
		</div>
	)
}
