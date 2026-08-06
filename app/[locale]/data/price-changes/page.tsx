import { MarketPlayerLookup } from '@/components/data/MarketPlayerLookup'
import { OwnershipSwingDesk } from '@/components/data/OwnershipSwingDesk'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader, StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import {
	PRICE_CHANGES_UI_MOCK_ENABLED,
	getPriceChangesUiMockPulse,
} from '@/lib/dev/price-changes-ui-mock'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_MARKET_PULSE,
	type MarketAvailabilityUpdate,
	type MarketPlayer,
	type MarketPriceChange,
	type MarketPulse,
	type MarketPulseResponse,
	type MarketTransferMover,
} from '@/lib/graphql/operations/market'
import { availabilityBodyText, marketAvailabilityStatusKey } from '@/lib/market-availability'
import { getMarketCoverageMode, shortMarketPosition } from '@/lib/market'
import { positionBadgeClass } from '@/lib/position-style'
import {
	ArrowDownRight,
	ArrowUpRight,
	Clock3,
	HeartPulse,
	MoveRight,
	Search,
	Sparkles,
	Users,
} from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { unstable_rethrow } from 'next/navigation'
import { connection } from 'next/server'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/data/price-changes',
		titleKey: 'priceChangesTitle',
		descriptionKey: 'priceChangesDescription',
	})
}

const formatCalendarDate = (value: string | null, locale: string): string => {
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

const formatCapturedAt = (value: string | null, locale: string): string => {
	if (!value) return '—'
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) return value
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Australia/Perth',
		timeZoneName: 'short',
	}).format(parsed)
}

const formatOwnership = (value: number, locale: string): string =>
	`${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`

function PositionBadge({ player }: { player: MarketPlayer }) {
	const position = shortMarketPosition(player.position)
	return <Badge className={positionBadgeClass(position)}>{position}</Badge>
}

async function CoverageCard({
	coverage,
	locale,
}: {
	coverage: MarketPulse['coverage']
	locale: string
}) {
	const t = await getTranslations('Market')
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
		<div className="mb-6 rounded-lg border border-border/80 bg-card p-4 shadow-sm sm:p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<p className="font-display text-sm font-semibold tracking-tight text-foreground">
						{rangeLabel}
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						{mode === 'one-day'
							? t('movementNeedsAnotherDay')
							: mode === 'empty'
								? t('nextCapture', { time: '09:40 UTC+8' })
								: t('observationCount', {
										observed: coverage.observedDays,
										requested: coverage.requestedDays,
									})}
					</p>
				</div>
				{coverage.capturedAt ? (
					<div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
						<span className="inline-flex size-7 items-center justify-center rounded-full bg-muted ring-1 ring-border/60">
							<Clock3 aria-hidden="true" className="size-3.5" />
						</span>
						<span>
							{t('lastUpdated', {
								date: formatCapturedAt(coverage.capturedAt, locale),
							})}
						</span>
					</div>
				) : null}
			</div>
			{coverage.stale ? (
				<p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
					{t('staleWarning')}
				</p>
			) : null}
		</div>
	)
}

async function MostSelectedSection({
	players,
	locale,
}: {
	players: MarketPlayer[]
	locale: string
}) {
	const t = await getTranslations('Market')
	if (players.length === 0) return null

	return (
		<section aria-labelledby="market-most-selected">
			<StatsSectionCard
				icon={Users}
				eyebrow={t('squadSheet')}
				titleId="market-most-selected"
				title={t('mostSelectedTitle')}
				description={t('mostSelectedDescription')}
			>
				<ol className="grid gap-2 sm:grid-cols-2 sm:gap-3">
					{players.map((player, index) => (
						<li
							key={player.playerId}
							className="flex min-h-14 items-center gap-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-3 dark:bg-muted/25"
						>
							<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-plum font-mono text-xs font-bold tracking-wide text-electric">
								{String(index + 1).padStart(2, '0')}
							</span>
							<PositionBadge player={player} />
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">{player.webName}</p>
								<p className="text-xs text-muted-foreground">
									{player.teamShortName} · £{(player.price / 10).toFixed(1)}m
								</p>
							</div>
							<strong className="shrink-0 font-display text-sm font-semibold tabular-nums text-foreground">
								{formatOwnership(player.selectedByPercent, locale)}
							</strong>
						</li>
					))}
				</ol>
			</StatsSectionCard>
		</section>
	)
}

async function OwnershipSection({ pulse }: { pulse: MarketPulse }) {
	const t = await getTranslations('Market')
	const hasMovers =
		pulse.ownershipMovers.risers.length > 0 ||
		pulse.ownershipMovers.fallers.length > 0

	return (
		<section aria-labelledby="market-ownership">
			<StatsSectionCard
				eyebrow={t('movementDesk')}
				titleId="market-ownership"
				title={t('ownershipTitle')}
				description={t('ownershipDescription')}
			>
				{pulse.coverage.observedDays < 2 ? (
					<p className="rounded-lg border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
						{t('movementNeedsAnotherDay')}
					</p>
				) : hasMovers ? (
					<OwnershipSwingDesk
						risers={pulse.ownershipMovers.risers}
						fallers={pulse.ownershipMovers.fallers}
					/>
				) : (
					<p className="rounded-lg border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
						{t('noOwnershipMovement')}
					</p>
				)}
			</StatsSectionCard>
		</section>
	)
}

