import { MarketAvailabilityDisclosure } from './MarketAvailabilityDisclosure'
import { MarketAvailabilityList } from '@/components/data/MarketAvailabilityList'
import {
	MarketPlayerLookupLauncher,
	MarketPriceExplorer
} from './MarketPriceExplorer'
import { MarketLocalUpdated } from '@/components/data/MarketLocalUpdated'
import { OwnershipSwingDesk } from '@/components/data/OwnershipSwingDesk'
import { Badge } from '@/components/ui/badge'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { Link } from '@/i18n/navigation'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import type {
	MarketAvailabilityUpdate,
	MarketPlayer,
	MarketPulse,
	MarketTransferMover
} from '@/lib/graphql/operations/market'
import { getMarketCoverageMode, getMarketViewMode, shortMarketPosition } from '@/lib/market'
import { positionBadgeClass } from '@/lib/position-style'
import { cn } from '@/lib/utils'
import { getTranslations } from 'next-intl/server'
import { HeartPulse, Sparkles, Users } from 'lucide-react'
import type { ReactNode } from 'react'

type MarketT = (key: any, values?: any) => string

function formatCalendarDate(value: string | null, locale: string): string {
	if (!value) return '—'
	const parsed = parseCalendarDate(value)
	if (!parsed) return value
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: CALENDAR_DATE_TIME_ZONE
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
	children
}: {
	id: string
	children: ReactNode
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
		</div>
	)
}

function EmptyHint({ children }: { children: ReactNode }) {
	return (
		<p
			className="rounded-md border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground"
			role="status"
		>
			{children}
		</p>
	)
}

function DensePlayerRow({
	player,
	trailing,
	sub
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
					prefetch={false}
					href={playerStatsHref({ p1: String(player.playerId) })}
					className="block truncate text-sm font-medium leading-tight text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
				>
					{player.webName}
				</Link>
				{sub ? (
					<p className="truncate text-[11px] text-muted-foreground">{sub}</p>
				) : (
					<p className="truncate text-[11px] text-muted-foreground">{player.teamShortName}</p>
				)}
			</div>
			<div className="shrink-0 text-right">{trailing}</div>
		</li>
	)
}

function CoverageMeta({
	coverage,
	locale,
	t
}: {
	coverage: MarketPulse['coverage']
	locale: string
	t: MarketT
}) {
	const mode = getMarketCoverageMode(coverage)
	let rangeLabel: string
	switch (mode) {
		case 'empty':
			rangeLabel = t('coverageEmpty')
			break
		case 'one-day':
			rangeLabel = t('coverageOneDay', { date: formatCalendarDate(coverage.latestDate, locale) })
			break
		case 'tracking':
			rangeLabel = t('coverageTracking', {
				from: formatCalendarDate(coverage.firstDate, locale),
				to: formatCalendarDate(coverage.latestDate, locale)
			})
			break
		case 'last-14-days':
			rangeLabel = t('coverageLast14', {
				from: formatCalendarDate(coverage.firstDate, locale),
				to: formatCalendarDate(coverage.latestDate, locale)
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
				<p className="text-xs text-muted-foreground">{t('nextCapture', { time: '09:40 UTC+8' })}</p>
			) : null}
			{coverage.stale ? (
				<p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
					{t('staleWarning')}
				</p>
			) : null}
		</div>
	)
}

function GlanceStrip({
	pulse,
	locale,
	t
}: {
	pulse: MarketPulse
	locale: string
	t: MarketT
}) {
	const rises = pulse.priceChanges.filter(c => c.direction === 'RISE').length
	const falls = pulse.priceChanges.filter(c => c.direction === 'FALL').length
	const topRise = pulse.ownershipMovers.risers[0] ?? null
	const topFall = pulse.ownershipMovers.fallers[0] ?? null
	const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
	const cells = [
		{ label: t('glancePriceRises'), primary: String(rises), secondary: t('glanceCountUnit'), playerId: null, tone: 'default' },
		{ label: t('glancePriceFalls'), primary: String(falls), secondary: t('glanceCountUnit'), playerId: null, tone: 'default' },
		{ label: t('glanceTopRiser'), primary: topRise ? `${fmt.format(topRise.change)}%` : '—', secondary: topRise?.player.webName ?? '—', playerId: topRise?.player.playerId ?? null, tone: 'up' },
		{ label: t('glanceTopFaller'), primary: topFall ? `${fmt.format(topFall.change)}%` : '—', secondary: topFall?.player.webName ?? '—', playerId: topFall?.player.playerId ?? null, tone: 'down' }
	] as const

	return (
		<section aria-label={t('glanceTitle')} className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
			{cells.map(cell => (
				<div key={cell.label} className="flex min-h-[4.75rem] flex-col justify-between rounded-lg border border-border/70 px-3 py-2.5">
					<p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{cell.label}</p>
					<div className="mt-2 min-w-0">
						<p className={cn('truncate font-display text-xl font-bold tabular-nums tracking-tight leading-none sm:text-2xl', cell.tone === 'up' && 'text-success', cell.tone === 'down' && 'text-destructive')}>
							{cell.primary}
						</p>
						{cell.playerId != null ? (
							<Link prefetch={false} href={playerStatsHref({ p1: String(cell.playerId) })} className="mt-1 block truncate text-xs text-foreground underline decoration-primary/55 underline-offset-2 hover:decoration-primary">
								{cell.secondary}
							</Link>
						) : (
							<p className="mt-1 truncate text-xs text-muted-foreground">{cell.secondary}</p>
						)}
					</div>
				</div>
			))}
		</section>
	)
}

