'use client'

import { Button } from '@/components/ui/button'
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatPlayerValue, type TeamStatsViewModel } from '../_lib/team-stats-model'
import { TeamGameweekLink } from './TeamGameweekLink'
import { TeamMetricGrid, TeamMetricTile } from './TeamMetricTile'

type TransferFilter = 'withTransfers' | 'all'
type TransferRow = TeamStatsViewModel['transferRows'][number]
type TransferMove = TransferRow['moves'][number]

/** Week list progressive reveal (not WC/FH move list). */
const INITIAL_VISIBLE = 6
const PAGE_SIZE = 8
/**
 * Open Sheet instead of inline expand when WC/FH or many moves.
 * Ordinary small weeks stay accordion + dual panels.
 */
const SHEET_MOVE_THRESHOLD = 8

function rowGameweek(row: TransferRow): number {
	const n = Number(row.gameweek)
	return Number.isFinite(n) ? n : 0
}

function normalizeChip(raw: string | undefined): string {
	return String(raw ?? 'NONE')
		.toUpperCase()
		.replace(/[\s-]+/g, '_')
}

function isUnlimitedChip(chip: string): boolean {
	const c = normalizeChip(chip)
	return (
		c === 'WILDCARD' ||
		c === 'WC' ||
		c === 'FREE_HIT' ||
		c === 'FREEHIT' ||
		c === 'FH'
	)
}

/** WC/FH — or any week with enough moves that inline expand would flood the page. */
function shouldOpenSheet(row: TransferRow): boolean {
	const moveCount = Math.max(row.moves.length, row.transfers)
	return isUnlimitedChip(row.chip) || moveCount >= SHEET_MOVE_THRESHOLD
}

function chipLabel(
	raw: string,
	t: ReturnType<typeof useTranslations<'TeamStats'>>,
): string | null {
	const c = normalizeChip(raw)
	if (c === 'WILDCARD' || c === 'WC') return t('wildcard')
	if (c === 'FREE_HIT' || c === 'FREEHIT' || c === 'FH') return t('freeHit')
	if (c === 'BENCH_BOOST' || c === 'BB' || c === 'BBOOST' || c === 'BENCHBOOST') {
		return t('benchBoost')
	}
	if (
		c === 'TRIPLE_CAPTAIN' ||
		c === 'TC' ||
		c === '3XC' ||
		c === 'TRIPLECAPTAIN'
	) {
		return t('tripleCaptain')
	}
	return null
}

function MoveSwapDual({
	move,
	outLabel,
	inLabel,
}: {
	move: TransferMove
	outLabel: string
	inLabel: string
}) {
	return (
		<div
			className="grid items-center gap-2 sm:gap-3"
			style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)' }}
			aria-label={`${outLabel}: ${move.outName}; ${inLabel}: ${move.inName}`}
		>
			<div className="min-w-0 rounded-md surface-inset px-2.5 py-2">
				<p className="truncate text-sm font-semibold tracking-tight text-foreground">
					{move.outName}
				</p>
				<p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
					<span className="uppercase">{move.outTeam}</span>
					<span aria-hidden="true"> · </span>
					<span>{formatPlayerValue(move.outCost)}</span>
				</p>
			</div>
			<ArrowRight
				className="size-4 shrink-0 text-muted-foreground"
				aria-hidden="true"
			/>
			<div className="min-w-0 rounded-md border border-border/70 bg-card px-2.5 py-2">
				<p className="truncate text-sm font-semibold tracking-tight text-foreground">
					{move.inName}
				</p>
				<p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
					<span className="uppercase">{move.inTeam}</span>
					<span aria-hidden="true"> · </span>
					<span>{formatPlayerValue(move.inCost)}</span>
				</p>
			</div>
		</div>
	)
}

