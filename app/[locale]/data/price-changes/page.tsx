import { MarketPlayerLookup } from '@/components/data/MarketPlayerLookup'
import { OwnershipSwingDesk } from '@/components/data/OwnershipSwingDesk'
import PageShell from '@/components/layout/PageShell'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
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

async function CoverageStrip({ coverage, locale }: { coverage: MarketPulse['coverage']; locale: string }) {
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
		<div className="border-y border-electric/25 bg-plum text-white">
			<div className="mx-auto grid max-w-6xl gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center lg:px-8">
				<div>
					<p className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-electric">
						{rangeLabel}
					</p>
					<p className="mt-1 text-sm text-white/65">
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
				{coverage.capturedAt && (
					<div className="flex items-center gap-2 text-sm text-white/70">
						<Clock3 aria-hidden="true" className="size-4 text-electric" />
						<span>{t('lastUpdated', { date: formatCapturedAt(coverage.capturedAt, locale) })}</span>
					</div>
				)}
				{coverage.stale && (
					<p className="sm:col-span-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
						{t('staleWarning')}
					</p>
				)}
			</div>
		</div>
	)
}

async function MostSelectedSection({ players, locale }: { players: MarketPlayer[]; locale: string }) {
	const t = await getTranslations('Market')
	if (players.length === 0) return null

	return (
		<section aria-labelledby="market-most-selected">
			<div className="mb-5">
				<p className="chyron">{t('squadSheet')}</p>
				<h2 id="market-most-selected" className="mt-2 text-3xl font-bold uppercase tracking-wide">
					{t('mostSelectedTitle')}
				</h2>
				<p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('mostSelectedDescription')}</p>
			</div>
			<ol className="grid gap-3 sm:grid-cols-2">
				{players.map((player, index) => (
					<li key={player.playerId} className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
						<span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-plum font-mono text-sm font-bold text-electric">
							{String(index + 1).padStart(2, '0')}
						</span>
						<PositionBadge player={player} />
						<div className="min-w-0 flex-1">
							<p className="truncate font-semibold">{player.webName}</p>
							<p className="text-xs text-muted-foreground">{player.teamShortName} · £{(player.price / 10).toFixed(1)}m</p>
						</div>
						<strong className="shrink-0 font-mono text-sm text-primary-ink">
							{formatOwnership(player.selectedByPercent, locale)}
						</strong>
					</li>
				))}
			</ol>
		</section>
	)
}

async function OwnershipSection({ pulse }: { pulse: MarketPulse }) {
	const t = await getTranslations('Market')
	const hasMovers = pulse.ownershipMovers.risers.length > 0 || pulse.ownershipMovers.fallers.length > 0

	return (
		<section aria-labelledby="market-ownership">
			<Card className="overflow-hidden rounded-xl border-electric/20">
				<CardHeader className="bg-muted/30">
					<p className="chyron">{t('movementDesk')}</p>
					<CardTitle asChild>
						<h2 id="market-ownership" className="mt-2 text-3xl font-bold uppercase tracking-wide">
							{t('ownershipTitle')}
						</h2>
					</CardTitle>
					<p className="text-sm text-muted-foreground">{t('ownershipDescription')}</p>
				</CardHeader>
				<CardContent className="pt-6">
					{pulse.coverage.observedDays < 2 ? (
						<p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
							{t('movementNeedsAnotherDay')}
						</p>
					) : hasMovers ? (
						<OwnershipSwingDesk
							risers={pulse.ownershipMovers.risers}
							fallers={pulse.ownershipMovers.fallers}
						/>
					) : (
						<p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
							{t('noOwnershipMovement')}
						</p>
					)}
				</CardContent>
			</Card>
		</section>
	)
}

const statusKey = (status: string): 'available' | 'doubtful' | 'injured' | 'unavailable' | 'suspended' | 'unknown' => {
	switch (status.toLowerCase()) {
		case 'a':
			return 'available'
		case 'd':
			return 'doubtful'
		case 'i':
			return 'injured'
		case 'u':
		case 'n':
			return 'unavailable'
		case 's':
			return 'suspended'
		default:
			return 'unknown'
	}
}