function MostSelectedColumn({ players, locale, t }: { players: MarketPlayer[]; locale: string; t: MarketT }) {
	if (players.length === 0) return <EmptyHint>{t('noData')}</EmptyHint>
	return (
		<ul className="grid gap-x-6 sm:grid-cols-2">
			{players.map(player => (
				<DensePlayerRow
					key={player.playerId}
					player={player}
					sub={`${player.teamShortName} · £${(player.price / 10).toFixed(1)}m`}
					trailing={<span className="font-display text-sm font-semibold tabular-nums">{formatOwnership(player.selectedByPercent, locale)}</span>}
				/>
			))}
		</ul>
	)
}

function TransferHeat({ movers, locale, t }: { movers: MarketTransferMover[]; locale: string; t: MarketT }) {
	const number = new Intl.NumberFormat(locale, { notation: 'compact' })
	if (movers.length === 0) return <EmptyHint>{t('noTransferMovers')}</EmptyHint>
	return (
		<ul className="grid gap-x-6 sm:grid-cols-2">
			{movers.map(mover => (
				<DensePlayerRow
					key={mover.player.playerId}
					player={mover.player}
					sub={t('transferInOut', { inCount: number.format(mover.transfersIn), outCount: number.format(mover.transfersOut) })}
					trailing={<span className={cn('font-display text-sm font-semibold tabular-nums', mover.netTransfers >= 0 ? 'text-success' : 'text-destructive')}>{mover.netTransfers > 0 ? '+' : ''}{number.format(mover.netTransfers)}</span>}
				/>
			))}
		</ul>
	)
}

function NewPlayersBlock({ items, locale, t }: { items: MarketPulse['newPlayers']; locale: string; t: MarketT }) {
	if (items.length === 0) return <EmptyHint>{t('noNewPlayers')}</EmptyHint>
	return (
		<ul>
			{items.map(item => (
				<li key={item.player.playerId} className="flex items-center gap-2.5 border-b border-border/50 py-2.5 last:border-b-0">
					<PositionBadge player={item.player} />
					<div className="min-w-0">
						<Link prefetch={false} href={playerStatsHref({ p1: String(item.player.playerId) })} className="block truncate text-sm font-medium text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary">{item.player.webName}</Link>
						<p className="text-[11px] text-muted-foreground">{t('firstSeen', { date: formatCalendarDate(item.firstObservedDate, locale) })}</p>
					</div>
				</li>
			))}
		</ul>
	)
}