async function AvailabilitySection({
	updates,
	locale,
}: {
	updates: MarketAvailabilityUpdate[]
	locale: string
}) {
	const t = await getTranslations('Market')
	if (updates.length === 0) return null

	return (
		<section aria-labelledby="market-availability">
			<StatsSectionCard
				icon={HeartPulse}
				eyebrow={t('teamNews')}
				titleId="market-availability"
				title={t('availabilityTitle')}
				description={t('availabilityDescription')}
			>
				<ul className="grid gap-2 sm:gap-3 md:grid-cols-2">
					{updates.map(update => {
						const key = marketAvailabilityStatusKey(update.status)
						const chance =
							update.chanceOfPlayingThisRound ?? update.chanceOfPlayingNextRound
						return (
							<li
								key={update.player.playerId}
								className="min-h-28 rounded-lg border border-border/70 bg-muted/40 p-4 dark:bg-muted/25"
							>
								<div className="flex items-start gap-3">
									<PositionBadge player={update.player} />
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<h3 className="text-sm font-semibold">
												{update.player.webName}
											</h3>
											<Badge
												variant={key === 'available' ? 'secondary' : 'outline'}
											>
												{t(`status.${key}`)}
											</Badge>
										</div>
										<p className="mt-1 text-xs text-muted-foreground">
											{update.player.teamShortName} ·{' '}
											{formatOwnership(update.player.selectedByPercent, locale)}{' '}
											{t('owned')}
										</p>
									</div>
								</div>
								<p className="mt-3 text-sm leading-relaxed text-foreground">
									{availabilityBodyText(update, k => t(k))}
								</p>
								<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
									<span>
										{t('observedOn', {
											date: formatCalendarDate(update.observedDate, locale),
										})}
									</span>
									{chance !== null ? (
										<span>{t('playingChance', { chance })}</span>
									) : null}
								</div>
							</li>
						)
					})}
				</ul>
			</StatsSectionCard>
		</section>
	)
}

async function NewPlayersSection({
	pulse,
	locale,
}: {
	pulse: MarketPulse
	locale: string
}) {
	const t = await getTranslations('Market')
	if (pulse.newPlayers.length === 0) return null

	return (
		<section aria-labelledby="market-new-players">
			<StatsSectionCard
				icon={Sparkles}
				titleId="market-new-players"
				title={t('newPlayersTitle')}
			>
				<ul className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
					{pulse.newPlayers.map(item => (
						<li
							key={item.player.playerId}
							className="flex min-h-14 items-center gap-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-3 dark:bg-muted/25"
						>
							<PositionBadge player={item.player} />
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">
									{item.player.webName}
								</p>
								<p className="text-xs text-muted-foreground">
									{t('firstSeen', {
										date: formatCalendarDate(item.firstObservedDate, locale),
									})}
								</p>
							</div>
						</li>
					))}
				</ul>
			</StatsSectionCard>
		</section>
	)
}

async function TransferSection({
	movers,
	locale,
}: {
	movers: MarketTransferMover[]
	locale: string
}) {
	const t = await getTranslations('Market')
	if (movers.length === 0) return null
	const number = new Intl.NumberFormat(locale)

	return (
		<section aria-labelledby="market-transfers">
			<StatsSectionCard
				icon={MoveRight}
				titleId="market-transfers"
				title={t('transferTitle')}
				description={t('transferDescription')}
			>
				<ol className="grid gap-2 sm:gap-3 md:grid-cols-2">
					{movers.map(mover => (
						<li
							key={mover.player.playerId}
							className="flex min-h-14 items-center gap-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-3 dark:bg-muted/25"
						>
							<PositionBadge player={mover.player} />
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">
									{mover.player.webName}
								</p>
								<p className="text-xs text-muted-foreground">
									{t('transferInOut', {
										inCount: number.format(mover.transfersIn),
										outCount: number.format(mover.transfersOut),
									})}
								</p>
							</div>
							<strong
								className={`shrink-0 font-display text-sm font-semibold tabular-nums ${
									mover.netTransfers >= 0 ? 'text-success' : 'text-destructive'
								}`}
							>
								{mover.netTransfers > 0 ? '+' : ''}
								{number.format(mover.netTransfers)} {t('netShort')}
							</strong>
						</li>
					))}
				</ol>
			</StatsSectionCard>
		</section>
	)
}