async function AvailabilitySection({ updates, locale }: { updates: MarketAvailabilityUpdate[]; locale: string }) {
	const t = await getTranslations('Market')
	if (updates.length === 0) return null

	return (
		<section aria-labelledby="market-availability">
			<div className="mb-5 flex items-start gap-3">
				<span className="mt-1 rounded-md bg-pink/15 p-2 text-pink"><HeartPulse aria-hidden="true" className="size-5" /></span>
				<div>
					<p className="chyron">{t('teamNews')}</p>
					<h2 id="market-availability" className="mt-2 text-3xl font-bold uppercase tracking-wide">{t('availabilityTitle')}</h2>
					<p className="mt-2 text-sm text-muted-foreground">{t('availabilityDescription')}</p>
				</div>
			</div>
			<ul className="grid gap-3 md:grid-cols-2">
				{updates.map(update => {
					const key = statusKey(update.status)
					const chance = update.chanceOfPlayingThisRound ?? update.chanceOfPlayingNextRound
					return (
						<li key={update.player.playerId} className="min-h-32 rounded-xl border bg-card p-4 shadow-sm">
							<div className="flex items-start gap-3">
								<PositionBadge player={update.player} />
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<h3 className="font-sans text-base font-semibold">{update.player.webName}</h3>
										<Badge variant={key === 'available' ? 'secondary' : 'outline'}>{t(`status.${key}`)}</Badge>
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										{update.player.teamShortName} · {formatOwnership(update.player.selectedByPercent, locale)} {t('owned')}
									</p>
								</div>
							</div>
							<p className="mt-3 text-sm leading-relaxed">{update.news.trim() || t('availabilityRecovered')}</p>
							<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
								<span>{t('observedOn', { date: formatCalendarDate(update.observedDate, locale) })}</span>
								{chance !== null && <span>{t('playingChance', { chance })}</span>}
							</div>
						</li>
					)
				})}
			</ul>
		</section>
	)
}

async function NewPlayersSection({ pulse, locale }: { pulse: MarketPulse; locale: string }) {
	const t = await getTranslations('Market')
	if (pulse.newPlayers.length === 0) return null

	return (
		<section aria-labelledby="market-new-players">
			<div className="mb-4 flex items-center gap-3">
				<Sparkles aria-hidden="true" className="size-5 text-primary-ink" />
				<h2 id="market-new-players" className="text-2xl font-bold uppercase tracking-wide">{t('newPlayersTitle')}</h2>
			</div>
			<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{pulse.newPlayers.map(item => (
					<li key={item.player.playerId} className="flex min-h-16 items-center gap-3 rounded-lg border bg-card p-3">
						<PositionBadge player={item.player} />
						<div className="min-w-0">
							<p className="truncate font-semibold">{item.player.webName}</p>
							<p className="text-xs text-muted-foreground">{t('firstSeen', { date: formatCalendarDate(item.firstObservedDate, locale) })}</p>
						</div>
					</li>
				))}
			</ul>
		</section>
	)
}

async function TransferSection({ movers, locale }: { movers: MarketTransferMover[]; locale: string }) {
	const t = await getTranslations('Market')
	if (movers.length === 0) return null
	const number = new Intl.NumberFormat(locale)

	return (
		<section aria-labelledby="market-transfers">
			<div className="mb-4 flex items-center gap-3">
				<MoveRight aria-hidden="true" className="size-5 text-primary-ink" />
				<div>
					<h2 id="market-transfers" className="text-2xl font-bold uppercase tracking-wide">{t('transferTitle')}</h2>
					<p className="mt-1 text-sm text-muted-foreground">{t('transferDescription')}</p>
				</div>
			</div>
			<ol className="grid gap-3 md:grid-cols-2">
				{movers.map(mover => (
					<li key={mover.player.playerId} className="flex min-h-16 items-center gap-3 rounded-lg border bg-card p-3">
						<PositionBadge player={mover.player} />
						<div className="min-w-0 flex-1">
							<p className="truncate font-semibold">{mover.player.webName}</p>
							<p className="text-xs text-muted-foreground">
								{t('transferInOut', { inCount: number.format(mover.transfersIn), outCount: number.format(mover.transfersOut) })}
							</p>
						</div>
						<strong className={`font-mono text-sm ${mover.netTransfers >= 0 ? 'text-success' : 'text-destructive'}`}>
							{mover.netTransfers > 0 ? '+' : ''}{number.format(mover.netTransfers)} {t('netShort')}
						</strong>
					</li>
				))}
			</ol>
		</section>
	)
}

