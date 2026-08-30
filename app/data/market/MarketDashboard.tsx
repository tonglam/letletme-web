import { MarketAvailabilityDisclosure } from './MarketAvailabilityDisclosure'
import { MarketAvailabilityList } from '@/components/data/MarketAvailabilityList'
import { MarketPositionBadge } from '@/components/data/MarketMarkup'
import { MarketPriceExplorer } from './MarketPriceExplorer'
import { MarketPlayerSelectionProvider } from './MarketPlayerSelection'
import { MostSelectedColumn } from './MostSelectedColumn'
import { OwnershipSwingDesk } from '@/components/data/OwnershipSwingDesk'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { ShareActions } from '@/components/share/ShareActions'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import type {
	MarketAvailabilityUpdate,
	MarketPlayer,
	MarketPriceChange,
	MarketPulse,
	MarketTransferMover,
	MarketOwnershipDay,
	MarketOwnershipOverview,
	MarketOwnershipPeriod
} from '@/lib/graphql/operations/market'
import type { PriceChangeBoard } from '@/lib/graphql/operations/price-changes'
import { getMarketViewMode } from '@/lib/market'
import {
	mapLatestPriceChangeEvent,
	type PriceChangeObservedEventMetadata
} from '@/lib/price-change-observed'
import type { PriceChangeLiveSeed } from '@/lib/price-change-live-client'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { getTranslations } from 'next-intl/server'
import type { useTranslations } from 'next-intl'
import { HeartPulse, Sparkles } from 'lucide-react'
import { Suspense } from 'react'
import type { ReactNode } from 'react'

type MarketT = ReturnType<typeof useTranslations<'Market'>>

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

function formatPlayerPrice(value: number): string {
	return `£${(value / 10).toFixed(1)}m`
}

function priceChangeLiveSeed(
	board: PriceChangeBoard | null,
	priceRevision: string | null
): PriceChangeLiveSeed {
	return {
		revision: board?.revision ?? priceRevision ?? 'unavailable',
		deadline: board?.deadline ?? null,
		nextDeadlines: board?.nextDeadlines ?? []
	}
}

function priceChangeEventMetadata(
	board: PriceChangeBoard | null
): PriceChangeObservedEventMetadata | null {
	const event = board?.latestEvent
	return event
		? { deadline: event.deadline, observedAt: event.observedAt }
		: null
}

function PositionBadge({ player }: { player: MarketPlayer }) {
	return <MarketPositionBadge position={player.position} />
}

function SectionTitle({
	id,
	children,
	action
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
					className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl"
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
		<p
			className="rounded-md border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground"
			role="status"
		>
			{children}
		</p>
	)
}

function PlayerStatsAnchor({
	playerId,
	locale,
	className,
	children
}: {
	playerId: number
	locale: string
	className?: string
	children: ReactNode
}) {
	return (
		<a
			href={playerStatsHref({
				p1: String(playerId),
				localePathPrefix: locale === 'en' ? '' : `/${locale}`
			})}
			className={className}
		>
			{children}
		</a>
	)
}

function DensePlayerRow({
	player,
	locale,
	trailing,
	sub
}: {
	player: MarketPlayer
	locale: string
	trailing: ReactNode
	sub?: ReactNode
}) {
	return (
		<li className="market-dense-row">
			<PositionBadge player={player} />
			<div className="min-w-0 flex-1">
				<PlayerStatsAnchor
					playerId={player.playerId}
					locale={locale}
					className="market-player-link"
				>
					{player.webName}
				</PlayerStatsAnchor>
				{sub ? (
					<p className="market-player-subtext">{sub}</p>
				) : (
					<p className="market-player-subtext">{player.teamShortName}</p>
				)}
			</div>
			<div className="market-dense-row__trailing">{trailing}</div>
		</li>
	)
}

type OwnershipResult = MarketOwnershipOverview | MarketOwnershipDay

function ownershipPeriodLabel(
	period: OwnershipResult['period'],
	t: MarketT
): string {
	if (period === 'GAMEWEEK') return t('ownershipPeriodGameweek')
	return t('ownershipPeriodDaily')
}

function OwnershipPeriodNav({
	period,
	t
}: {
	period: MarketOwnershipPeriod
	t: MarketT
}) {
	const items: MarketOwnershipPeriod[] = ['DAILY', 'GAMEWEEK']
	return (
		<nav
			aria-label={t('ownershipPeriodLabel')}
			className="flex flex-wrap gap-2"
		>
			{items.map(item => (
				<Link
					key={item}
					href={{ pathname: '/explore/market', query: { period: item } }}
					className={cn(
						'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
						item === period
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground'
					)}
					aria-current={item === period ? 'page' : undefined}
				>
					{ownershipPeriodLabel(item, t)}
				</Link>
			))}
		</nav>
	)
}