export async function MarketDashboard({
	pulse,
	revision = null,
	locale
}: {
	pulse: MarketPulse
	revision?: string | null
	locale: string
}) {
	const t: MarketT = await getTranslations('Market')
	const hasPulseData = pulse.coverage.observedDays > 0
	const priceChangeDate = pulse.priceChanges.map(c => c.changeDate).sort().at(-1) ?? pulse.coverage.latestDate ?? null
	const latestPriceChanges = priceChangeDate ? pulse.priceChanges.filter(change => change.changeDate === priceChangeDate) : []
	const viewPulse = { ...pulse, priceChanges: latestPriceChanges }

	if (!hasPulseData) {
		return (
			<>
				<section className="mb-8 rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"><CoverageMeta coverage={pulse.coverage} locale={locale} t={t} /></section>
				<div className="mb-8 rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5">
					<div className="flex items-start gap-3"><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border/60"><Users aria-hidden="true" className="size-4" /></span><div><h2 className="font-display text-lg font-bold tracking-tight">{t('trackingStartsTitle')}</h2><p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{t('trackingStartsDescription', { time: '09:40 UTC+8' })}</p></div></div>
				</div>
				<section className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5">
					<SectionTitle id="market-player-lookup">{t('lookupTitle')}</SectionTitle>
					<MarketPlayerLookupLauncher
						revision={revision}
						initialOpen
					/>
				</section>
			</>
		)
	}

	const hasMovers = pulse.ownershipMovers.risers.length > 0 || pulse.ownershipMovers.fallers.length > 0
	const viewMode = getMarketViewMode(viewPulse)
	const hasAvailabilityEvidence = pulse.availabilityHighlights.length > 0 || (pulse.availabilityUpdateCount ?? pulse.availabilityUpdates.length) > 0 || pulse.newPlayers.length > 0

	const priceSection = <MarketPriceExplorer changes={latestPriceChanges} changeDate={priceChangeDate} locale={locale} revision={revision} />
	const ownershipSection = (
		<section aria-labelledby="market-ownership" className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5">
			<div className="space-y-6">
				<div><SectionTitle id="market-most-selected">{t('mostSelectedTitle')}</SectionTitle><MostSelectedColumn players={pulse.mostSelected} locale={locale} t={t} /></div>
				<div><SectionTitle id="market-ownership">{t('ownershipSwing')}</SectionTitle>{pulse.coverage.observedDays < 2 ? <EmptyHint>{t('movementNeedsAnotherDay')}</EmptyHint> : !hasMovers ? <EmptyHint>{t('noOwnershipMovement')}</EmptyHint> : <OwnershipSwingDesk risers={pulse.ownershipMovers.risers} fallers={pulse.ownershipMovers.fallers} />}</div>
			</div>
		</section>
	)
	const transferSection = pulse.transferMovers.length > 0 ? (
		<section aria-labelledby="market-transfers" className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"><SectionTitle id="market-transfers">{t('transferTitle')}</SectionTitle><p className="mb-3 text-[11px] text-muted-foreground">{pulse.coverage.firstDate && pulse.coverage.latestDate ? t('transferCoverage', { from: formatCalendarDate(pulse.coverage.firstDate, locale), to: formatCalendarDate(pulse.coverage.latestDate, locale) }) : t('transferCoverageUnknown')}</p><TransferHeat movers={pulse.transferMovers} locale={locale} t={t} /></section>
	) : null
	const availabilitySection = hasAvailabilityEvidence ? (
		<section aria-labelledby="market-squad-status" className="grid gap-8 rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5 lg:grid-cols-2 lg:gap-8">
			<div><SectionTitle id="market-squad-status"><span className="inline-flex items-center gap-1.5"><HeartPulse className="size-3.5" aria-hidden="true" />{t('availabilityTitle')}</span></SectionTitle><MarketAvailabilityList updates={pulse.availabilityHighlights} locale={locale} t={t} /><MarketAvailabilityDisclosure days={pulse.coverage.requestedDays} revision={revision} count={pulse.availabilityUpdateCount ?? pulse.availabilityUpdates.length} /></div>
			{pulse.newPlayers.length > 0 ? <div><SectionTitle id="market-new-players"><span className="inline-flex items-center gap-1.5"><Sparkles className="size-3.5" aria-hidden="true" />{t('newPlayersTitle')}</span></SectionTitle><NewPlayersBlock items={pulse.newPlayers} locale={locale} t={t} /></div> : null}
		</section>
	) : null

	const sectionById = { prices: priceSection, ownership: ownershipSection, transfers: transferSection, availability: availabilitySection }
	const order = viewMode === 'price-led' ? (['prices', 'ownership', 'transfers', 'availability'] as const) : viewMode === 'availability-led' ? (['availability', 'prices', 'ownership', 'transfers'] as const) : viewMode === 'ownership-led' ? (['ownership', 'prices', 'transfers', 'availability'] as const) : (['ownership', 'prices', 'availability', 'transfers'] as const)

	return (
		<div className="space-y-8">
			<section className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"><CoverageMeta coverage={pulse.coverage} locale={locale} t={t} /><p className="mt-3 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">{t(`viewMode.${viewMode}`)}</p></section>
			<GlanceStrip pulse={viewPulse} locale={locale} t={t} />
			{order.map(id => <div key={id}>{sectionById[id]}</div>)}
		</div>
	)
}
