'use client'

import { ShareActions } from '@/components/share/ShareActions'
import { Button } from '@/components/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { Link } from '@/i18n/navigation'
import { cn, formatCompactNumber } from '@/lib/utils'
import {
	sortTournamentEntries,
	type TournamentSortColumn,
	type TournamentSortDirection
} from '@/lib/tournament/table-sort'
import { getPlayedPlayerLimit } from '@/lib/tournament/played-total'
import type { TournamentEntry } from '@/types/tournament'
import { ArrowDown, ArrowUp, GitCompareArrows } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState, type RefObject } from 'react'

const EntryCompareSheet = dynamic(
	() =>
		import('./EntryCompareSheet').then(mod => ({
			default: mod.EntryCompareSheet
		})),
	{ ssr: false }
)

/**
 * Large leagues (~100 teams): preview first, load more in steps, pin You.
 * Keep in sync with stats tournament standings progressive defaults.
 */
const PREVIEW_ROWS = 20
const ROW_STEP = 20

interface TournamentTableProps {
	entries: TournamentEntry[]
	searchQuery: string
	tournamentId?: string
	gameweek: number
	/** Signed-in viewer’s FPL entry — pin + highlight when off-screen */
	viewerEntryId?: number
	/** Filtered viewer row returned independently from the current server page. */
	pinnedViewerEntry?: TournamentEntry
	/** Reports the rows in the same order currently visible in the table. */
	onVisibleEntriesChange?: (entries: TournamentEntry[]) => void
	/** Optional share controls rendered beside Compare in the table toolbar. */
	shareText?: string | (() => string)
	shareImageRef?: RefObject<HTMLElement | null>
	shareTitle?: string
	/** Server-owned ordering/paging for the lightweight live board. */
	serverControl?: {
		sortColumn: TournamentSortColumn
		sortDirection: TournamentSortDirection
		onSortChange: (
			column: TournamentSortColumn,
			direction: TournamentSortDirection
		) => void
		hasMore: boolean
		filteredEntries: number
		isLoadingMore: boolean
		onLoadMore: () => void
		scoreCoreRevision: string
		onRevisionGone?: () => Promise<void>
	}
}

/** LiveCalcData exposes squad value as £m already (100.5 → £100.5m). */
function formatTeamMoney(value: number | undefined): string {
	if (value === undefined || !Number.isFinite(value)) return '—'
	return `£${value.toFixed(1)}m`
}

function isViewerEntry(
	entry: TournamentEntry,
	viewerEntryId?: number
): boolean {
	if (
		viewerEntryId == null ||
		!Number.isFinite(viewerEntryId) ||
		viewerEntryId <= 0
	) {
		return false
	}
	return entry.id === String(viewerEntryId)
}

/** First N rows; if You is outside the window, pin at the end. */
function takeVisibleWithPinMe(
	sorted: TournamentEntry[],
	visibleCount: number,
	viewerEntryId?: number
): TournamentEntry[] {
	if (sorted.length <= visibleCount) return sorted
	const top = sorted.slice(0, visibleCount)
	const me = sorted.find(e => isViewerEntry(e, viewerEntryId))
	if (me && !top.some(e => e.id === me.id)) {
		return [...top, me]
	}
	return top
}