function MoveSwapCompact({
	move,
	outLabel,
	inLabel,
}: {
	move: TransferMove
	outLabel: string
	inLabel: string
}) {
	return (
		<div
			className="grid items-center gap-2 border-b border-border/40 py-2.5 last:border-b-0 sm:gap-3"
			style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)' }}
			aria-label={`${outLabel}: ${move.outName}; ${inLabel}: ${move.inName}`}
		>
			<div className="min-w-0">
				<p className="truncate text-sm font-semibold tracking-tight">
					{move.outName}
				</p>
				<p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
					<span className="uppercase">{move.outTeam}</span>
					<span aria-hidden="true"> · </span>
					<span>{formatPlayerValue(move.outCost)}</span>
				</p>
			</div>
			<ArrowRight
				className="size-3.5 shrink-0 text-muted-foreground"
				aria-hidden="true"
			/>
			<div className="min-w-0">
				<p className="truncate text-sm font-semibold tracking-tight">
					{move.inName}
				</p>
				<p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
					<span className="uppercase">{move.inTeam}</span>
					<span aria-hidden="true"> · </span>
					<span>{formatPlayerValue(move.inCost)}</span>
				</p>
			</div>
		</div>
	)
}

function TransferWeekSummary({
	row,
	chipName,
}: {
	row: TransferRow
	chipName: string | null
}) {
	const t = useTranslations('TeamStats')
	if (row.transfers === 0) {
		return (
			<span className="text-sm text-muted-foreground">{t('noTransfer')}</span>
		)
	}
	return (
		<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
			<span className="text-sm font-medium tabular-nums">
				{t('transferMoveCount', { count: row.transfers })}
			</span>
			{row.cost > 0 ? (
				<span className="font-mono text-xs font-semibold tabular-nums text-destructive">
					−{row.cost}
				</span>
			) : null}
			{chipName ? (
				<span className="rounded border border-border/80 bg-muted/40 px-1.5 py-0.5 font-display text-label font-semibold uppercase tracking-wide text-muted-foreground">
					{chipName}
				</span>
			) : null}
		</span>
	)
}

/** Full move list for Sheet — no pagination. */
function BulkMovesScrollList({ moves }: { moves: TransferMove[] }) {
	const t = useTranslations('TeamStats')
	return (
		<ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
			{moves.map((move, index) => (
				<li key={`${move.outName}-${move.inName}-${index}`}>
					<MoveSwapCompact
						move={move}
						outLabel={t('out')}
						inLabel={t('in')}
					/>
				</li>
			))}
		</ul>
	)
}

function TransferSheet({
	row,
	open,
	onOpenChange,
}: {
	row: TransferRow | null
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const t = useTranslations('TeamStats')
	if (!row) return null
	const chipName = chipLabel(row.chip, t)
	const title = chipName
		? t('transferSheetTitleChip', {
				gameweek: row.gameweek,
				chip: chipName,
			})
		: t('transferSheetTitle', { gameweek: row.gameweek })

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
			>
				<SheetHeader className="space-y-1 border-b border-border/60 px-4 py-4 pr-12 text-left sm:px-5">
					<SheetTitle className="font-display text-lg tracking-tight">
						{title}
					</SheetTitle>
					<SheetDescription className="text-sm tabular-nums">
						{t('transferMoveCount', { count: row.transfers })}
						{row.cost > 0 ? (
							<span className="ml-2 font-mono font-semibold text-destructive">
								−{row.cost}
							</span>
						) : null}
					</SheetDescription>
				</SheetHeader>
				<div className="flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-5">
					{row.moves.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							{row.transfers > 0
								? t('detailsUnavailable')
								: t('noTransfer')}
						</p>
					) : (
						<BulkMovesScrollList moves={row.moves} />
					)}
				</div>
			</SheetContent>
		</Sheet>
	)
}

