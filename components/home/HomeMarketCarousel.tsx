'use client'

import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { MarketPositionBadge } from '@/components/data/MarketMarkup'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import type {
	MarketAvailabilityUpdate,
	MarketOwnershipChange
} from '@/lib/graphql/operations/market'
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

export type HomeMarketOwnershipMover = {
	player: MarketOwnershipChange['player']
	changePercentagePoints: number
	fromToLabel: string
	deltaLabel: string
	detailLabel: string
}

export type HomeMarketAvailabilityItem = {
	player: MarketAvailabilityUpdate['player']
	statusLabel: string
	body: string
}

export type HomeMarketCarouselLabels = {
	ownershipPage: string
	ownershipDescription: string
	availabilityPage: string
	availabilityDescription: string
	openMarket: string
	previousPage: string
	nextPage: string
	pagerLabel: string
	ownershipRising: string
	ownershipFalling: string
	noOwnershipRisers: string
	noOwnershipFallers: string
	ownershipEmptyTitle: string
	ownershipEmptyDescription: string
	ownershipUnavailableTitle: string
	ownershipUnavailableDescription: string
	availabilityEmpty: string
}

export type HomeMarketCarouselProps = {
	ownership: {
		state: 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE'
		risers: HomeMarketOwnershipMover[]
		fallers: HomeMarketOwnershipMover[]
	}
	availability: HomeMarketAvailabilityItem[]
	locale: string
	labels: HomeMarketCarouselLabels
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

function OwnershipMoverRow({
	mover,
	direction,
	locale
}: {
	mover: HomeMarketOwnershipMover
	direction: 'rise' | 'fall'
	locale: string
}) {
	const isRise = direction === 'rise'

	return (
		<li className="home-market-mover-row">
			<MarketPositionBadge position={mover.player.position} />
			<div className="min-w-0">
				<a
					href={playerStatsHref({
						p1: String(mover.player.playerId),
						localePathPrefix: locale === 'en' ? '' : `/${locale}`
					})}
					className="block whitespace-nowrap text-sm font-semibold leading-tight text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
				>
					{mover.player.webName}
				</a>
				<p className="text-xs text-muted-foreground">
					{mover.player.teamShortName}
				</p>
			</div>
			<div
				className={cn(
					'home-market-mover-meta',
					isRise ? 'text-success' : 'text-destructive'
				)}
				title={mover.detailLabel}
			>
				<p className="min-w-0 truncate text-xs text-muted-foreground">
					{mover.fromToLabel}
				</p>
				<span className="shrink-0 font-display text-sm font-bold tabular-nums">
					{isRise ? (
						<ArrowUpRight
							aria-hidden="true"
							className="mr-0.5 inline size-3.5"
						/>
					) : (
						<ArrowDownRight
							aria-hidden="true"
							className="mr-0.5 inline size-3.5"
						/>
					)}
					{mover.deltaLabel}
				</span>
			</div>
		</li>
	)
}

function OwnershipDirection({
	movers,
	direction,
	locale,
	title,
	emptyLabel
}: {
	movers: HomeMarketOwnershipMover[]
	direction: 'rise' | 'fall'
	locale: string
	title: string
	emptyLabel: string
}) {
	const isRise = direction === 'rise'
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
			</h3>
			{movers.length === 0 ? (
				<div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-5 text-center">
					<Minus
						aria-hidden="true"
						className="mx-auto size-4 text-muted-foreground"
					/>
					<p className="mt-2 text-xs text-muted-foreground">{emptyLabel}</p>
				</div>
			) : (
				<ol
					className="space-y-2"
					aria-label={title}
				>
					{movers.map(mover => (
						<OwnershipMoverRow
							key={mover.player.playerId}
							mover={mover}
							direction={direction}
							locale={locale}
						/>
					))}
				</ol>
			)}
		</section>
	)
}