async function PriceMovementSection({ changes, locale }: { changes: MarketPriceChange[]; locale: string }) {
	const t = await getTranslations('Market')

	return (
		<section aria-labelledby="market-prices">
			<Card className="overflow-hidden rounded-xl">
				<CardHeader>
					<p className="chyron">{t('priceDesk')}</p>
					<CardTitle asChild>
						<h2 id="market-prices" className="mt-2 text-3xl font-bold uppercase tracking-wide">{t('priceTitle')}</h2>
					</CardTitle>
				</CardHeader>
				<CardContent>
					{changes.length === 0 ? (
						<div className="scoreboard rounded-xl p-5">
							<p className="font-display text-xl font-bold uppercase tracking-wide text-electric">{t('pricesLockedTitle')}</p>
							<p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">{t('pricesLockedDescription')}</p>
						</div>
					) : (
						<ol className="grid gap-3 md:grid-cols-2">
							{changes.map((change, index) => {
								const rising = change.direction === 'RISE'
								const Icon = rising ? ArrowUpRight : ArrowDownRight
								return (
									<li key={`${change.player.playerId}-${change.changeDate}-${index}`} className="flex min-h-16 items-center gap-3 rounded-lg border p-3">
										<Icon aria-hidden="true" className={`size-5 shrink-0 ${rising ? 'text-success' : 'text-destructive'}`} />
										<div className="min-w-0 flex-1">
											<p className="truncate font-semibold">{change.player.webName}</p>
											<p className="text-xs text-muted-foreground">{change.player.teamShortName} · {formatCalendarDate(change.changeDate, locale)}</p>
										</div>
										<div className="shrink-0 text-right">
											<p className={`font-mono text-sm font-bold ${rising ? 'text-success' : 'text-destructive'}`}>
												{rising ? '+' : '-'}£{(Math.abs(change.change) / 10).toFixed(1)}m
											</p>
											<p className="text-xs text-muted-foreground">£{(change.oldPrice / 10).toFixed(1)}m → £{(change.newPrice / 10).toFixed(1)}m</p>
										</div>
									</li>
								)
							})}
						</ol>
					)}
				</CardContent>
			</Card>
		</section>
	)
}

async function LookupSection() {
	const t = await getTranslations('Market')
	return (
		<section aria-labelledby="market-player-lookup">
			<Card className="rounded-xl">
				<CardHeader>
					<div className="flex items-start gap-3">
						<Search aria-hidden="true" className="mt-1 size-5 text-primary-ink" />
						<div>
							<p className="chyron">{t('archiveDesk')}</p>
							<CardTitle asChild>
								<h2 id="market-player-lookup" className="mt-2 text-3xl font-bold uppercase tracking-wide">{t('lookupTitle')}</h2>
							</CardTitle>
							<p className="mt-2 text-sm text-muted-foreground">{t('lookupDescription')}</p>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<MarketPlayerLookup />
				</CardContent>
			</Card>
		</section>
	)
}

export default async function MarketPage({ params }: PageProps) {
	await connection()
	const { locale } = await getPageLocale(params)
	const t = await getTranslations('Market')
	let pulse: MarketPulse | null = null
	let loadFailed = false

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

	return (
		<PageShell>
			<div>
				<header className="pitch-markings texture-grain relative isolate overflow-hidden border-b">
					<div className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:py-16 lg:px-8">
						<p className="chyron">{t('eyebrow')}</p>
						<h1 className="mt-4 max-w-4xl text-5xl font-bold uppercase leading-[0.92] tracking-tight sm:text-6xl lg:text-7xl">
							{t('title')}
						</h1>
						<p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{t('intro')}</p>
					</div>
				</header>

				{loadFailed ? (
					<div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
						<Alert variant="destructive">
							<AlertTitle>{t('dataUnavailable')}</AlertTitle>
							<AlertDescription>{t('dataUnavailableDescription')}</AlertDescription>
						</Alert>
					</div>
				) : pulse ? (
					<CoverageStrip coverage={pulse.coverage} locale={locale} />
				) : null}

				<div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:gap-16 sm:py-14 lg:px-8">
					{pulse && pulse.coverage.observedDays > 0 ? (
						<>
							<MostSelectedSection players={pulse.mostSelected} locale={locale} />
							<OwnershipSection pulse={pulse} />
							<AvailabilitySection updates={pulse.availabilityUpdates} locale={locale} />
							<NewPlayersSection pulse={pulse} locale={locale} />
							<TransferSection movers={pulse.transferMovers} locale={locale} />
							<PriceMovementSection changes={pulse.priceChanges} locale={locale} />
						</>
					) : pulse && !loadFailed ? (
						<Card className="scoreboard rounded-xl p-6 sm:p-8">
							<div className="flex items-start gap-4">
								<Users aria-hidden="true" className="mt-1 size-6 shrink-0 text-electric" />
								<div>
									<h2 className="text-2xl font-bold uppercase tracking-wide text-white">{t('trackingStartsTitle')}</h2>
									<p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">{t('trackingStartsDescription', { time: '09:40 UTC+8' })}</p>
								</div>
							</div>
						</Card>
					) : null}
					<LookupSection />
				</div>
			</div>
		</PageShell>
	)
}