function TransferRowCard({
	row,
	defaultOpen,
	onOpenSheet,
}: {
	row: TransferRow
	defaultOpen: boolean
	onOpenSheet: (row: TransferRow) => void
}) {
	const t = useTranslations('TeamStats')
	const [open, setOpen] = useState(defaultOpen)
	const chipName = chipLabel(row.chip, t)
	const sheetMode = shouldOpenSheet(row)
	const hasMoves = row.moves.length > 0
	const hasActivity = row.transfers > 0 || hasMoves

	if (!hasActivity) {
		return (
			<div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-2.5 sm:px-3.5">
				<div className="flex items-center gap-3">
					<TeamGameweekLink
						gameweek={row.gameweek}
						className="w-10 shrink-0 text-xs font-semibold text-muted-foreground hover:text-primary-ink"
					/>
					<TransferWeekSummary row={row} chipName={chipName} />
				</div>
			</div>
		)
	}

	// WC / FH / bulk → open Sheet (no inline dump, no Show more moves)
	if (sheetMode) {
		return (
			<div
				className={cn(
					'flex w-full items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5 sm:px-3.5',
					row.cost > 0 && 'border-destructive/25',
				)}
			>
				<TeamGameweekLink
					gameweek={row.gameweek}
					className="w-10 shrink-0 text-xs font-semibold text-muted-foreground hover:text-primary-ink"
				/>
				<button
					type="button"
					className="flex min-w-0 flex-1 items-center gap-3 text-left hover:bg-muted/30"
					onClick={() => onOpenSheet(row)}
				>
					<span className="min-w-0 flex-1">
						<TransferWeekSummary row={row} chipName={chipName} />
						<p className="mt-0.5 text-xs text-muted-foreground">
							{t('transferViewMoves', { count: row.transfers })}
						</p>
					</span>
					<ChevronRight
						className="size-4 shrink-0 text-muted-foreground"
						aria-hidden="true"
					/>
				</button>
			</div>
		)
	}

	// Normal week → inline accordion + dual panels
	return (
		<div
			className={cn(
				'rounded-lg border border-border/70 bg-card',
				row.cost > 0 && 'border-destructive/25',
			)}
		>
			<div className="flex w-full items-center gap-3 px-3 py-2.5 sm:px-3.5">
				<TeamGameweekLink
					gameweek={row.gameweek}
					className="w-10 shrink-0 text-xs font-semibold text-muted-foreground hover:text-primary-ink"
				/>
				<button
					type="button"
					className="flex min-w-0 flex-1 items-center gap-3 text-left hover:bg-muted/30"
					onClick={() => setOpen(v => !v)}
					aria-expanded={open}
				>
					<span className="min-w-0 flex-1">
						<TransferWeekSummary row={row} chipName={chipName} />
					</span>
					<ChevronDown
						className={cn(
							'size-4 shrink-0 text-muted-foreground transition-transform',
							open && 'rotate-180',
						)}
						aria-hidden="true"
					/>
				</button>
			</div>
			{open ? (
				<div className="border-t border-border/60 px-3 py-3 sm:px-3.5">
					{row.moves.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							{row.transfers > 0
								? t('detailsUnavailable')
								: t('noTransfer')}
						</p>
					) : (
						<ul className="space-y-2">
							{row.moves.map((move, index) => (
								<li key={`${move.outName}-${move.inName}-${index}`}>
									<MoveSwapDual
										move={move}
										outLabel={t('out')}
										inLabel={t('in')}
									/>
								</li>
							))}
						</ul>
					)}
				</div>
			) : null}
		</div>
	)
}