export function TournamentTable({
	entries,
	searchQuery,
	tournamentId,
	gameweek,
	viewerEntryId,
	pinnedViewerEntry,
	onVisibleEntriesChange,
	shareText,
	shareImageRef,
	shareTitle,
	serverControl
}: TournamentTableProps) {
	const t = useTranslations('LiveTournament')
	const format = useFormatter()
	const [sortColumn, setSortColumn] = useState<TournamentSortColumn>('gwPoints')
	const [sortDirection, setSortDirection] =
		useState<TournamentSortDirection>('desc')
	/** Checkboxes only appear while compare mode is on. */
	const [compareMode, setCompareMode] = useState(false)
	const [compareSelection, setCompareSelection] = useState<TournamentEntry[]>(
		[]
	)
	const [isCompareOpen, setIsCompareOpen] = useState(false)
	const [visibleCount, setVisibleCount] = useState(PREVIEW_ROWS)

	const exitCompareMode = () => {
		setCompareMode(false)
		setCompareSelection([])
		setIsCompareOpen(false)
	}

	const toggleCompare = (entry: TournamentEntry) => {
		setCompareSelection(prev => {
			const exists = prev.find(e => e.id === entry.id)
			if (exists) return prev.filter(e => e.id !== entry.id)
			if (prev.length >= 2) return [prev[1], entry]
			return [...prev, entry]
		})
	}

	const sortOptions = [
		{ value: 'gwPoints', label: t('gameweekPointsShort') },
		{ value: 'totalPoints', label: t('totalPointsShort') },
		{ value: 'overallRank', label: t('overallRankShort') },
		{ value: 'teamValue', label: t('teamValueShort') },
		{ value: 'eventCost', label: t('cost') }
	]

	const effectiveSortColumn = serverControl?.sortColumn ?? sortColumn
	const effectiveSortDirection = serverControl?.sortDirection ?? sortDirection
	const sortedEntries = useMemo(
		() =>
			serverControl
				? entries
				: sortTournamentEntries(
						entries,
						searchQuery,
						effectiveSortColumn,
						effectiveSortDirection
					),
		[
			entries,
			searchQuery,
			effectiveSortColumn,
			effectiveSortDirection,
			serverControl
		]
	)

	useEffect(() => {
		if (!serverControl) setVisibleCount(PREVIEW_ROWS)
	}, [
		entries,
		searchQuery,
		effectiveSortColumn,
		effectiveSortDirection,
		serverControl
	])

	const visibleEntries = useMemo(() => {
		if (!serverControl)
			return takeVisibleWithPinMe(sortedEntries, visibleCount, viewerEntryId)
		if (
			!pinnedViewerEntry ||
			sortedEntries.some(entry => entry.id === pinnedViewerEntry.id)
		) {
			return sortedEntries
		}
		return [...sortedEntries, pinnedViewerEntry]
	}, [
		pinnedViewerEntry,
		serverControl,
		sortedEntries,
		viewerEntryId,
		visibleCount
	])
	useEffect(() => {
		onVisibleEntriesChange?.(visibleEntries)
	}, [onVisibleEntriesChange, visibleEntries])
	const total = serverControl?.filteredEntries ?? sortedEntries.length
	const hasMoreRows = serverControl?.hasMore ?? total > visibleCount
	const remaining = Math.max(
		0,
		total - (serverControl ? sortedEntries.length : visibleEntries.length)
	)
	const canCollapse =
		!serverControl && visibleCount > PREVIEW_ROWS && total > PREVIEW_ROWS
	const nextStep = Math.min(ROW_STEP, remaining)

	const formatOverallRank = (rank?: number) => {
		if (!rank || rank <= 0) return '—'
		return format.number(rank, { notation: 'compact' })
	}

	const getDefaultDirectionForColumn = (
		column: TournamentSortColumn
	): TournamentSortDirection => {
		if (
			column === 'standings' ||
			column === 'rank' ||
			column === 'overallRank'
		) {
			return 'asc'
		}
		return 'desc'
	}

	const chipLabel = (entry: TournamentEntry) => {
		const chips: string[] = []
		if (entry.chips.triple) chips.push('TC')
		if (entry.chips.bench) chips.push('BB')
		if (entry.chips.wildcard) chips.push('WC')
		if (entry.chips.freeHit) chips.push('FH')
		if (entry.chips.manager) chips.push('AM')
		return chips.length ? chips.join(' · ') : null
	}

	const teamHref = (entryId: string) => {
		const params = new URLSearchParams()
		if (tournamentId) params.set('tournamentId', tournamentId)
		if (Number.isInteger(gameweek) && gameweek > 0) {
			params.set('gw', String(gameweek))
		}
		const query = params.toString()
		return `/live/points/${encodeURIComponent(entryId)}${query ? `?${query}` : ''}`
	}

	// optional checkbox | # | team | captain | chip | played | TV | OR | total | GW
	const desktopCols = compareMode
		? '1.25rem 2.25rem minmax(0,1.2fr) minmax(4.5rem,0.7fr) 2.5rem 3rem 3.5rem 3rem 3rem 3.5rem'
		: '2.25rem minmax(0,1.2fr) minmax(4.5rem,0.7fr) 2.5rem 3rem 3.5rem 3rem 3rem 3.5rem'

	return (
		<>
			<section className="overflow-hidden rounded-xl border border-border/80 bg-card">
				<div
					className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3"
					data-share-exclude="true"
				>
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">{t('sortBy')}</span>
						<Select
							value={effectiveSortColumn}
							onValueChange={nextColumn => {
								const column = nextColumn as TournamentSortColumn
								const direction = getDefaultDirectionForColumn(column)
								if (serverControl) serverControl.onSortChange(column, direction)
								else {
									setSortColumn(column)
									setSortDirection(direction)
								}
							}}
						>
							<SelectTrigger
								className="h-8 w-[9.5rem] border-border/70 bg-transparent text-xs"
								aria-label={t('sortStandings')}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{sortOptions.map(option => (
									<SelectItem
										key={option.value}
										value={option.value}
									>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<button
							type="button"
							className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
							onClick={() => {
								const direction =
									effectiveSortDirection === 'asc' ? 'desc' : 'asc'
								if (serverControl)
									serverControl.onSortChange(effectiveSortColumn, direction)
								else setSortDirection(direction)
							}}
						>
							{effectiveSortDirection === 'asc' ? (
								<ArrowUp
									className="size-3.5"
									aria-hidden="true"
								/>
							) : (
								<ArrowDown
									className="size-3.5"
									aria-hidden="true"
								/>
							)}
							{effectiveSortDirection === 'asc'
								? t('ascending')
								: t('descending')}
						</button>
					</div>

					<div className="flex flex-wrap items-center justify-end gap-2">
						{shareText ? (
							<ShareActions
								text={shareText}
								imageRef={shareImageRef}
								title={shareTitle}
							/>
						) : null}
						{!compareMode ? (
							<Button
								size="sm"
								variant="outline"
								className="h-8 gap-1.5 text-xs"
								onClick={() => setCompareMode(true)}
							>
								<GitCompareArrows
									className="size-3.5"
									aria-hidden="true"
								/>
								{t('compareTeams')}
							</Button>
						) : (
							<>
								{compareSelection.length === 0 ? (
									<span className="text-xs text-muted-foreground">
										{t('comparePrompt')}
									</span>
								) : null}
								{compareSelection.length === 1 ? (
									<span className="text-xs text-muted-foreground">
										{t('compareOneMore')}
									</span>
								) : null}
								{compareSelection.length === 2 ? (
									<Button
										size="sm"
										variant="secondary"
										className="h-8 gap-1.5 text-xs"
										onClick={() => setIsCompareOpen(true)}
									>
										<GitCompareArrows
											className="size-3.5"
											aria-hidden="true"
										/>
										{t('compareCount', { count: 2 })}
									</Button>
								) : null}
								<button
									type="button"
									className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
									onClick={exitCompareMode}
								>
									{t('cancelCompare')}
								</button>
							</>
						)}
					</div>
				</div>

				{/* Desktop column headers */}
				<div
					className="eyebrow hidden border-b border-border/50 bg-muted/20 px-4 py-2 lg:grid lg:items-center lg:gap-2"
					style={{ gridTemplateColumns: desktopCols }}
				>
					{compareMode ? <span /> : null}
					<span className="text-center">#</span>
					<span>{t('team')}</span>
					<span>{t('captainShort')}</span>
					<span className="text-center">{t('chipShort')}</span>
					<span className="text-right">{t('played')}</span>
					<span className="text-right">{t('teamValueShort')}</span>
					<span className="text-right">{t('overallRankShort')}</span>
					<span className="text-right">{t('totalPointsShort')}</span>
					<span className="text-right">{t('gameweekPointsShort')}</span>
				</div>

				<ul
					key={`${effectiveSortColumn}:${effectiveSortDirection}:${searchQuery}`}
					className="divide-y divide-border/50"
				>
					{visibleEntries.length > 0 ? (
						visibleEntries.map(entry => {
							const isChecked = compareSelection.some(e => e.id === entry.id)
							const isDisabled = !isChecked && compareSelection.length >= 2
							const isMe = isViewerEntry(entry, viewerEntryId)
							const gwPts = entry.gwPoints ?? entry.livePoints ?? '—'
							const hits = entry.eventCost ?? 0
							const hitsKnown =
								entry.availability !== 'MISSING' && entry.eventCost != null
							const net = entry.gwNetPoints
							const playedTotal = getPlayedPlayerLimit(entry.chips)
							const chips = chipLabel(entry)
							const captainLabel =
								entry.captainName && entry.captainName !== 'N/A'
									? entry.captainName
									: '—'

							return (
								<li
									key={entry.id}
									className={cn(
										'px-4 py-2.5 transition-colors',
										'hover:bg-muted/30',
										isChecked && 'bg-primary/[0.04]',
										isMe && !isChecked && 'row-self',
										entry.stale && 'opacity-60'
									)}
									title={entry.stale ? t('staleRowHint') : undefined}
								>
									{/* Mobile / tablet */}
									<div className="flex items-center gap-3 lg:hidden">
										{compareMode ? (
											<input
												type="checkbox"
												checked={isChecked}
												disabled={isDisabled}
												onChange={() => toggleCompare(entry)}
												className="size-3.5 shrink-0 rounded border-muted-foreground/25 accent-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-40"
												aria-label={t('selectForComparison', {
													team: entry.teamName
												})}
											/>
										) : null}
										<span
											className={cn(
												'w-7 shrink-0 text-center font-mono text-sm tabular-nums',
												entry.rank <= 3 && entry.rank > 0
													? 'font-semibold text-primary-ink'
													: 'text-muted-foreground'
											)}
										>
											{entry.rank > 0 ? entry.rank : '—'}
										</span>
										<div className="min-w-0 flex-1">
											<Link
												href={teamHref(entry.id)}
												prefetch={false}
												className={cn(
													'block min-w-0 tracking-tight hover:text-primary-ink hover:underline underline-offset-2',
													isMe && 'text-primary-ink'
												)}
											>
												<span className="block truncate text-sm font-semibold">
													{entry.teamName}
												</span>
												<span className="mt-0.5 block truncate text-xs text-muted-foreground">
													{entry.managerName}
												</span>
											</Link>
										</div>
										<div className="shrink-0 text-right">
											<div className="font-mono text-base font-semibold tabular-nums text-primary-ink">
												{gwPts}
											</div>
							{hitsKnown && hits > 0 ? (
												<div className="font-mono text-label text-destructive/90">
													{t('netLabel')} {net ?? '—'}
												</div>
											) : null}
										</div>
									</div>

									{/* Mobile secondary strip — captain/chip/metrics freed from under team name */}
									<div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-border/40 pt-2 text-caption text-muted-foreground lg:hidden">
										<span>
											<span className="text-muted-foreground/80">C </span>
											<span className="font-medium text-foreground">
												{captainLabel}
											</span>
											{entry.captainPoints > 0 ? (
												<span className="ml-0.5 font-mono tabular-nums">
													({entry.captainPoints})
												</span>
											) : null}
										</span>
										{chips ? (
											<span className="font-mono uppercase tracking-wide">
												{chips}
											</span>
										) : null}
										<span className="font-mono tabular-nums">
											{t('played')}{' '}
											<span className="font-semibold text-foreground">
											{entry.availability === 'MISSING'
												? '—'
												: `${entry.playersPlayed}/${playedTotal}`}
											</span>
										</span>
										<span className="font-mono tabular-nums">
											{t('teamValueShort')}{' '}
											<span className="font-semibold text-foreground">
												{formatTeamMoney(entry.teamValue)}
											</span>
										</span>
										<span className="font-mono tabular-nums">
											OR{' '}
											<span className="font-semibold text-foreground">
												{formatOverallRank(entry.overallRank)}
											</span>
										</span>
										<span className="font-mono tabular-nums">
											{t('totalPointsShort')}{' '}
											<span className="font-semibold text-foreground">
												{entry.totalPoints ?? '—'}
											</span>
										</span>
									</div>

									{/* Desktop full row — opacity/title live on <li> only */}
									<div
										className="hidden items-center gap-2 lg:grid"
										style={{ gridTemplateColumns: desktopCols }}
									>
										{compareMode ? (
											<input
												type="checkbox"
												checked={isChecked}
												disabled={isDisabled}
												onChange={() => toggleCompare(entry)}
												className="size-3.5 justify-self-center rounded border-muted-foreground/25 accent-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-40"
												aria-label={t('selectForComparison', {
													team: entry.teamName
												})}
											/>
										) : null}
										<span
											className={cn(
												'justify-self-center font-mono text-sm tabular-nums',
												entry.rank <= 3 && entry.rank > 0
													? 'font-semibold text-primary-ink'
													: 'text-muted-foreground'
											)}
										>
											{entry.rank > 0 ? entry.rank : '—'}
										</span>

										{/* Team: name + manager only */}
										<div className="min-w-0">
											<Link
												href={teamHref(entry.id)}
												prefetch={false}
												className={cn(
													'block min-w-0 tracking-tight hover:text-primary-ink hover:underline underline-offset-2',
													isMe && 'text-primary-ink'
												)}
											>
												<span className="block truncate text-sm font-semibold">
													{entry.teamName}
												</span>
												<span className="mt-0.5 block truncate text-xs text-muted-foreground">
													{entry.managerName}
												</span>
											</Link>
										</div>

										{/* Captain column */}
										<div className="min-w-0">
											<p className="truncate text-xs font-medium text-foreground">
												{captainLabel}
											</p>
											{entry.captainPoints > 0 ? (
												<p className="font-mono text-label tabular-nums text-muted-foreground">
													{entry.captainPoints} {t('ptsShort')}
												</p>
											) : null}
										</div>

										{/* Chip column */}
										<span className="justify-self-center font-mono text-label font-medium uppercase tracking-wide text-muted-foreground">
											{chips ?? '—'}
										</span>

										<span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
										{entry.availability === 'MISSING' ? (
											'—'
										) : (
											<>
												{entry.playersPlayed}
												<span className="text-muted-foreground/50">
													/{playedTotal}
												</span>
											</>
										)}
										</span>
										<span className="text-right font-mono text-xs tabular-nums text-foreground/90">
											{formatTeamMoney(entry.teamValue)}
										</span>
										<span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
											{formatOverallRank(entry.overallRank)}
										</span>
										<span className="text-right font-mono text-sm tabular-nums text-foreground/90">
											{entry.totalPoints == null
												? '—'
												: formatCompactNumber(entry.totalPoints)}
										</span>
										<div className="text-right">
											<div className="font-mono text-base font-semibold tabular-nums tracking-tight text-primary-ink">
												{gwPts}
											</div>
							{hitsKnown && hits > 0 ? (
												<div className="font-mono text-label tabular-nums text-destructive/90">
													{t('netLabel')} {net}
												</div>
											) : null}
										</div>
									</div>
								</li>
							)
						})
					) : (
						<li className="px-4 py-12 text-center text-sm text-muted-foreground">
							{t('noMatchingTeams')}
						</li>
					)}
				</ul>
				{hasMoreRows || canCollapse ? (
					<div className="flex flex-col items-center gap-2 border-t border-border/50 px-4 py-3">
						{total > PREVIEW_ROWS ? (
							<p className="text-xs text-muted-foreground">
								{t('showingEntries', {
									shown: Math.min(visibleEntries.length, total),
									total
								})}
							</p>
						) : null}
						<div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto">
							{hasMoreRows ? (
								<>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="min-h-10 w-full sm:w-auto"
										onClick={() => {
											if (serverControl) serverControl.onLoadMore()
											else
												setVisibleCount(count =>
													Math.min(count + ROW_STEP, total)
												)
										}}
										disabled={serverControl?.isLoadingMore}
									>
										{t('showMoreEntries', { count: nextStep })}
									</Button>
									{!serverControl ? (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="min-h-10 w-full sm:w-auto"
											onClick={() => setVisibleCount(total)}
										>
											{t('showAllEntries', { count: total })}
										</Button>
									) : null}
								</>
							) : null}
							{canCollapse ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="min-h-10 w-full sm:w-auto"
									onClick={() => setVisibleCount(PREVIEW_ROWS)}
								>
									{t('showLessEntries')}
								</Button>
							) : null}
						</div>
					</div>
				) : null}
			</section>

			{isCompareOpen && compareSelection.length === 2 ? (
				<EntryCompareSheet
					entries={[compareSelection[0], compareSelection[1]]}
					gameweek={gameweek}
					tournamentId={
						serverControl && tournamentId ? Number(tournamentId) : undefined
					}
					scoreCoreRevision={serverControl?.scoreCoreRevision}
					onRevisionGone={serverControl?.onRevisionGone}
					open={isCompareOpen}
					onOpenChange={setIsCompareOpen}
				/>
			) : null}
		</>
	)
}