function AvailabilityTeaserList({
	updates,
	emptyLabel,
	locale
}: {
	updates: HomeMarketAvailabilityItem[]
	emptyLabel: string
	locale: string
}) {
	if (updates.length === 0) {
		return (
			<EmptyState
				title={emptyLabel}
				description={undefined}
			/>
		)
	}

	return (
		<ul className="grid gap-2 sm:grid-cols-2">
			{updates.map(update => (
				<li
					key={update.player.playerId}
					className="min-h-14 rounded-lg border px-3 py-2"
				>
					<div className="flex items-start gap-2.5">
						<MarketPositionBadge position={update.player.position} />
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<a
									href={playerStatsHref({
										p1: String(update.player.playerId),
										localePathPrefix: locale === 'en' ? '' : `/${locale}`
									})}
									className="min-w-0 whitespace-nowrap text-sm font-semibold leading-tight text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
								>
									{update.player.webName}
								</a>
								<span className="shrink-0 rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
									{update.statusLabel}
								</span>
							</div>
							<p className="mt-0.5 text-xs text-muted-foreground">
								{update.player.teamShortName} ·{' '}
								{update.player.selectedByPercent.toFixed(1)}%
							</p>
							<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
								{update.body}
							</p>
						</div>
					</div>
				</li>
			))}
		</ul>
	)
}

function OwnershipPage({
	ownership,
	labels,
	locale
}: {
	ownership: HomeMarketCarouselProps['ownership']
	labels: HomeMarketCarouselLabels
	locale: string
}) {
	if (ownership.state === 'UNAVAILABLE') {
		return (
			<UnavailableState
				title={labels.ownershipUnavailableTitle}
				description={labels.ownershipUnavailableDescription}
			/>
		)
	}

	if (ownership.state === 'EMPTY') {
		return (
			<EmptyState
				title={labels.ownershipEmptyTitle}
				description={labels.ownershipEmptyDescription}
			/>
		)
	}

	return (
		<div className="grid gap-6 md:grid-cols-2">
			<OwnershipDirection
				movers={ownership.risers}
				direction="rise"
				locale={locale}
				title={labels.ownershipRising}
				emptyLabel={labels.noOwnershipRisers}
			/>
			<OwnershipDirection
				movers={ownership.fallers}
				direction="fall"
				locale={locale}
				title={labels.ownershipFalling}
				emptyLabel={labels.noOwnershipFallers}
			/>
		</div>
	)
}

export function HomeMarketCarousel({
	ownership,
	availability,
	locale,
	labels
}: HomeMarketCarouselProps) {
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

	const pageTitle =
		activePage === 0 ? labels.ownershipPage : labels.availabilityPage
	const pageDescription =
		activePage === 0
			? labels.ownershipDescription
			: labels.availabilityDescription

	return (
		<Card
			className="flex h-full flex-col rounded-none p-4 sm:rounded-lg sm:p-6 lg:p-8"
			aria-labelledby="home-market-title"
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
					<h2
						id="home-market-title"
						className="font-display text-xl font-bold uppercase tracking-wide"
					>
						{pageTitle}
					</h2>
					<p className="mt-1 max-w-sm text-xs text-muted-foreground">
						{pageDescription}
					</p>
				</div>
				<Link
					href="/explore/market"
					prefetch={false}
					className="inline-flex min-h-9 shrink-0 items-center gap-1.5 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
				>
					{labels.openMarket}
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
						id="home-market-ownership-tab"
						role="tab"
						aria-selected={activePage === 0}
						aria-controls="home-market-ownership"
						onClick={() => setActivePage(0)}
						className={cn(
							'flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors',
							activePage === 0
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<span className="truncate">{labels.ownershipPage}</span>
					</button>
					<button
						type="button"
						id="home-market-availability-tab"
						role="tab"
						aria-selected={activePage === 1}
						aria-controls="home-market-availability"
						onClick={() => setActivePage(1)}
						className={cn(
							'flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors',
							activePage === 1
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<span className="truncate">{labels.availabilityPage}</span>
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

			<div
				className="overflow-hidden"
				aria-live="polite"
			>
				<div
					className="flex w-full motion-reduce:transition-none"
					style={{
						transform: `translateX(-${activePage * 100}%)`,
						transition: 'transform 280ms ease-out'
					}}
				>
					<section
						id="home-market-ownership"
						role="tabpanel"
						aria-labelledby="home-market-ownership-tab"
						className="min-w-full"
					>
						<OwnershipPage
							ownership={ownership}
							labels={labels}
							locale={locale}
						/>
					</section>
					<section
						id="home-market-availability"
						role="tabpanel"
						aria-labelledby="home-market-availability-tab"
						className="min-w-full"
					>
						<AvailabilityTeaserList
							updates={availability}
							emptyLabel={labels.availabilityEmpty}
							locale={locale}
						/>
					</section>
				</div>
			</div>
		</Card>
	)
}