export function TeamTransfersTab({
	rows,
}: {
	rows: TeamStatsViewModel['transferRows']
}) {
	const t = useTranslations('TeamStats')
	const [filter, setFilter] = useState<TransferFilter>('withTransfers')
	const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
	const [sheetRow, setSheetRow] = useState<TransferRow | null>(null)
	const [sheetOpen, setSheetOpen] = useState(false)

	const summary = useMemo(() => {
		const withTransfers = rows.filter(r => r.transfers > 0)
		const totalMoves = withTransfers.reduce((s, r) => s + r.transfers, 0)
		const totalCost = rows.reduce((s, r) => s + r.cost, 0)
		return {
			withCount: withTransfers.length,
			totalMoves,
			totalCost,
			allCount: rows.length,
		}
	}, [rows])

	const filteredRows = useMemo(() => {
		const list = filter === 'all' ? rows : rows.filter(r => r.transfers > 0)
		return [...list].sort((a, b) => rowGameweek(b) - rowGameweek(a))
	}, [filter, rows])

	useEffect(() => {
		setVisibleCount(INITIAL_VISIBLE)
	}, [filter, rows])

	const shownRows = filteredRows.slice(0, visibleCount)
	const remaining = Math.max(0, filteredRows.length - visibleCount)
	const canShowMore = remaining > 0

	const openSheet = (row: TransferRow) => {
		setSheetRow(row)
		setSheetOpen(true)
	}

	if (rows.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">{t('noTransfer')}</p>
		)
	}

	return (
		<div className="space-y-4">
			<TeamMetricGrid cols={3}>
				<TeamMetricTile
					label={t('transferSummaryMoves')}
					value={summary.totalMoves}
				/>
				<TeamMetricTile
					label={t('transferSummaryHits')}
					value={summary.totalCost > 0 ? `−${summary.totalCost}` : '0'}
					tone={summary.totalCost > 0 ? 'destructive' : 'default'}
				/>
				<TeamMetricTile
					label={t('transferSummaryActiveGws')}
					value={summary.withCount}
				/>
			</TeamMetricGrid>

			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-xs text-muted-foreground">
					{filter === 'withTransfers'
						? t('transferFilterWithCount', { count: summary.withCount })
						: t('transferFilterAllCount', { count: summary.allCount })}
					{filteredRows.length > 0 ? (
						<span className="text-muted-foreground/80">
							{' · '}
							{t('transferShowingCount', {
								shown: shownRows.length,
								total: filteredRows.length,
							})}
						</span>
					) : null}
				</p>
				<div className="flex flex-wrap gap-1.5">
					<Button
						type="button"
						size="sm"
						variant={filter === 'withTransfers' ? 'default' : 'outline'}
						className="h-7 px-2.5 text-xs"
						onClick={() => setFilter('withTransfers')}
						aria-pressed={filter === 'withTransfers'}
					>
						{t('transferFilterWith')}
					</Button>
					<Button
						type="button"
						size="sm"
						variant={filter === 'all' ? 'default' : 'outline'}
						className="h-7 px-2.5 text-xs"
						onClick={() => setFilter('all')}
						aria-pressed={filter === 'all'}
					>
						{t('transferFilterAll')}
					</Button>
				</div>
			</div>

			{filteredRows.length === 0 ? (
				<div className="rounded-lg border border-dashed border-border/80 px-3 py-4 text-center">
					<p className="text-sm text-muted-foreground">
						{t('transferFilterEmpty')}
					</p>
					<Button
						type="button"
						size="sm"
						variant="link"
						className="mt-1 h-auto px-0 text-xs"
						onClick={() => setFilter('all')}
					>
						{t('transferShowAllGameweeks')}
					</Button>
				</div>
			) : (
				<>
					<div className="space-y-1.5">
						{shownRows.map(row => {
							const sheetMode = shouldOpenSheet(row)
							const defaultOpen =
								shownRows[0]?.gameweek === row.gameweek &&
								row.moves.length > 0 &&
								row.moves.length <= 2 &&
								!sheetMode &&
								row.cost === 0
							return (
								<TransferRowCard
									key={row.gameweek}
									row={row}
									defaultOpen={defaultOpen}
									onOpenSheet={openSheet}
								/>
							)
						})}
					</div>

					{canShowMore ? (
						<div className="flex flex-col items-center gap-1.5 pt-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="w-full sm:w-auto"
								onClick={() =>
									setVisibleCount(count =>
										Math.min(count + PAGE_SIZE, filteredRows.length),
									)
								}
							>
								{t('transferShowMore', {
									count: Math.min(PAGE_SIZE, remaining),
								})}
							</Button>
							{remaining > PAGE_SIZE ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 text-xs text-muted-foreground"
									onClick={() => setVisibleCount(filteredRows.length)}
								>
									{t('transferShowAllRemaining', { count: remaining })}
								</Button>
							) : null}
						</div>
					) : filteredRows.length > INITIAL_VISIBLE ? (
						<div className="flex justify-center pt-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 text-xs text-muted-foreground"
								onClick={() => setVisibleCount(INITIAL_VISIBLE)}
							>
								{t('transferShowLess')}
							</Button>
						</div>
					) : null}
				</>
			)}

			<TransferSheet
				row={sheetRow}
				open={sheetOpen}
				onOpenChange={open => {
					setSheetOpen(open)
					if (!open) setSheetRow(null)
				}}
			/>
		</div>
	)
}
