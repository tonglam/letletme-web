'use client'

import { Button } from '@/components/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Link } from '@/i18n/navigation'
import { cn, formatCompactNumber } from '@/lib/utils'
import type { TournamentEntry } from '@/types/tournament'
import { ArrowDown, ArrowUp, GitCompareArrows } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { EntryCompareSheet } from './EntryCompareSheet'

interface TournamentTableProps {
	entries: TournamentEntry[]
	searchQuery: string
	tournamentId?: string
	gameweek: number
}

/** FPL money fields are tenths of £m (1005 → £100.5m). */
function formatTeamMoney(value: number | undefined): string {
	if (value === undefined || !Number.isFinite(value)) return '—'
	return `£${(value / 10).toFixed(1)}m`
}

export function TournamentTable({
	entries,
	searchQuery,
	tournamentId,
	gameweek,
}: TournamentTableProps) {
	const t = useTranslations('LiveTournament')
	const format = useFormatter()
	const [sortColumn, setSortColumn] = useState<string>('standings')
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
	/** Checkboxes only appear while compare mode is on. */
	const [compareMode, setCompareMode] = useState(false)
	const [compareSelection, setCompareSelection] = useState<TournamentEntry[]>([])
	const [isCompareOpen, setIsCompareOpen] = useState(false)

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
		{ value: 'standings', label: t('sortStandingsOrder') },
		{ value: 'gwPoints', label: t('gameweekPointsShort') },
		{ value: 'totalPoints', label: t('totalPointsShort') },
		{ value: 'overallRank', label: t('overallRankShort') },
		{ value: 'teamValue', label: t('teamValueShort') },
		{ value: 'eventCost', label: t('cost') },
	]

	const sortedEntries = useMemo(() => {
		const filtered = entries.filter(entry => {
			if (!searchQuery) return true
			const query = searchQuery.toLowerCase()
			return (
				entry.teamName.toLowerCase().includes(query) ||
				entry.managerName.toLowerCase().includes(query)
			)
		})

		return [...filtered].sort((a, b) => {
			// Stale retained rows always sort after live recalcs (any column).
			if (Boolean(a.stale) !== Boolean(b.stale)) {
				return a.stale ? 1 : -1
			}

			let valueA: number
			let valueB: number

			switch (sortColumn) {
				case 'overallRank':
					valueA =
						a.overallRank && a.overallRank > 0
							? a.overallRank
							: Number.MAX_SAFE_INTEGER
					valueB =
						b.overallRank && b.overallRank > 0
							? b.overallRank
							: Number.MAX_SAFE_INTEGER
					break
				case 'eventCost':
					valueA = a.eventCost ?? 0
					valueB = b.eventCost ?? 0
					break
				case 'gwPoints':
					valueA = a.gwPoints ?? a.livePoints
					valueB = b.gwPoints ?? b.livePoints
					break
				case 'totalPoints':
					valueA = a.totalPoints
					valueB = b.totalPoints
					break
				case 'teamValue':
					valueA = a.teamValue ?? -1
					valueB = b.teamValue ?? -1
					break
				case 'standings':
				case 'rank':
				default:
					valueA = a.rank > 0 ? a.rank : Number.MAX_SAFE_INTEGER
					valueB = b.rank > 0 ? b.rank : Number.MAX_SAFE_INTEGER
			}

			const primary =
				sortDirection === 'asc' ? valueA - valueB : valueB - valueA
			if (primary !== 0) return primary
			const rankDiff = (a.rank || 999999) - (b.rank || 999999)
			if (rankDiff !== 0) return rankDiff
			return a.id.localeCompare(b.id)
		})
	}, [entries, searchQuery, sortColumn, sortDirection])

	const formatOverallRank = (rank?: number) => {
		if (!rank || rank <= 0) return '—'
		return format.number(rank, { notation: 'compact' })
	}

	const getDefaultDirectionForColumn = (column: string): 'asc' | 'desc' => {
		if (column === 'standings' || column === 'rank' || column === 'overallRank') {
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
		return chips.length ? chips.join(' · ') : null
	}

	// optional checkbox | # | team | captain | chip | played | TV | OR | total | GW
	const desktopCols = compareMode
		? '1.25rem 2.25rem minmax(0,1.2fr) minmax(4.5rem,0.7fr) 2.5rem 3rem 3.5rem 3rem 3rem 3.5rem'
		: '2.25rem minmax(0,1.2fr) minmax(4.5rem,0.7fr) 2.5rem 3rem 3.5rem 3rem 3rem 3.5rem'

	return (
		<>
			<section className="overflow-hidden rounded-xl border border-border/80 bg-card">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">{t('sortBy')}</span>
						<Select
							value={sortColumn}
							onValueChange={nextColumn => {
								setSortColumn(nextColumn)
								setSortDirection(getDefaultDirectionForColumn(nextColumn))
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
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<button
							type="button"
							className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
							onClick={() =>
								setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
							}
						>
							{sortDirection === 'asc' ? (
								<ArrowUp className="size-3.5" aria-hidden="true" />
							) : (
								<ArrowDown className="size-3.5" aria-hidden="true" />
							)}
							{sortDirection === 'asc' ? t('ascending') : t('descending')}
						</button>
					</div>

					<div className="flex items-center gap-2">
						{!compareMode ? (
							<Button
								size="sm"
								variant="outline"
								className="h-8 gap-1.5 text-xs"
								onClick={() => setCompareMode(true)}
							>
								<GitCompareArrows className="size-3.5" aria-hidden="true" />
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
										<GitCompareArrows className="size-3.5" aria-hidden="true" />
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
					className="hidden border-b border-border/50 bg-muted/20 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:grid lg:items-center lg:gap-2"
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

				<ul className="divide-y divide-border/50">
					{sortedEntries.length > 0 ? (
						sortedEntries.map(entry => {
							const isChecked = compareSelection.some(e => e.id === entry.id)
							const isDisabled = !isChecked && compareSelection.length >= 2
							const gwPts = entry.gwPoints ?? entry.livePoints
							const hits = entry.eventCost ?? 0
							const net = entry.gwNetPoints ?? entry.livePoints
							const playedTotal =
								(entry.playersPlayed ?? 0) + (entry.playersToPlay ?? 0)
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
										entry.stale && 'opacity-60',
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
													team: entry.teamName,
												})}
											/>
										) : null}
										<span
											className={cn(
												'w-7 shrink-0 text-center font-mono text-sm tabular-nums',
												entry.rank <= 3 && entry.rank > 0
													? 'font-semibold text-primary-ink'
													: 'text-muted-foreground',
											)}
										>
											{entry.rank > 0 ? entry.rank : '—'}
										</span>
										<div className="min-w-0 flex-1">
											<Link
												href={`/live/points/${entry.id}${tournamentId ? `?tournamentId=${tournamentId}` : ''}`}
												className="block truncate text-sm font-semibold tracking-tight hover:text-primary-ink hover:underline"
											>
												{entry.teamName}
											</Link>
											<p className="mt-0.5 truncate text-xs text-muted-foreground">
												{entry.managerName}
											</p>
										</div>
										<div className="shrink-0 text-right">
											<div className="font-mono text-base font-semibold tabular-nums text-primary-ink">
												{gwPts}
											</div>
											{hits > 0 ? (
												<div className="font-mono text-[10px] text-destructive/90">
													{t('netLabel')} {net}
												</div>
											) : null}
										</div>
									</div>

									{/* Mobile secondary strip — captain/chip/metrics freed from under team name */}
									<div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-border/40 pt-2 text-[11px] text-muted-foreground lg:hidden">
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
												{entry.playersPlayed}/{playedTotal || '—'}
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
												{entry.totalPoints}
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
													team: entry.teamName,
												})}
											/>
										) : null}
										<span
											className={cn(
												'justify-self-center font-mono text-sm tabular-nums',
												entry.rank <= 3 && entry.rank > 0
													? 'font-semibold text-primary-ink'
													: 'text-muted-foreground',
											)}
										>
											{entry.rank > 0 ? entry.rank : '—'}
										</span>

										{/* Team: name + manager only */}
										<div className="min-w-0">
											<Link
												href={`/live/points/${entry.id}${tournamentId ? `?tournamentId=${tournamentId}` : ''}`}
												className="block truncate text-sm font-semibold tracking-tight hover:text-primary-ink hover:underline"
											>
												{entry.teamName}
											</Link>
											<p className="mt-0.5 truncate text-xs text-muted-foreground">
												{entry.managerName}
											</p>
										</div>

										{/* Captain column */}
										<div className="min-w-0">
											<p className="truncate text-xs font-medium text-foreground">
												{captainLabel}
											</p>
											{entry.captainPoints > 0 ? (
												<p className="font-mono text-[10px] tabular-nums text-muted-foreground">
													{entry.captainPoints} {t('ptsShort')}
												</p>
											) : null}
										</div>

										{/* Chip column */}
										<span className="justify-self-center font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
											{chips ?? '—'}
										</span>

										<span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
											{entry.playersPlayed}
											<span className="text-muted-foreground/50">
												/{playedTotal || '—'}
											</span>
										</span>
										<span className="text-right font-mono text-xs tabular-nums text-foreground/90">
											{formatTeamMoney(entry.teamValue)}
										</span>
										<span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
											{formatOverallRank(entry.overallRank)}
										</span>
										<span className="text-right font-mono text-sm tabular-nums text-foreground/90">
											{formatCompactNumber(entry.totalPoints)}
										</span>
										<div className="text-right">
											<div className="font-mono text-base font-semibold tabular-nums tracking-tight text-primary-ink">
												{gwPts}
											</div>
											{hits > 0 ? (
												<div className="font-mono text-[10px] tabular-nums text-destructive/90">
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
			</section>

			{isCompareOpen && compareSelection.length === 2 ? (
				<EntryCompareSheet
					entries={[compareSelection[0], compareSelection[1]]}
					gameweek={gameweek}
					open={isCompareOpen}
					onOpenChange={setIsCompareOpen}
				/>
			) : null}
		</>
	)
}
