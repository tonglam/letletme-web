import { MarketAvailabilityDisclosure } from './MarketAvailabilityDisclosure'
import { MarketAvailabilityList } from '@/components/data/MarketAvailabilityList'
import { MarketPositionBadge } from '@/components/data/MarketMarkup'
import { MarketPriceExplorer } from './MarketPriceExplorer'
import { OwnershipSwingDesk } from '@/components/data/OwnershipSwingDesk'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import type {
	MarketAvailabilityUpdate,
	MarketPlayer,
	MarketPulse,
	MarketTransferMover,
	MarketOwnershipDay,
	MarketOwnershipChange,
	MarketOwnershipOverview,
	MarketOwnershipPeriod
} from '@/lib/graphql/operations/market'
import type { PriceChangeBoard } from '@/lib/graphql/operations/price-changes'
import { getMarketViewMode } from '@/lib/market'
import { mapLatestPriceChangeEvent } from '@/lib/price-change-observed'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { getTranslations } from 'next-intl/server'
import type { useTranslations } from 'next-intl'
import { HeartPulse, Sparkles } from 'lucide-react'
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

function formatOwnership(value: number, locale: string): string {
	return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`
}

function formatPlayerPrice(value: number): string {
	return `£${(value / 10).toFixed(1)}m`
}

function PositionBadge({ player }: { player: MarketPlayer }) {
	return <MarketPositionBadge position={player.position} />
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
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

function CoverageMeta({
	coverage,
	locale,
	t
}: {
	coverage: MarketPulse['coverage']
	locale: string
	t: MarketT
}) {
	const rangeLabel =
		coverage.observedDays === 0
			? t('coverageEmpty')
			: coverage.firstDate && coverage.latestDate
				? t('coverageTracking', {
						from: formatCalendarDate(coverage.firstDate, locale),
						to: formatCalendarDate(coverage.latestDate, locale)
					})
				: t('coverageEmpty')

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
				<span>{rangeLabel}</span>
			</div>
			<p className="text-xs text-muted-foreground">
				{t('ownershipObservedDays', {
					observed: coverage.observedDays,
					requested: coverage.requestedDays
				})}
			</p>
			{coverage.missingDates.length > 0 ? (
				<p className="text-xs text-muted-foreground">
					{t('ownershipMissingDates', {
						dates: coverage.missingDates
							.map(date => formatCalendarDate(date, locale))
							.join(', ')
					})}
				</p>
			) : null}
			{coverage.observedDays === 1 ? (
				<p className="text-xs text-muted-foreground">
					{t('movementNeedsAnotherDay')}
				</p>
			) : null}
			{coverage.observedDays === 0 ? (
				<p className="text-xs text-muted-foreground">
					{t('nextCapture', { time: '09:25–09:35 UTC+8' })}
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
			<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
				<span>{range}</span>
				<span aria-hidden="true">·</span>
				<span>
					{t('ownershipObservedDays', {
						observed: coverage.observedDays,
						requested: coverage.requestedDays
					})}
				</span>
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

function GlanceStrip({
	dailyOwnership,
	gameweekOwnership,
	locale,
	t
}: {
	dailyOwnership: MarketOwnershipOverview | null
	gameweekOwnership: MarketOwnershipOverview | null
	locale: string
	t: MarketT
}) {
	const fmt = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1,
		signDisplay: 'exceptZero'
	})
	const cells = [
		{
			label: t('glanceTodayOwnershipRises'),
			change: dailyOwnership?.risers[0] ?? null,
			tone: 'up'
		},
		{
			label: t('glanceTodayOwnershipFalls'),
			change: dailyOwnership?.fallers[0] ?? null,
			tone: 'down'
		},
		{
			label: t('glanceGameweekOwnershipRises'),
			change: gameweekOwnership?.risers[0] ?? null,
			tone: 'up'
		},
		{
			label: t('glanceGameweekOwnershipFalls'),
			change: gameweekOwnership?.fallers[0] ?? null,
			tone: 'down'
		}
	].map(cell => {
		const change: MarketOwnershipChange | null = cell.change
		return {
			...cell,
			primary: change
				? t('ownershipPercentagePoints', {
						value: fmt.format(change.changePercentagePoints)
					})
				: '—',
			secondary: change?.player.webName ?? '—',
			playerId: change?.player.playerId ?? null
		}
	})

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
								cell.tone === 'down' && 'text-destructive'
							)}
						>
							{cell.primary}
						</p>
						{cell.playerId != null ? (
							<PlayerStatsAnchor
								playerId={cell.playerId}
								locale={locale}
								className="mt-1 block whitespace-normal text-xs text-foreground underline decoration-primary/55 underline-offset-2 hover:decoration-primary"
							>
								{cell.secondary}
							</PlayerStatsAnchor>
						) : (
							<p className="mt-1 whitespace-normal text-xs text-muted-foreground">
								{cell.secondary}
							</p>
						)}
					</div>
				</div>
			))}
		</section>
	)
}

function MostSelectedColumn({
	players,
	locale,
	t
}: {
	players: MarketPlayer[]
	locale: string
	t: MarketT
}) {
	if (players.length === 0) return <EmptyHint>{t('noData')}</EmptyHint>
	return (
		<ul className="grid gap-x-6 sm:grid-cols-2">
			{players.map(player => (
				<DensePlayerRow
					key={player.playerId}
					player={player}
					locale={locale}
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

export async function MarketDashboard({
	pulse,
	ownership,
	requestedPeriod,
	requestedDate,
	dailyDates,
	marketRevision = null,
	priceChangeBoard = null,
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
	locale: string
	glance?: ReactNode
}) {
	const t: MarketT = await getTranslations('Market')
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

	const priceSection =
		pulse || priceChangeBoard ? (
			<MarketPriceExplorer
				changes={latestPriceChanges}
				changeDate={priceChangeDate}
				observedAt={priceObservedAt}
				locale={locale}
				marketRevision={marketRevision}
				priceRevision={priceRevision}
				priceBoard={priceChangeBoard}
			/>
		) : null
	const ownershipSection = (
		<section
			aria-labelledby="market-ownership"
			className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
		>
			<div className="space-y-6">
				<div>
					<SectionTitle id="market-ownership">
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
				<div>
					<SectionTitle id="market-most-selected">
						{t('mostSelectedTitle')}
					</SectionTitle>
					<MostSelectedColumn
						players={pulse?.mostSelected ?? []}
						locale={locale}
						t={t}
					/>
				</div>
			</div>
		</section>
	)
	const transferSection =
		pulse && pulse.transferMovers.length > 0 ? (
			<section
				aria-labelledby="market-transfers"
				className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
			>
				<SectionTitle id="market-transfers">{t('transferTitle')}</SectionTitle>
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
			aria-labelledby="market-squad-status"
			className="grid gap-8 rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5 lg:grid-cols-2 lg:gap-8"
		>
			<div>
				<SectionTitle id="market-squad-status">
					<span className="inline-flex items-center gap-1.5">
						<HeartPulse
							className="size-3.5"
							aria-hidden="true"
						/>
						{t('availabilityTitle')}
					</span>
				</SectionTitle>
				<MarketAvailabilityList
					updates={pulse?.availabilityHighlights ?? []}
					locale={locale}
					t={t}
				/>
				<MarketAvailabilityDisclosure
					days={pulse?.coverage.requestedDays ?? 0}
					revision={marketRevision}
					count={
						pulse?.availabilityUpdateCount ??
						pulse?.availabilityUpdates.length ??
						0
					}
				/>
			</div>
			{(pulse?.newPlayers.length ?? 0) > 0 ? (
				<div>
					<SectionTitle id="market-new-players">
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
		<div className="space-y-8">
			{pulse ? (
				<>
					<div className="border-b border-border/60 pb-3">
						<CoverageMeta
							coverage={pulse.coverage}
							locale={locale}
							t={t}
						/>
					</div>
				</>
			) : null}
			{glance}
			{order.map(id => (
				<section key={id}>{sectionById[id]}</section>
			))}
		</div>
	)
}

export async function MarketGlance({
	dailyOwnership,
	gameweekOwnership,
	locale
}: {
	dailyOwnership: MarketOwnershipOverview | null
	gameweekOwnership: MarketOwnershipOverview | null
	locale: string
}) {
	if (!dailyOwnership && !gameweekOwnership) return null
	const t: MarketT = await getTranslations('Market')
	return (
		<GlanceStrip
			dailyOwnership={dailyOwnership}
			gameweekOwnership={gameweekOwnership}
			locale={locale}
			t={t}
		/>
	)
}
