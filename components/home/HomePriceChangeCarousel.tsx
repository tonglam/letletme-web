'use client'

import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { MarketPositionBadge } from '@/components/data/MarketMarkup'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import type { MarketPriceChange } from '@/lib/graphql/operations/market'
import type {
	PriceChangePlayer,
	PriceChangePredictionStatus
} from '@/lib/graphql/operations/price-changes'
import { cn } from '@/lib/utils'
import {
	ArrowDownRight,
	ArrowRight,
	ArrowUpRight,
	ChevronLeft,
	ChevronRight,
	Minus
} from 'lucide-react'
import { useEffect, useState } from 'react'

const AUTO_ADVANCE_MS = 7000

export type HomePriceChangeCarouselLabels = {
	title: string
	todayPage: string
	todayDescription: string
	likelyPage: string
	likelyDescription: string
	openRecorded: string
	openPredictions: string
	previousPage: string
	nextPage: string
	pagerLabel: string
	priceRises: string
	priceFalls: string
	trendRises: string
	trendFalls: string
	noPriceChanges: string
	noPriceRises: string
	noPriceFalls: string
	noTrendRises: string
	noTrendFalls: string
	noLikelyToChange: string
	likelyUnavailable: string
	likelyUnavailableDescription: string
	dataUnavailable: string
	dataUnavailableDescription: string
	status: Record<PriceChangePredictionStatus, string>
}

export type HomePriceChangeCarouselProps = {
	actual: {
		state: 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE'
		coverageLabel: string | null
		rises: MarketPriceChange[]
		falls: MarketPriceChange[]
	}
	likely: {
		state: 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE'
		rises: PriceChangePlayer[]
		falls: PriceChangePlayer[]
		notice: string | null
	}
	locale: string
	labels: HomePriceChangeCarouselLabels
}

function formatPrice(value: number): string {
	return `£${(value / 10).toFixed(1)}m`
}

function formatChange(change: MarketPriceChange): string {
	const sign = change.direction === 'RISE' ? '+' : '−'
	return `${sign}${formatPrice(Math.abs(change.change))}`
}

