'use client'

import { MarketLocalUpdated } from '@/components/data/MarketLocalUpdated'
import { MarketPlayerLookup } from '@/components/data/MarketPlayerLookup'
import { OwnershipSwingDesk } from '@/components/data/OwnershipSwingDesk'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { Link } from '@/i18n/navigation'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import type {
	MarketAvailabilityUpdate,
	MarketPlayer,
	MarketPriceChange,
	MarketPulse,
	MarketTransferMover,
} from '@/lib/graphql/operations/market'
import type { PlayerDirectoryItem } from '@/lib/graphql/operations/players'
import {
	availabilityBodyText,
	marketAvailabilityStatusKey,
} from '@/lib/market-availability'
import {
	getMarketCoverageMode,
	getMarketViewMode,
	shortMarketPosition,
} from '@/lib/market'
import { positionBadgeClass } from '@/lib/position-style'
import { cn } from '@/lib/utils'
import { copyTextToClipboard } from '@/app/live/points/_lib/live-points-share'
import {
	buildMarketShareUrl,
	formatPriceMovementShareText,
} from '@/app/data/market/_lib/market-price-share'
import {
	Check,
	Copy,
	HeartPulse,
	Search,
	Sparkles,
	Users,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

function marketPlayerToDirectory(player: MarketPlayer): PlayerDirectoryItem {
	return {
		id: player.playerId,
		webName: player.webName,
		position: player.position,
		price: player.price,
		selectedByPercent: player.selectedByPercent,
		team: {
			id: player.teamId,
			name: player.teamName,
			shortName: player.teamShortName,
		},
	}
}

function formatCalendarDate(value: string | null, locale: string): string {
	if (!value) return '—'
	const parsed = parseCalendarDate(value)
	if (!parsed) return value
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: CALENDAR_DATE_TIME_ZONE,
	}).format(parsed)
}