function OwnershipCoverageMeta({
	ownership,
	locale,
	t
}: {
	ownership: OwnershipResult
	locale: string
	t: MarketT
}) {
	const coverage = ownership.coverage
	const gameweek = 'gameweek' in ownership ? ownership.gameweek : null
	const range =
		coverage.fromDate && coverage.toDate
			? t('ownershipComparisonRange', {
					from: formatCalendarDate(coverage.fromDate, locale),
					to: formatCalendarDate(coverage.toDate, locale)
				})
			: t(`ownershipStatus.${coverage.status}`)
	const missing =
		coverage.missingDates.length > 0
			? t('ownershipMissingDates', {
					dates: coverage.missingDates
						.map(date => formatCalendarDate(date, locale))
						.join(', ')
				})
			: null
	const deadline = gameweek?.deadlineTime
		? new Intl.DateTimeFormat(locale, {
				dateStyle: 'medium',
				timeStyle: 'short',
				timeZone: 'Australia/Perth'
			}).format(new Date(gameweek.deadlineTime))
		: null
	return (
		<div className="space-y-2">
			<div className="text-xs text-muted-foreground">
				<span>{range}</span>
			</div>
			{gameweek ? (
				<p className="text-xs text-muted-foreground">
					{t('ownershipGameweekMeta', {
						gameweek: gameweek.name,
						deadline: deadline ?? '—'
					})}
				</p>
			) : null}
			{missing ? (
				<p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
					{missing}
				</p>
			) : null}
			{coverage.status !== 'READY' && !missing ? (
				<p className="text-xs text-muted-foreground">
					{t(`ownershipStatus.${coverage.status}`)}
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

function OwnershipDateNav({
	dates,
	selectedDate,
	locale,
	t
}: {
	dates: string[]
	selectedDate: string | null
	locale: string
	t: MarketT
}) {
	if (dates.length === 0) return null
	return (
		<nav
			className="flex flex-wrap gap-2"
			aria-label={t('ownershipDates')}
		>
			{dates.map(date => (
				<Link
					key={date}
					href={{
						pathname: '/explore/market',
						query: { period: 'DAILY', date }
					}}
					className={cn(
						'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
						date === selectedDate
							? 'border-primary/70 bg-primary/10 text-foreground'
							: 'border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground'
					)}
					aria-current={date === selectedDate ? 'date' : undefined}
				>
					{formatCalendarDate(date, locale)}
				</Link>
			))}
		</nav>
	)
}

function TransferHeat({
	movers,
	locale,
	t
}: {
	movers: MarketTransferMover[]
	locale: string
	t: MarketT
}) {
	const number = new Intl.NumberFormat(locale, { notation: 'compact' })
	if (movers.length === 0) return <EmptyHint>{t('noTransferMovers')}</EmptyHint>
	return (
		<ul className="grid gap-x-6 sm:grid-cols-2">
			{movers.map(mover => (
				<DensePlayerRow
					key={mover.player.playerId}
					player={mover.player}
					locale={locale}
					sub={t('transferInOut', {
						inCount: number.format(mover.transfersIn),
						outCount: number.format(mover.transfersOut)
					})}
					trailing={
						<span
							className={cn(
								'font-display text-sm font-semibold tabular-nums',
								mover.netTransfers >= 0 ? 'text-success' : 'text-destructive'
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

function NewPlayersBlock({
	items,
	locale,
	t
}: {
	items: MarketPulse['newPlayers']
	locale: string
	t: MarketT
}) {
	if (items.length === 0) return <EmptyHint>{t('noNewPlayers')}</EmptyHint>
	return (
		<ul>
			{items.map(item => (
				<li
					key={item.player.playerId}
					className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border/50 py-2.5 last:border-b-0"
				>
					<PositionBadge player={item.player} />
					<div className="min-w-0">
						<PlayerStatsAnchor
							playerId={item.player.playerId}
							locale={locale}
							className="market-player-link--compact"
						>
							{item.player.webName}
						</PlayerStatsAnchor>
						<p className="market-player-subtext">
							{item.player.teamShortName} ·{' '}
							{t('firstSeen', {
								date: formatCalendarDate(item.firstObservedDate, locale)
							})}
						</p>
					</div>
					<span className="shrink-0 text-right font-display text-sm font-semibold tabular-nums text-foreground">
						{formatPlayerPrice(item.player.price)}
					</span>
				</li>
			))}
		</ul>
	)
}

async function MarketPriceSection({
	priceChangePromise,
	dailyPriceChanges,
	dailyPriceChangeDate,
	marketRevision,
	locale,
	initialOpen
}: {
	priceChangePromise: Promise<PriceChangeBoard | null>
	dailyPriceChanges: MarketPriceChange[]
	dailyPriceChangeDate: string | null
	marketRevision: string | null
	locale: string
	initialOpen: boolean
}) {
	const priceChangeBoard = await priceChangePromise
	const observedPriceChanges = priceChangeBoard
		? mapLatestPriceChangeEvent(priceChangeBoard)
		: null
	const observedEvent = priceChangeEventMetadata(priceChangeBoard)
	const liveSeed = priceChangeLiveSeed(
		priceChangeBoard,
		observedPriceChanges?.eventRevision ?? null
	)
	const latestPriceChanges = observedPriceChanges
		? [...observedPriceChanges.rises, ...observedPriceChanges.falls]
		: dailyPriceChanges
	return (
		<MarketPriceExplorer
			changes={latestPriceChanges}
			changeDate={observedPriceChanges?.changeDate ?? dailyPriceChangeDate}
			observedAt={observedPriceChanges?.observedAt ?? null}
			locale={locale}
			marketRevision={marketRevision}
			priceRevision={observedPriceChanges?.eventRevision ?? null}
			liveSeed={liveSeed}
			observedEvent={observedEvent}
			initialLiveState={
				priceChangeBoard?.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'DURABLE'
			}
			initialOpen={initialOpen}
		/>
	)
}

function MarketPriceSectionFallback({
	changes,
	changeDate,
	locale,
	t
}: {
	changes: MarketPriceChange[]
	changeDate: string | null
	locale: string
	t: MarketT
}) {
	const rises = changes.filter(change => change.direction === 'RISE')
	const falls = changes.filter(change => change.direction === 'FALL')
	const column = (items: MarketPriceChange[], rising: boolean) => (
		<div className="min-w-0 rounded-lg border border-border/60 bg-muted/15 px-3 py-3 dark:bg-muted/10">
			<p
				className={cn(
					'mb-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.12em]',
					rising ? 'text-success' : 'text-destructive'
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
					{items.map(change => (
						<li
							key={`${change.player.playerId}-${change.changeDate}-${change.direction}`}
							className="border-b border-border/40 py-2.5 last:border-b-0"
						>
							<div className="flex w-full items-center gap-2.5">
								<PositionBadge player={change.player} />
								<span className="min-w-0 flex-1">
									<PlayerStatsAnchor
										playerId={change.player.playerId}
										locale={locale}
										className="market-player-link"
									>
										{change.player.webName}
									</PlayerStatsAnchor>
									<span className="block truncate text-[11px] text-muted-foreground">
										{change.player.teamShortName}
									</span>
								</span>
								<span className="shrink-0 text-right">
									<span
										className={cn(
											'block font-display text-sm font-semibold tabular-nums leading-tight',
											rising ? 'text-success' : 'text-destructive'
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
						</li>
					))}
				</ul>
			)}
		</div>
	)

	return (
		<section
			aria-labelledby="market-prices"
			aria-busy="true"
			className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
		>
			<SectionTitle id="market-prices">{t('priceTitle')}</SectionTitle>
			<p className="mb-4 text-[11px] text-muted-foreground">
				{t('priceBoardMeta', {
					rises: rises.length,
					falls: falls.length,
					date: formatCalendarDate(changeDate, locale)
				})}
			</p>
			<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
				{column(rises, true)}
				{column(falls, false)}
			</div>
		</section>
	)
}

export async function MarketDashboard({
	pulse,
	ownership,
	requestedPeriod,
	requestedDate,
	dailyDates,
	marketRevision = null,
	priceChangeBoard = null,
	priceChangePromise,
	locale,
	glance
}: {
	pulse: MarketPulse | null
	ownership: OwnershipResult | null
	requestedPeriod: MarketOwnershipPeriod
	requestedDate: string | null
	dailyDates: string[]
	marketRevision?: string | null
	priceChangeBoard?: PriceChangeBoard | null
	priceChangePromise?: Promise<PriceChangeBoard | null>
	locale: string
	glance?: ReactNode
}) {
	const t: MarketT = await getTranslations('Market')
	const tExplore = await getTranslations('MarketExplore')
	const observedPriceChanges = priceChangeBoard
		? mapLatestPriceChangeEvent(priceChangeBoard)
		: null
	const dailyPriceChangeDate = pulse
		? (pulse.priceChanges
				.map(c => c.changeDate)
				.sort()
				.at(-1) ??
			pulse.coverage.latestDate ??
			null)
		: null
	const dailyPriceChanges = dailyPriceChangeDate
		? (pulse?.priceChanges ?? []).filter(
				change => change.changeDate === dailyPriceChangeDate
			)
		: []
	const latestPriceChanges = observedPriceChanges
		? [...observedPriceChanges.rises, ...observedPriceChanges.falls]
		: dailyPriceChanges
	const priceChangeDate =
		observedPriceChanges?.changeDate ?? dailyPriceChangeDate
	const priceObservedAt = observedPriceChanges?.observedAt ?? null
	const priceRevision = observedPriceChanges?.eventRevision ?? null
	const priceLiveSeed = priceChangeLiveSeed(priceChangeBoard, priceRevision)
	const priceEventMetadata = priceChangeEventMetadata(priceChangeBoard)
	const hasMovers =
		ownership !== null &&
		(ownership.risers.length > 0 || ownership.fallers.length > 0)
	const viewMode = pulse ? getMarketViewMode(pulse, hasMovers) : 'ownership-led'
	const hasAvailabilityEvidence =
		pulse !== null &&
		(pulse.availabilityHighlights.length > 0 ||
			(pulse.availabilityUpdateCount ?? pulse.availabilityUpdates.length) > 0 ||
			pulse.newPlayers.length > 0)
	const dailySelectedDate =
		ownership?.period === 'DAILY'
			? 'date' in ownership
				? ownership.date
				: ownership.coverage.toDate
			: (requestedDate ?? dailyDates.at(-1) ?? null)

	const dailyPriceSection = pulse ? (
		<MarketPriceSectionFallback
			changes={dailyPriceChanges}
			changeDate={dailyPriceChangeDate}
			locale={locale}
			t={t}
		/>
	) : null
	const priceSection = priceChangePromise ? (
		<Suspense fallback={dailyPriceSection}>
			<MarketPriceSection
				priceChangePromise={priceChangePromise}
				dailyPriceChanges={dailyPriceChanges}
				dailyPriceChangeDate={dailyPriceChangeDate}
				marketRevision={marketRevision}
				locale={locale}
				initialOpen={!pulse}
			/>
		</Suspense>
	) : pulse || priceChangeBoard ? (
		<MarketPriceExplorer
			changes={latestPriceChanges}
			changeDate={priceChangeDate}
			observedAt={priceObservedAt}
			locale={locale}
			marketRevision={marketRevision}
			priceRevision={priceRevision}
			liveSeed={priceLiveSeed}
			observedEvent={priceEventMetadata}
			initialLiveState={
				priceChangeBoard?.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'DURABLE'
			}
			initialOpen={!pulse}
		/>
	) : null
	const ownershipSection = (
		<section
			aria-label={t('ownershipSwing')}
			className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
		>
			<div className="space-y-6">
				<div
					id="market-ownership-share"
					data-share-preserve-width="true"
				>
					<SectionTitle
						id="market-ownership"
						action={
							<ShareActions
								actions={['image']}
								imageTargetId="market-ownership-share"
								title={t('ownershipSwing')}
							/>
						}
					>
						{t('ownershipSwing')}
					</SectionTitle>
					<div className="mb-4 space-y-3">
						<OwnershipPeriodNav
							period={ownership?.period ?? requestedPeriod}
							t={t}
						/>
						{requestedPeriod === 'DAILY' && dailyDates.length > 0 ? (
							<OwnershipDateNav
								dates={dailyDates}
								selectedDate={dailySelectedDate}
								locale={locale}
								t={t}
							/>
						) : null}
						{ownership ? (
							<OwnershipCoverageMeta
								ownership={ownership}
								locale={locale}
								t={t}
							/>
						) : null}
					</div>
					{ownership ? (
						!['READY', 'PARTIAL'].includes(ownership.coverage.status) ? (
							<EmptyHint>
								{t(`ownershipStatus.${ownership.coverage.status}`)}
							</EmptyHint>
						) : !hasMovers ? (
							<EmptyHint>{t('noOwnershipMovement')}</EmptyHint>
						) : (
							<OwnershipSwingDesk
								risers={ownership.risers}
								fallers={ownership.fallers}
							/>
						)
					) : (
						<EmptyHint>{t('ownershipDataUnavailable')}</EmptyHint>
					)}
				</div>
				<div
					id="market-most-selected-share"
					data-share-preserve-width="true"
				>
					<MostSelectedColumn
						players={pulse?.mostSelected ?? []}
						locale={locale}
					/>
				</div>
			</div>
		</section>
	)
	const transferSection =
		pulse && pulse.transferMovers.length > 0 ? (
			<section
				aria-labelledby="market-transfers"
				id="market-transfers-share"
				data-share-preserve-width="true"
				className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
			>
				<SectionTitle
					id="market-transfers"
					action={
						<ShareActions
							actions={['image']}
							imageTargetId="market-transfers-share"
							title={t('transferTitle')}
						/>
					}
				>
					{t('transferTitle')}
				</SectionTitle>
				<p className="mb-3 text-[11px] text-muted-foreground">
					{pulse.coverage.firstDate && pulse.coverage.latestDate
						? t('transferCoverage', {
								from: formatCalendarDate(pulse.coverage.firstDate, locale),
								to: formatCalendarDate(pulse.coverage.latestDate, locale)
							})
						: t('transferCoverageUnknown')}
				</p>
				<TransferHeat
					movers={pulse.transferMovers}
					locale={locale}
					t={t}
				/>
			</section>
		) : null
	const availabilitySection = hasAvailabilityEvidence ? (
		<section
			aria-label={t('availabilityTitle')}
			className="grid gap-8 rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5 lg:grid-cols-2 lg:gap-8"
		>
			<div
				id="market-squad-status-share"
				data-share-preserve-width="true"
			>
				<SectionTitle
					id="market-squad-status"
					action={
						<ShareActions
							actions={['image']}
							imageTargetId="market-squad-status-share"
							title={t('availabilityTitle')}
						/>
					}
				>
					<span className="inline-flex items-center gap-1.5">
						<HeartPulse
							className="size-3.5"
							aria-hidden="true"
						/>
						{t('availabilityTitle')}
						<span className="text-sm font-semibold text-muted-foreground">
							·{' '}
							{tExplore('availabilityWindow', {
								days: pulse?.coverage.requestedDays ?? 7
							})}
						</span>
					</span>
				</SectionTitle>
				<MarketAvailabilityList
					updates={pulse?.availabilityHighlights ?? []}
					locale={locale}
					t={t}
				/>
				<MarketAvailabilityDisclosure
					days={pulse?.coverage.requestedDays ?? 7}
					revision={marketRevision}
					count={
						pulse?.availabilityUpdateCount ??
						pulse?.availabilityUpdates.length ??
						0
					}
				/>
			</div>
			{(pulse?.newPlayers.length ?? 0) > 0 ? (
				<div
					id="market-new-players-share"
					data-share-preserve-width="true"
				>
					<SectionTitle
						id="market-new-players"
						action={
							<ShareActions
								actions={['image']}
								imageTargetId="market-new-players-share"
								title={t('newPlayersTitle')}
							/>
						}
					>
						<span className="inline-flex items-center gap-1.5">
							<Sparkles
								className="size-3.5"
								aria-hidden="true"
							/>
							{t('newPlayersTitle')}
						</span>
					</SectionTitle>
					<NewPlayersBlock
						items={pulse.newPlayers}
						locale={locale}
						t={t}
					/>
				</div>
			) : null}
		</section>
	) : null

	const order =
		viewMode === 'price-led'
			? (['prices', 'ownership', 'transfers', 'availability'] as const)
			: viewMode === 'availability-led'
				? (['availability', 'prices', 'ownership', 'transfers'] as const)
				: viewMode === 'ownership-led'
					? (['ownership', 'prices', 'transfers', 'availability'] as const)
					: (['ownership', 'prices', 'availability', 'transfers'] as const)
	const sectionById: Record<(typeof order)[number], ReactNode | null> = {
		prices: priceSection,
		ownership: ownershipSection,
		transfers: transferSection,
		availability: availabilitySection
	}

	return (
		<MarketPlayerSelectionProvider>
			<div className="space-y-8">
				{glance}
				{order.map(id => (
					<section key={id}>{sectionById[id]}</section>
				))}
			</div>
		</MarketPlayerSelectionProvider>
	)
}

export { MarketGlance } from './MarketGlance'
