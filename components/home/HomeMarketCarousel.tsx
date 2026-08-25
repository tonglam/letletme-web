'use client'

import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import {
	HomeAutoCarousel,
	type HomeAutoCarouselSlide
} from '@/components/home/HomeAutoCarousel'
import { MarketPositionBadge } from '@/components/data/MarketMarkup'
import { Card } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import type {
	MarketAvailabilityUpdate,
	MarketOwnershipChange
} from '@/lib/graphql/operations/market'
import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'

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
	pause: string
	resume: string
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
	availabilityState: 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE'
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
	availabilityState,
	locale,
	labels
}: HomeMarketCarouselProps) {
	const slides: HomeAutoCarouselSlide[] = [
		{
			id: 'ownership',
			label: labels.ownershipPage,
			enabled: ownership.state !== 'UNAVAILABLE',
			content: (
				<OwnershipPage
					ownership={ownership}
					labels={labels}
					locale={locale}
				/>
			)
		},
		{
			id: 'availability',
			label: labels.availabilityPage,
			enabled: availabilityState !== 'UNAVAILABLE',
			content: (
				<AvailabilityTeaserList
					updates={availability}
					emptyLabel={labels.availabilityEmpty}
					locale={locale}
				/>
			)
		}
	]
	if (!slides.some(slide => slide.enabled !== false)) return null

	return (
		<Card
			aria-labelledby="home-market-title"
			className="flex h-full flex-col rounded-none p-4 sm:rounded-lg sm:p-6 lg:p-8"
		>
			<HomeAutoCarousel
				slides={slides}
				labels={labels}
				dataAttribute="market"
				renderHeader={slide => (
					<div>
						<h2
							id="home-market-title"
							className="font-display text-xl font-bold uppercase tracking-wide"
						>
							{slide.label}
						</h2>
						<p className="mt-1 max-w-sm text-xs text-muted-foreground">
							{slide.id === 'ownership'
								? labels.ownershipDescription
								: labels.availabilityDescription}
						</p>
					</div>
				)}
				renderAction={() => (
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
				)}
			/>
		</Card>
	)
}