function formatOwnership(value: number, locale: string): string {
	return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`
}

function PositionBadge({ player }: { player: MarketPlayer }) {
	const position = shortMarketPosition(player.position)
	return (
		<Badge className={cn(positionBadgeClass(position), 'shrink-0 text-[10px]')}>
			{position}
		</Badge>
	)
}

function SectionTitle({
	id,
	children,
	action,
}: {
	id: string
	children: ReactNode
	action?: ReactNode
}) {
	return (
		<div className="mb-3 flex flex-col gap-2 border-b border-border/60 pb-2 sm:flex-row sm:items-start sm:justify-between">
			<div className="min-w-0">
				<h2
					id={id}
					className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
				>
					{children}
				</h2>
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	)
}

function EmptyHint({ children }: { children: ReactNode }) {
	return (
		<p className="rounded-md border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground">
			{children}
		</p>
	)
}

function PriceShareActions({
	changes,
	changeDate,
}: {
	changes: MarketPriceChange[]
	/** Calendar day for this price board (YYYY-MM-DD / ISO) */
	changeDate: string | null
}) {
	const t = useTranslations('Market')
	const [copied, setCopied] = useState(false)

	const handleCopyShare = useCallback(async () => {
		const origin =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://letletme.top'
		const pathPrefix =
			typeof window !== 'undefined'
				? window.location.pathname.startsWith('/zh-CN')
					? '/zh-CN'
					: ''
				: ''
		const shareUrl = buildMarketShareUrl(origin, pathPrefix)
		const text = formatPriceMovementShareText({
			changes,
			changeDate,
			labels: {
				title: t('priceTitle'),
				rises: t('priceRises'),
				falls: t('priceFalls'),
				none: t('shareNone'),
				footer: t('shareFooter', { url: shareUrl }),
			},
		})
		const ok = await copyTextToClipboard(text)
		if (ok) {
			setCopied(true)
			toast.success(t('shareCopied'))
			window.setTimeout(() => setCopied(false), 2000)
		} else {
			toast.error(t('shareCopyFailed'))
		}
	}, [changeDate, changes, t])

	return (
		<div className="flex shrink-0 items-center gap-1.5">
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="h-8 gap-1.5 text-xs"
				onClick={() => void handleCopyShare()}
				aria-label={t('shareCopy')}
			>
				{copied ? (
					<Check className="size-3.5 text-primary-ink" aria-hidden="true" />
				) : (
					<Copy className="size-3.5" aria-hidden="true" />
				)}
				{copied ? t('shareCopiedShort') : t('shareCopy')}
			</Button>
		</div>
	)
}

function CoverageMeta({
	coverage,
	locale,
}: {
	coverage: MarketPulse['coverage']
	locale: string
}) {
	const t = useTranslations('Market')
	const mode = getMarketCoverageMode(coverage)

	let rangeLabel: string
	switch (mode) {
		case 'empty':
			rangeLabel = t('coverageEmpty')
			break
		case 'one-day':
			rangeLabel = t('coverageOneDay', {
				date: formatCalendarDate(coverage.latestDate, locale),
			})
			break
		case 'tracking':
			rangeLabel = t('coverageTracking', {
				from: formatCalendarDate(coverage.firstDate, locale),
				to: formatCalendarDate(coverage.latestDate, locale),
			})
			break
		case 'last-14-days':
			rangeLabel = t('coverageLast14', {
				from: formatCalendarDate(coverage.firstDate, locale),
				to: formatCalendarDate(coverage.latestDate, locale),
			})
			break
	}

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
				<span>{rangeLabel}</span>
				{coverage.capturedAt ? (
					<>
						<span aria-hidden="true">·</span>
						<MarketLocalUpdated capturedAt={coverage.capturedAt} />
					</>
				) : null}
			</div>
			{mode === 'one-day' ? (
				<p className="text-xs text-muted-foreground">{t('movementNeedsAnotherDay')}</p>
			) : null}
			{mode === 'empty' ? (
				<p className="text-xs text-muted-foreground">
					{t('nextCapture', { time: '09:40 UTC+8' })}
				</p>
			) : null}
			{coverage.stale ? (
				<p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
					{t('staleWarning')}
				</p>
			) : null}
		</div>
	)
}

/**
 * Four equal-height metrics: primary number on one line, secondary caption always present.
 * Avoids mismatched 1-line vs 2-line cards (name + % was breaking the strip).
 */
function GlanceStrip({ pulse, locale }: { pulse: MarketPulse; locale: string }) {
	const t = useTranslations('Market')
	const rises = pulse.priceChanges.filter(c => c.direction === 'RISE').length
	const falls = pulse.priceChanges.filter(c => c.direction === 'FALL').length
	const topRise = pulse.ownershipMovers.risers[0] ?? null
	const topFall = pulse.ownershipMovers.fallers[0] ?? null
	const fmt = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1,
		signDisplay: 'exceptZero',
	})

	const cells: {
		label: string
		primary: string
		secondary: string
		playerId: number | null
		tone: 'default' | 'up' | 'down'
	}[] = [
		{
			label: t('glancePriceRises'),
			primary: String(rises),
			secondary: t('glanceCountUnit'),
			playerId: null,
			tone: 'default',
		},
		{
			label: t('glancePriceFalls'),
			primary: String(falls),
			secondary: t('glanceCountUnit'),
			playerId: null,
			tone: 'default',
		},
		{
			label: t('glanceTopRiser'),
			primary: topRise
				? `${fmt.format(topRise.change)}%`
				: '—',
			secondary: topRise?.player.webName ?? '—',
			playerId: topRise?.player.playerId ?? null,
			tone: 'up',
		},
		{
			label: t('glanceTopFaller'),
			primary: topFall
				? `${fmt.format(topFall.change)}%`
				: '—',
			secondary: topFall?.player.webName ?? '—',
			playerId: topFall?.player.playerId ?? null,
			tone: 'down',
		},
	]

	return (
		<section
			aria-label={t('glanceTitle')}
			className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5"
		>
			{cells.map(cell => (
				<div
					key={cell.label}
					className="flex min-h-[4.75rem] flex-col justify-between rounded-lg border border-border/70 px-3 py-2.5"
				>
					<p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
						{cell.label}
					</p>
					<div className="mt-2 min-w-0">
						<p
							className={cn(
								'truncate font-display text-xl font-bold tabular-nums tracking-tight leading-none sm:text-2xl',
								cell.tone === 'up' && 'text-success',
								cell.tone === 'down' && 'text-destructive',
							)}
						>
							{cell.primary}
						</p>
					{cell.playerId != null ? (
						<Link
							href={playerStatsHref({ p1: String(cell.playerId) })}
							className="mt-1 block truncate text-xs text-foreground underline decoration-primary/55 underline-offset-2 hover:decoration-primary"
						>
							{cell.secondary}
						</Link>
					) : (
						<p className="mt-1 truncate text-xs text-muted-foreground">
							{cell.secondary}
						</p>
					)}
					</div>
				</div>
			))}
		</section>
	)
}

function DensePlayerRow({
	player,
	trailing,
	sub,
}: {
	player: MarketPlayer
	trailing: ReactNode
	sub?: ReactNode
}) {
	return (
		<li className="flex items-center gap-2.5 border-b border-border/50 py-2.5 last:border-b-0">
			<PositionBadge player={player} />
			<div className="min-w-0 flex-1">
				<Link
					href={playerStatsHref({ p1: String(player.playerId) })}
					className="block truncate text-sm font-medium leading-tight text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
				>
					{player.webName}
				</Link>
				{sub ? (
					<p className="truncate text-[11px] text-muted-foreground">{sub}</p>
				) : (
					<p className="truncate text-[11px] text-muted-foreground">
						{player.teamShortName}
					</p>
				)}
			</div>
			<div className="shrink-0 text-right">{trailing}</div>
		</li>
	)
}

function MostSelectedColumn({
	players,
	locale,
}: {
	players: MarketPlayer[]
	locale: string
}) {
	const t = useTranslations('Market')
	if (players.length === 0) {
		return <EmptyHint>{t('noData')}</EmptyHint>
	}
	return (
		<ul className="grid gap-x-6 sm:grid-cols-2">
			{players.map(player => (
				<DensePlayerRow
					key={player.playerId}
					player={player}
					sub={`${player.teamShortName} · £${(player.price / 10).toFixed(1)}m`}
					trailing={
						<span className="font-display text-sm font-semibold tabular-nums">
							{formatOwnership(player.selectedByPercent, locale)}
						</span>
					}
				/>
			))}
		</ul>
	)
}

function PriceColumns({
	changes,
	locale,
	selectedPlayerId,
	onSelectPlayer,
}: {
	changes: MarketPriceChange[]
	locale: string
	selectedPlayerId: number | null
	onSelectPlayer: (player: MarketPlayer) => void
}) {
	const t = useTranslations('Market')
	const rises = changes.filter(c => c.direction === 'RISE')
	const falls = changes.filter(c => c.direction === 'FALL')

	if (changes.length === 0) {
		return (
			<div className="rounded-md border border-dashed border-border/70 px-3 py-5">
				<p className="text-sm font-medium">{t('pricesLockedTitle')}</p>
				<p className="mt-1 text-xs text-muted-foreground">
					{t('pricesLockedDescription')}
				</p>
			</div>
		)
	}

	const col = (items: MarketPriceChange[], rising: boolean) => (
		<div className="min-w-0 rounded-lg border border-border/60 bg-muted/15 px-3 py-3 dark:bg-muted/10">
			<p
				className={cn(
					'mb-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.12em]',
					rising ? 'text-success' : 'text-destructive',
				)}
			>
				{rising ? t('priceRises') : t('priceFalls')}
				<span className="ml-1.5 font-mono text-muted-foreground">
					({items.length})
				</span>
			</p>
			{items.length === 0 ? (
				<EmptyHint>{t('noData')}</EmptyHint>
			) : (
				<ul className="w-full">
					{items.map((change, index) => {
						const selected = change.player.playerId === selectedPlayerId
						return (
							<li
								key={`${change.player.playerId}-${change.changeDate}-${index}`}
							>
								<div
									className={cn(
										'group relative border-b border-border/40 py-2.5 last:border-b-0',
										selected && 'bg-primary/5',
									)}
								>
									<button
										type="button"
										onClick={() => onSelectPlayer(change.player)}
										className="absolute inset-0 z-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										aria-pressed={selected}
										aria-label={t('openPriceHistory', {
											name: change.player.webName,
										})}
									/>
									<div className="pointer-events-none relative z-[1] flex w-full items-center gap-2.5 group-hover:bg-background/60">
										<PositionBadge player={change.player} />
										<span className="min-w-0 flex-1">
											<Link
												href={playerStatsHref({
													p1: String(change.player.playerId),
												})}
												className="pointer-events-auto block truncate text-sm font-medium leading-tight text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
											>
												{change.player.webName}
											</Link>
											<span className="block truncate text-[11px] text-muted-foreground">
												{change.player.teamShortName}
											</span>
										</span>
										<span className="shrink-0 text-right">
										<span
											className={cn(
												'block font-display text-sm font-semibold tabular-nums leading-tight',
												rising ? 'text-success' : 'text-destructive',
											)}
										>
											{rising ? '+' : '−'}£
											{(Math.abs(change.change) / 10).toFixed(1)}m
										</span>
										<span className="block text-[10px] tabular-nums text-muted-foreground">
											£{(change.oldPrice / 10).toFixed(1)}m → £
											{(change.newPrice / 10).toFixed(1)}m
										</span>
										</span>
									</div>
								</div>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)

	return (
		<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
			{col(rises, true)}
			{col(falls, false)}
		</div>
	)
}

function TransferHeat({
	movers,
	locale,
}: {
	movers: MarketTransferMover[]
	locale: string
}) {
	const t = useTranslations('Market')
	const number = new Intl.NumberFormat(locale, { notation: 'compact' })
	if (movers.length === 0) {
		return <EmptyHint>{t('noTransferMovers')}</EmptyHint>
	}
	return (
		<ul className="grid gap-x-6 sm:grid-cols-2">
			{movers.map(mover => (
				<DensePlayerRow
					key={mover.player.playerId}
					player={mover.player}
					sub={t('transferInOut', {
						inCount: number.format(mover.transfersIn),
						outCount: number.format(mover.transfersOut),
					})}
					trailing={
						<span
							className={cn(
								'font-display text-sm font-semibold tabular-nums',
								mover.netTransfers >= 0 ? 'text-success' : 'text-destructive',
							)}
						>
							{mover.netTransfers > 0 ? '+' : ''}
							{number.format(mover.netTransfers)}
						</span>
					}
				/>
			))}
		</ul>
	)
}

function AvailabilityBlock({
	updates,
	locale,
}: {
	updates: MarketAvailabilityUpdate[]
	locale: string
}) {
	const t = useTranslations('Market')
	if (updates.length === 0) {
		return <EmptyHint>{t('noAvailabilityUpdates')}</EmptyHint>
	}
	return (
		<ul className="space-y-0 divide-y divide-border/50">
			{updates.map(update => {
				const key = marketAvailabilityStatusKey(update.status)
				const chance =
					update.chanceOfPlayingThisRound ?? update.chanceOfPlayingNextRound
				return (
					<li key={update.player.playerId} className="py-2.5 first:pt-0 last:pb-0">
						<div className="flex items-start gap-2.5">
							<PositionBadge player={update.player} />
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<Link
										href={playerStatsHref({ p1: String(update.player.playerId) })}
										className="text-sm font-medium text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
									>
										{update.player.webName}
									</Link>
									<Badge
										variant={key === 'available' ? 'secondary' : 'outline'}
										className="text-[10px]"
									>
										{t(`status.${key}`)}
									</Badge>
								</div>
								<p className="mt-0.5 text-[11px] text-muted-foreground">
									{update.player.teamShortName} ·{' '}
									{formatOwnership(update.player.selectedByPercent, locale)}{' '}
									{t('owned')}
								</p>
								<p className="mt-1.5 text-sm leading-snug text-foreground">
									{availabilityBodyText(update, k => t(k))}
								</p>
								<p className="mt-1 text-[11px] text-muted-foreground">
									{t('observedOn', {
										date: formatCalendarDate(update.observedDate, locale),
									})}
									{chance !== null
										? ` · ${t('playingChance', { chance })}`
										: ''}
								</p>
							</div>
						</div>
					</li>
				)
			})}
		</ul>
	)
}

function AvailabilityEvidence({
	highlights,
	updates,
	locale,
}: {
	highlights: MarketAvailabilityUpdate[]
	updates: MarketAvailabilityUpdate[]
	locale: string
}) {
	const t = useTranslations('Market')
	const lead = highlights.length > 0 ? highlights : updates

	return (
		<div>
			<AvailabilityBlock updates={lead} locale={locale} />
			{highlights.length > 0 && updates.length > highlights.length ? (
				<details className="mt-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
					<summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
						{t('availabilityEvidence', { count: updates.length })}
					</summary>
					<div className="mt-3 border-t border-border/50 pt-3">
						<AvailabilityBlock updates={updates} locale={locale} />
					</div>
				</details>
			) : null}
		</div>
	)
}

function NewPlayersBlock({
	items,
	locale,
}: {
	items: MarketPulse['newPlayers']
	locale: string
}) {
	const t = useTranslations('Market')
	if (items.length === 0) {
		return <EmptyHint>{t('noNewPlayers')}</EmptyHint>
	}
	return (
		<ul>
			{items.map(item => (
				<li
					key={item.player.playerId}
					className="flex items-center gap-2.5 border-b border-border/50 py-2.5 last:border-b-0"
				>
					<PositionBadge player={item.player} />
					<div className="min-w-0">
					<Link
						href={playerStatsHref({ p1: String(item.player.playerId) })}
						className="block truncate text-sm font-medium text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
					>
						{item.player.webName}
					</Link>
						<p className="text-[11px] text-muted-foreground">
							{t('firstSeen', {
								date: formatCalendarDate(item.firstObservedDate, locale),
							})}
						</p>
					</div>
				</li>
			))}
		</ul>
	)
}

/**
 * Single-scroll market desk.
 * Price board (daily) is the hero; history is drill-down inside that board.
 * Ownership / transfers / news share the same section language.
 */
export function MarketView({ pulse }: { pulse: MarketPulse }) {
	const t = useTranslations('Market')
	const locale = useLocale()
	const hasPulseData = pulse.coverage.observedDays > 0
	const [seedPlayer, setSeedPlayer] = useState<PlayerDirectoryItem | null>(null)

	/** Price board is always one calendar day — latest change in the list. */
	const priceChangeDate = useMemo(() => {
		return (
			pulse.priceChanges
				.map(c => c.changeDate)
				.sort()
				.at(-1) ??
			pulse.coverage.latestDate ??
			null
		)
	}, [pulse.coverage.latestDate, pulse.priceChanges])
	const latestPriceChanges = useMemo(
		() =>
			priceChangeDate
				? pulse.priceChanges.filter(change => change.changeDate === priceChangeDate)
				: [],
		[priceChangeDate, pulse.priceChanges],
	)
	const viewPulse = useMemo(
		() => ({ ...pulse, priceChanges: latestPriceChanges }),
		[pulse, latestPriceChanges],
	)

	const handleSelectPricePlayer = useCallback((player: MarketPlayer) => {
		setSeedPlayer(marketPlayerToDirectory(player))
	}, [])

	if (!hasPulseData) {
		return (
			<>
				<section className="mb-8 rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5">
					<CoverageMeta coverage={pulse.coverage} locale={locale} />
				</section>
				<div className="mb-8 rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5">
					<div className="flex items-start gap-3">
						<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border/60">
							<Users aria-hidden="true" className="size-4" />
						</span>
						<div>
							<h2 className="font-display text-lg font-bold tracking-tight">
								{t('trackingStartsTitle')}
							</h2>
							<p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
								{t('trackingStartsDescription', { time: '09:40 UTC+8' })}
							</p>
						</div>
					</div>
				</div>
				<section className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5">
					<SectionTitle id="market-player-lookup">
						{t('lookupTitle')}
					</SectionTitle>
					<MarketPlayerLookup />
				</section>
			</>
		)
	}

	const hasMovers =
		pulse.ownershipMovers.risers.length > 0 ||
		pulse.ownershipMovers.fallers.length > 0
	const viewMode = getMarketViewMode(viewPulse)
	const hasAvailabilityEvidence =
		pulse.availabilityUpdates.length > 0 || pulse.newPlayers.length > 0

	const priceSection = (
		<section
			key="prices"
			aria-labelledby="market-prices"
			className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
		>
			<SectionTitle
				id="market-prices"
				action={
					latestPriceChanges.length > 0 ? (
						<PriceShareActions
							changes={latestPriceChanges}
							changeDate={priceChangeDate}
						/>
					) : null
				}
			>
				{t('priceTitle')}
			</SectionTitle>
			<p className="mb-4 text-[11px] text-muted-foreground">
				{t('priceBoardMeta', {
					rises: latestPriceChanges.filter(c => c.direction === 'RISE').length,
					falls: latestPriceChanges.filter(c => c.direction === 'FALL').length,
					date: formatCalendarDate(priceChangeDate, locale) || '—',
				})}
			</p>
			<PriceColumns
				changes={latestPriceChanges}
				locale={locale}
				selectedPlayerId={seedPlayer?.id ?? null}
				onSelectPlayer={handleSelectPricePlayer}
			/>
			<div className="mt-4 border-t border-border/60 pt-3">
				<MarketPlayerLookup
				key={`${seedPlayer?.id ?? 'none'}:${latestPriceChanges.length > 0 ? 'compact' : 'open'}`}
				compact={latestPriceChanges.length > 0}
					seedPlayer={seedPlayer}
					onClearSeed={() => setSeedPlayer(null)}
				/>
			</div>
		</section>
	)

	const ownershipSection = (
		<section
			key="ownership"
			aria-labelledby="market-ownership"
			className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
		>
			<div className="space-y-6">
				<div>
					<SectionTitle id="market-most-selected">
						{t('mostSelectedTitle')}
					</SectionTitle>
					<MostSelectedColumn players={pulse.mostSelected} locale={locale} />
				</div>
				<div>
					<SectionTitle id="market-ownership">
						{t('ownershipSwing')}
					</SectionTitle>
					{pulse.coverage.observedDays < 2 ? (
						<EmptyHint>{t('movementNeedsAnotherDay')}</EmptyHint>
					) : !hasMovers ? (
						<EmptyHint>{t('noOwnershipMovement')}</EmptyHint>
					) : (
						<OwnershipSwingDesk
							risers={pulse.ownershipMovers.risers}
							fallers={pulse.ownershipMovers.fallers}
						/>
					)}
				</div>
			</div>
		</section>
	)

	const transferSection =
		pulse.transferMovers.length > 0 ? (
			<section
				key="transfers"
				aria-labelledby="market-transfers"
				className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
			>
				<SectionTitle id="market-transfers">{t('transferTitle')}</SectionTitle>
				<p className="mb-3 text-[11px] text-muted-foreground">
					{pulse.coverage.firstDate && pulse.coverage.latestDate
						? t('transferCoverage', {
								from: formatCalendarDate(pulse.coverage.firstDate, locale),
								to: formatCalendarDate(pulse.coverage.latestDate, locale),
							})
						: t('transferCoverageUnknown')}
				</p>
				<TransferHeat movers={pulse.transferMovers} locale={locale} />
			</section>
		) : null

	const availabilitySection = hasAvailabilityEvidence ? (
		<section
			key="availability"
			aria-labelledby="market-squad-status"
			className="grid gap-8 rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5 lg:grid-cols-2 lg:gap-8"
		>
			<div>
				<SectionTitle id="market-squad-status">
					<span className="inline-flex items-center gap-1.5">
						<HeartPulse className="size-3.5" aria-hidden="true" />
						{t('availabilityTitle')}
					</span>
				</SectionTitle>
				<AvailabilityEvidence
					highlights={pulse.availabilityHighlights}
					updates={pulse.availabilityUpdates}
					locale={locale}
				/>
			</div>
			{pulse.newPlayers.length > 0 ? (
				<div>
					<SectionTitle id="market-new-players">
						<span className="inline-flex items-center gap-1.5">
							<Sparkles className="size-3.5" aria-hidden="true" />
							{t('newPlayersTitle')}
						</span>
					</SectionTitle>
					<NewPlayersBlock items={pulse.newPlayers} locale={locale} />
				</div>
			) : null}
		</section>
	) : null

	const sectionById = {
		prices: priceSection,
		ownership: ownershipSection,
		transfers: transferSection,
		availability: availabilitySection,
	}
	const order =
		viewMode === 'price-led'
			? (['prices', 'ownership', 'transfers', 'availability'] as const)
			: viewMode === 'availability-led'
				? (['availability', 'prices', 'ownership', 'transfers'] as const)
				: viewMode === 'ownership-led'
					? (['ownership', 'prices', 'transfers', 'availability'] as const)
					: (['ownership', 'prices', 'availability', 'transfers'] as const)

	return (
		<div className="space-y-8">
			<section className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5">
				<CoverageMeta coverage={pulse.coverage} locale={locale} />
				<p className="mt-3 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
					{t(`viewMode.${viewMode}`)}
				</p>
			</section>
			<GlanceStrip pulse={viewPulse} locale={locale} />
			{order.map(id => sectionById[id])}
		</div>
	)
}