function formatPercent(value: number): string {
	return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function priceChangeHref(playerId: number, locale: string): string {
	return playerStatsHref({
		p1: String(playerId),
		localePathPrefix: locale === 'en' ? '' : `/${locale}`
	})
}

function EmptyState({
	title,
	description
}: {
	title: string
	description?: string
}) {
	return (
		<div className="flex min-h-[18rem] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
			<Minus
				aria-hidden="true"
				className="size-5 text-muted-foreground"
			/>
			<p className="mt-2 font-display text-sm font-bold uppercase tracking-caps">
				{title}
			</p>
			{description ? (
				<p className="mt-1 text-xs text-muted-foreground">{description}</p>
			) : null}
		</div>
	)
}

function UnavailableState({
	title,
	description
}: {
	title: string
	description: string
}) {
	return (
		<div className="flex min-h-[18rem] flex-col justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-4">
			<p className="font-display text-sm font-bold uppercase tracking-caps text-destructive">
				{title}
			</p>
			<p className="mt-1 text-xs text-muted-foreground">{description}</p>
		</div>
	)
}

function PriceChangeDirection({
	changes,
	direction,
	locale,
	title,
	emptyLabel
}: {
	changes: MarketPriceChange[]
	direction: 'RISE' | 'FALL'
	locale: string
	title: string
	emptyLabel: string
}) {
	const isRise = direction === 'RISE'
	const Icon = isRise ? ArrowUpRight : ArrowDownRight
	const tone = isRise ? 'text-success' : 'text-destructive'

	return (
		<section aria-label={title}>
			<h3
				className={cn(
					'mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-caps',
					tone
				)}
			>
				<Icon
					aria-hidden="true"
					className="size-4"
				/>
				{title}
				<span className="font-mono text-xs text-muted-foreground">
					({changes.length})
				</span>
			</h3>
			{changes.length === 0 ? (
				<div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-5 text-center">
					<Minus
						aria-hidden="true"
						className="mx-auto size-4 text-muted-foreground"
					/>
					<p className="mt-2 text-xs text-muted-foreground">{emptyLabel}</p>
				</div>
			) : (
				<ul className="space-y-2">
					{changes.map(change => (
						<li
							key={`${change.player.playerId}-${change.changeDate}`}
							className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-lg border border-border/50 bg-background/80 p-3"
						>
							<span className="row-span-2 self-start">
								<MarketPositionBadge position={change.player.position} />
							</span>
							<div className="min-w-0">
								<a
									href={priceChangeHref(change.player.playerId, locale)}
									className="block whitespace-nowrap text-sm font-semibold leading-tight text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
								>
									{change.player.webName}
								</a>
								<p className="text-xs text-muted-foreground">
									{change.player.teamShortName}
								</p>
							</div>
							<div className="col-start-2 mt-1 flex min-w-0 items-center justify-between gap-2">
								<span className="min-w-0 truncate text-xs text-muted-foreground">
									{formatPrice(change.oldPrice)} → {formatPrice(change.newPrice)}
								</span>
								<span className={`shrink-0 font-display text-sm font-bold ${tone}`}>
									{formatChange(change)}
								</span>
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}

function TodayPage({
	actual,
	locale,
	labels
}: {
	actual: HomePriceChangeCarouselProps['actual']
	locale: string
	labels: HomePriceChangeCarouselLabels
}) {
	if (actual.state === 'UNAVAILABLE') {
		return (
			<UnavailableState
				title={labels.dataUnavailable}
				description={labels.dataUnavailableDescription}
			/>
		)
	}

	if (actual.state === 'EMPTY') {
		return (
			<EmptyState
				title={labels.noPriceChanges}
				description={actual.coverageLabel ?? undefined}
			/>
		)
	}

	return (
		<div className="space-y-6">
			{actual.coverageLabel ? (
				<p className="text-xs text-muted-foreground">{actual.coverageLabel}</p>
			) : null}
			<PriceChangeDirection
				changes={actual.rises}
				direction="RISE"
				locale={locale}
				title={labels.priceRises}
				emptyLabel={labels.noPriceRises}
			/>
			<PriceChangeDirection
				changes={actual.falls}
				direction="FALL"
				locale={locale}
				title={labels.priceFalls}
				emptyLabel={labels.noPriceFalls}
			/>
		</div>
	)
}

function predictionStatusClass(status: PriceChangePredictionStatus): string {
	if (status.includes('RISE')) {
		return 'border-success/40 bg-success/10 text-success'
	}
	if (status.includes('FALL')) {
		return 'border-destructive/40 bg-destructive/10 text-destructive'
	}
	return 'border-border/70 bg-muted/30 text-muted-foreground'
}

function LikelyPlayerRow({
	player,
	locale,
	labels
}: {
	player: PriceChangePlayer
	locale: string
	labels: HomePriceChangeCarouselLabels
}) {
	const progressTone = player.progressPercent >= 0 ? 'bg-success' : 'bg-destructive'
	const progressTextTone =
		player.progressPercent >= 0 ? 'text-success' : 'text-destructive'

	return (
		<li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-b border-border/50 py-2.5 last:border-b-0">
			<span className="row-span-3 self-start pt-0.5">
				<MarketPositionBadge position={player.position} />
			</span>
			<div className="min-w-0">
				<a
					href={priceChangeHref(player.playerId, locale)}
					className="block whitespace-nowrap text-sm font-semibold leading-snug text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
				>
					{player.webName}
				</a>
				<p className="whitespace-nowrap text-[11px] leading-tight text-muted-foreground">
					{player.teamShortName} · {formatPrice(player.currentPrice)}
				</p>
			</div>
			<div className="col-start-2 mt-1 flex min-w-0 items-center gap-2">
				<div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
					<div
						className={cn('h-full rounded-full', progressTone)}
						style={{
							width: `${Math.min(100, Math.abs(player.progressPercent))}%`
						}}
					/>
				</div>
				<span
					className={cn(
						'shrink-0 font-display text-sm font-bold tabular-nums',
						progressTextTone
					)}
				>
					{formatPercent(player.progressPercent)}
				</span>
			</div>
			<Badge
				variant="outline"
				className={cn(
					'col-start-2 row-start-3 w-fit whitespace-nowrap px-1.5 py-0 text-[9px]',
					predictionStatusClass(player.status)
				)}
			>
				{labels.status[player.status]}
			</Badge>
		</li>
	)
}

function PredictionDirection({
	players,
	direction,
	locale,
	title,
	emptyLabel,
	labels
}: {
	players: PriceChangePlayer[]
	direction: 'RISE' | 'FALL'
	locale: string
	title: string
	emptyLabel: string
	labels: HomePriceChangeCarouselLabels
}) {
	const isRise = direction === 'RISE'
	const Icon = isRise ? ArrowUpRight : ArrowDownRight
	const tone = isRise ? 'text-success' : 'text-destructive'

	return (
		<section aria-label={title}>
			<h3
				className={cn(
					'mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-caps',
					tone
				)}
			>
				<Icon
					aria-hidden="true"
					className="size-4"
				/>
				{title}
				<span className="font-mono text-xs text-muted-foreground">
					({players.length})
				</span>
			</h3>
			{players.length === 0 ? (
				<div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-5 text-center">
					<Minus
						aria-hidden="true"
						className="mx-auto size-4 text-muted-foreground"
					/>
					<p className="mt-2 text-xs text-muted-foreground">{emptyLabel}</p>
				</div>
			) : (
				<ul className="space-y-2">
					{players.map(player => (
						<LikelyPlayerRow
							key={player.playerId}
							player={player}
							locale={locale}
							labels={labels}
						/>
					))}
				</ul>
			)}
		</section>
	)
}

function LikelyPage({
	likely,
	locale,
	labels
}: {
	likely: HomePriceChangeCarouselProps['likely']
	locale: string
	labels: HomePriceChangeCarouselLabels
}) {
	if (likely.state === 'UNAVAILABLE') {
		return (
			<UnavailableState
				title={labels.likelyUnavailable}
				description={labels.likelyUnavailableDescription}
			/>
		)
	}

	if (likely.state === 'EMPTY') {
		return <EmptyState title={labels.noLikelyToChange} />
	}

	return (
		<div className="space-y-3">
			{likely.notice ? (
				<p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
					{likely.notice}
				</p>
			) : null}
			<div className="grid gap-4 sm:grid-cols-2">
				<PredictionDirection
					players={likely.rises}
					direction="RISE"
					locale={locale}
					title={labels.trendRises}
					emptyLabel={labels.noTrendRises}
					labels={labels}
				/>
				<PredictionDirection
					players={likely.falls}
					direction="FALL"
					locale={locale}
					title={labels.trendFalls}
					emptyLabel={labels.noTrendFalls}
					labels={labels}
				/>
			</div>
		</div>
	)
}

export function HomePriceChangeCarousel({
	actual,
	likely,
	locale,
	labels
}: HomePriceChangeCarouselProps) {
	const [activePage, setActivePage] = useState<0 | 1>(0)
	const [isPaused, setIsPaused] = useState(false)

	useEffect(() => {
		if (
			isPaused ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return
		}

		const interval = window.setInterval(() => {
			setActivePage(currentPage => (currentPage === 0 ? 1 : 0))
		}, AUTO_ADVANCE_MS)

		return () => window.clearInterval(interval)
	}, [activePage, isPaused])

	const pageTitle = activePage === 0 ? labels.todayPage : labels.likelyPage
	const pageDescription =
		activePage === 0 ? labels.todayDescription : labels.likelyDescription
	const actionHref =
		activePage === 0 ? '/explore/market' : '/explore/price-changes'
	const actionLabel =
		activePage === 0 ? labels.openRecorded : labels.openPredictions

	return (
		<Card
			className="flex h-full flex-col rounded-none p-4 sm:rounded-lg sm:p-6 lg:p-8"
			onMouseEnter={() => setIsPaused(true)}
			onMouseLeave={() => setIsPaused(false)}
			onFocusCapture={() => setIsPaused(true)}
			onBlurCapture={event => {
				if (
					!event.relatedTarget ||
					!event.currentTarget.contains(event.relatedTarget as Node)
				) {
					setIsPaused(false)
				}
			}}
		>
			<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="font-display text-xl font-bold uppercase tracking-wide">
						{pageTitle}
					</h2>
					<p className="mt-1 max-w-sm text-xs text-muted-foreground">
						{pageDescription}
					</p>
				</div>
				<Link
					href={actionHref}
					prefetch={false}
					className="inline-flex min-h-9 shrink-0 items-center gap-1.5 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
				>
					{actionLabel}
					<ArrowRight
						aria-hidden="true"
						className="size-4"
					/>
				</Link>
			</div>

			<div className="mb-5 flex flex-wrap items-center gap-3">
				<div
					role="tablist"
					aria-label={labels.pagerLabel}
					className="grid min-w-0 flex-1 grid-cols-2 rounded-lg border border-border/70 bg-muted/20 p-1"
				>
					<button
						type="button"
						id="home-price-changes-today-tab"
						role="tab"
						aria-selected={activePage === 0}
						aria-controls="home-price-changes-today"
						onClick={() => setActivePage(0)}
						className={cn(
							'flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors',
							activePage === 0
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
						>
							<span className="truncate">{labels.todayPage}</span>
						</button>
					<button
						type="button"
						id="home-price-changes-likely-tab"
						role="tab"
						aria-selected={activePage === 1}
						aria-controls="home-price-changes-likely"
						onClick={() => setActivePage(1)}
						className={cn(
							'flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors',
							activePage === 1
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
						>
							<span className="truncate">{labels.likelyPage}</span>
						</button>
				</div>
				<div className="flex shrink-0 gap-1">
					<Button
						variant="outline"
						size="icon"
						type="button"
						disabled={activePage === 0}
						aria-label={labels.previousPage}
						onClick={() => setActivePage(0)}
						className="size-9"
					>
						<ChevronLeft aria-hidden="true" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						type="button"
						disabled={activePage === 1}
						aria-label={labels.nextPage}
						onClick={() => setActivePage(1)}
						className="size-9"
					>
						<ChevronRight aria-hidden="true" />
					</Button>
				</div>
			</div>

			<div className="overflow-hidden" aria-live="polite">
				<div
					className="flex w-full motion-reduce:transition-none"
					style={{
						transform: `translateX(-${activePage * 100}%)`,
						transition: 'transform 280ms ease-out'
					}}
				>
					<section
						id="home-price-changes-today"
						role="tabpanel"
						aria-labelledby="home-price-changes-today-tab"
						className="min-w-full"
					>
						<TodayPage
							actual={actual}
							locale={locale}
							labels={labels}
						/>
					</section>
					<section
						id="home-price-changes-likely"
						role="tabpanel"
						aria-labelledby="home-price-changes-likely-tab"
						className="min-w-full pl-0"
					>
						<LikelyPage
							likely={likely}
							locale={locale}
							labels={labels}
						/>
					</section>
				</div>
			</div>
		</Card>
	)
}