async function PriceMovementSection({
	changes,
	locale,
}: {
	changes: MarketPriceChange[]
	locale: string
}) {
	const t = await getTranslations('Market')

	return (
		<section aria-labelledby="market-prices">
			<StatsSectionCard
				eyebrow={t('priceDesk')}
				titleId="market-prices"
				title={t('priceTitle')}
			>
				{changes.length === 0 ? (
					<div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-4 py-6 dark:bg-muted/20">
						<p className="font-display text-base font-semibold tracking-tight">
							{t('pricesLockedTitle')}
						</p>
						<p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
							{t('pricesLockedDescription')}
						</p>
					</div>
				) : (
					<ol className="grid gap-2 sm:gap-3 md:grid-cols-2">
						{changes.map((change, index) => {
							const rising = change.direction === 'RISE'
							const Icon = rising ? ArrowUpRight : ArrowDownRight
							return (
								<li
									key={`${change.player.playerId}-${change.changeDate}-${index}`}
									className="flex min-h-14 items-center gap-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-3 dark:bg-muted/25"
								>
									<span
										className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border/60 ${
											rising ? 'text-success' : 'text-destructive'
										}`}
									>
										<Icon aria-hidden="true" className="size-4" />
									</span>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">
											{change.player.webName}
										</p>
										<p className="text-xs text-muted-foreground">
											{change.player.teamShortName} ·{' '}
											{formatCalendarDate(change.changeDate, locale)}
										</p>
									</div>
									<div className="shrink-0 text-right">
										<p
											className={`font-display text-sm font-semibold tabular-nums ${
												rising ? 'text-success' : 'text-destructive'
											}`}
										>
											{rising ? '+' : '-'}£
											{(Math.abs(change.change) / 10).toFixed(1)}m
										</p>
										<p className="text-xs text-muted-foreground">
											£{(change.oldPrice / 10).toFixed(1)}m → £
											{(change.newPrice / 10).toFixed(1)}m
										</p>
									</div>
								</li>
							)
						})}
					</ol>
				)}
			</StatsSectionCard>
		</section>
	)
}

async function LookupSection() {
	const t = await getTranslations('Market')
	return (
		<section aria-labelledby="market-player-lookup">
			<StatsSectionCard
				icon={Search}
				eyebrow={t('archiveDesk')}
				titleId="market-player-lookup"
				title={t('lookupTitle')}
				description={t('lookupDescription')}
			>
				<MarketPlayerLookup />
			</StatsSectionCard>
		</section>
	)
}

export default async function MarketPage({ params }: PageProps) {
	await connection()
	const { locale } = await getPageLocale(params)
	const t = await getTranslations('Market')
	let pulse: MarketPulse | null = null
	let loadFailed = false

	// TEMP UI mock — seed desk without GraphQL
	if (PRICE_CHANGES_UI_MOCK_ENABLED) {
		pulse = getPriceChangesUiMockPulse()
	} else {
		try {
			const response = await executePublicServerQuery<MarketPulseResponse>(
				GET_MARKET_PULSE,
				{ days: 14 },
				{ cache: 'no-store', timeoutMs: 5_000 },
			)
			pulse = response.marketPulse
		} catch (error) {
			unstable_rethrow(error)
			console.error('[market] RSC fetch failed:', error)
			loadFailed = true
		}
	}

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<StatsPageHeader eyebrow={t('eyebrow')} title={t('title')} />
				<p className="-mt-4 mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
					{t('intro')}
				</p>

				{loadFailed ? (
					<Alert variant="destructive" className="mb-6">
						<AlertTitle>{t('dataUnavailable')}</AlertTitle>
						<AlertDescription>
							{t('dataUnavailableDescription')}
						</AlertDescription>
					</Alert>
				) : null}

				{pulse ? <CoverageCard coverage={pulse.coverage} locale={locale} /> : null}

				<div className="flex flex-col gap-5 sm:gap-6">
					{pulse && pulse.coverage.observedDays > 0 ? (
						<>
							<MostSelectedSection
								players={pulse.mostSelected}
								locale={locale}
							/>
							<OwnershipSection pulse={pulse} />
							<AvailabilitySection
								updates={pulse.availabilityUpdates}
								locale={locale}
							/>
							<NewPlayersSection pulse={pulse} locale={locale} />
							<TransferSection movers={pulse.transferMovers} locale={locale} />
							<PriceMovementSection
								changes={pulse.priceChanges}
								locale={locale}
							/>
						</>
					) : pulse && !loadFailed ? (
						<div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm sm:p-6">
							<div className="flex items-start gap-3">
								<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border/60">
									<Users aria-hidden="true" className="size-4" />
								</span>
								<div>
									<h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">
										{t('trackingStartsTitle')}
									</h2>
									<p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
										{t('trackingStartsDescription', {
											time: '09:40 UTC+8',
										})}
									</p>
								</div>
							</div>
						</div>
					) : null}
					<LookupSection />
				</div>
			</div>
		</PageShell>
	)
}
