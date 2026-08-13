import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@/i18n/navigation'
import { CacheTag, publicFetchOptions, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_MARKET_PULSE,
	type MarketAvailabilityUpdate,
	type MarketOwnershipMover,
	type MarketPlayer,
	type MarketPulseResponse,
} from '@/lib/graphql/operations/market'
import {
	availabilityBodyText,
	marketAvailabilityStatusKey,
	selectHomeAvailabilityUpdates,
} from '@/lib/market-availability'
import {
	getMarketCoverageMode,
	getMarketTeaserMode,
	shortMarketPosition,
} from '@/lib/market'
import { positionBadgeClass } from '@/lib/position-style'
import { ArrowDownRight, ArrowRight, ArrowUpRight, HeartPulse } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { unstable_rethrow } from 'next/navigation'
import { connection } from 'next/server'

/** Home teaser keeps a short list; full desks live on /explore/market. */
const HOME_TEASER_LIMIT = 5
const HOME_AVAILABILITY_LIMIT = 5
/** Prefer publicly significant ownership; fill below this if the list is short. */
const HOME_AVAILABILITY_MIN_OWNED = 1

export function MarketTeaserFallback() {
	return (
		<section className="py-10" aria-hidden="true">
			<div className="mx-auto max-w-4xl px-4">
				<Card className="rounded-none p-5 sm:rounded-xl sm:p-6">
					<Skeleton className="mb-3 h-4 w-28" />
					<Skeleton className="mb-6 h-8 w-52" />
					<div className="grid gap-3 sm:grid-cols-2">
						{[1, 2, 3, 4].map(item => (
							<Skeleton key={item} className="h-16" />
						))}
					</div>
				</Card>
			</div>
		</section>
	)
}

function TeaserPlayer({ player }: { player: MarketPlayer }) {
	const position = shortMarketPosition(player.position)
	return (
		<>
			<Badge className={positionBadgeClass(position)}>{position}</Badge>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-semibold">{player.webName}</p>
				<p className="text-xs text-muted-foreground">{player.teamShortName}</p>
			</div>
		</>
	)
}

function OwnershipMoverRow({
	mover,
	detailLabel,
	fromToLabel,
}: {
	mover: MarketOwnershipMover
	detailLabel: string
	fromToLabel: string
}) {
	const rising = mover.change > 0
	const Icon = rising ? ArrowUpRight : ArrowDownRight
	const delta = `${rising ? '+' : ''}${mover.change.toFixed(1)}%`

	return (
		<li className="flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2">
			<TeaserPlayer player={mover.player} />
			<div className="shrink-0 text-right" title={detailLabel}>
				<span
					className={`flex items-center justify-end gap-0.5 font-mono text-sm font-bold ${rising ? 'text-success' : 'text-destructive'}`}
				>
					<Icon aria-hidden="true" className="size-4" />
					{delta}
				</span>
				<p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
					{fromToLabel}
				</p>
			</div>
		</li>
	)
}

function AvailabilityTeaserList({
	updates,
	labels,
}: {
	updates: MarketAvailabilityUpdate[]
	labels: {
		empty: string
		status: (key: ReturnType<typeof marketAvailabilityStatusKey>) => string
		body: (update: MarketAvailabilityUpdate) => string
	}
}) {
	if (updates.length === 0) {
		return (
			<p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
				{labels.empty}
			</p>
		)
	}

	return (
		<ul className="grid gap-2 sm:grid-cols-2">
			{updates.map(update => {
				const key = marketAvailabilityStatusKey(update.status)
				return (
					<li key={update.player.playerId} className="min-h-14 rounded-lg border px-3 py-2">
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<p className="truncate text-sm font-semibold">{update.player.webName}</p>
									<Badge variant={key === 'available' ? 'secondary' : 'outline'} className="shrink-0 text-[10px]">
										{labels.status(key)}
									</Badge>
								</div>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{update.player.teamShortName} · {update.player.selectedByPercent.toFixed(1)}%
								</p>
							</div>
						</div>
						<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
							{labels.body(update)}
						</p>
					</li>
				)
			})}
		</ul>
	)
}

export async function MarketTeaser() {
	await connection()
	const t = await getTranslations('Market')
	let response: MarketPulseResponse

	try {
		response = await executePublicServerQuery<MarketPulseResponse>(
			GET_MARKET_PULSE,
			{ days: 14 },
			publicFetchOptions({
				revalidate: RevalidateSeconds.market,
				tags: [CacheTag.market],
			}),
		)
	} catch (error) {
		unstable_rethrow(error)
		console.error('[market-teaser] RSC fetch failed:', error)
		return null
	}

	const pulse = response.marketPulse
	const teaserMode = getMarketTeaserMode(pulse)
	const coverageMode = getMarketCoverageMode(pulse.coverage)
	// Keep rise / fall separate so the desk reads like a transfer board, not a mixed top-3.
	const ownershipRisers = [...pulse.ownershipMovers.risers]
		.sort((a, b) => b.change - a.change)
		.slice(0, HOME_TEASER_LIMIT)
	const ownershipFallers = [...pulse.ownershipMovers.fallers]
		.sort((a, b) => a.change - b.change)
		.slice(0, HOME_TEASER_LIMIT)
	const availability = selectHomeAvailabilityUpdates(
		pulse.availabilityUpdates,
		HOME_AVAILABILITY_LIMIT,
		HOME_AVAILABILITY_MIN_OWNED,
	)

	const coverageCopy =
		coverageMode === 'last-14-days'
			? t('homeLast14')
			: coverageMode === 'empty'
				? t('homeAwaitingCapture')
				: t('homeSinceTracking')
	const availabilityLabels = {
		empty: t('noAvailabilityUpdates'),
		status: (key: ReturnType<typeof marketAvailabilityStatusKey>) => t(`status.${key}`),
		body: (update: MarketAvailabilityUpdate) =>
			availabilityBodyText(update, key => t(key)),
	}

	return (
		<section className="py-10" aria-labelledby="home-market-title">
			<div className="mx-auto max-w-4xl px-4">
				<Card className="overflow-hidden rounded-none border-electric/20 sm:rounded-xl">
					<CardHeader className="border-b bg-muted/30 pb-5">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<p className="chyron">{t('homeEyebrow')}</p>
								<CardTitle asChild>
									<h2
										id="home-market-title"
										className="mt-2 text-2xl font-bold uppercase tracking-wide sm:text-3xl"
									>
										{t('homeTitle')}
									</h2>
								</CardTitle>
								<p className="mt-2 text-sm text-muted-foreground">{coverageCopy}</p>
							</div>
							<Button
								asChild
								className="min-h-11 shrink-0 font-display font-semibold uppercase tracking-[0.08em]"
							>
								<Link href="/explore/market" prefetch={false}>
									{t('openMarket')} <ArrowRight aria-hidden="true" />
								</Link>
							</Button>
						</div>
					</CardHeader>

					{teaserMode === 'ownership' ? (
						<CardContent className="space-y-6 pt-6">
							{/* Split board: who managers are buying into vs selling away */}
							<div className="grid gap-6 md:grid-cols-2">
								<div>
									<h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.12em] text-success">
										<ArrowUpRight aria-hidden="true" className="size-4" />
										{t('homeOwnershipRising')}
									</h3>
									{ownershipRisers.length > 0 ? (
										<ol className="space-y-2" aria-label={t('homeOwnershipRising')}>
											{ownershipRisers.map(mover => {
												const from = mover.previousSelectedByPercent.toFixed(1)
												const to = mover.selectedByPercent.toFixed(1)
												const delta = `+${mover.change.toFixed(1)}%`
												return (
													<OwnershipMoverRow
														key={mover.player.playerId}
														mover={mover}
														detailLabel={t('ownershipChangeDetail', { from, to, delta })}
														fromToLabel={t('ownershipFromTo', { from, to })}
													/>
												)
											})}
										</ol>
									) : (
										<p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
											{t('noOwnershipRisers')}
										</p>
									)}
								</div>
								<div>
									<h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.12em] text-destructive">
										<ArrowDownRight aria-hidden="true" className="size-4" />
										{t('homeOwnershipFalling')}
									</h3>
									{ownershipFallers.length > 0 ? (
										<ol className="space-y-2" aria-label={t('homeOwnershipFalling')}>
											{ownershipFallers.map(mover => {
												const from = mover.previousSelectedByPercent.toFixed(1)
												const to = mover.selectedByPercent.toFixed(1)
												const delta = `${mover.change.toFixed(1)}%`
												return (
													<OwnershipMoverRow
														key={mover.player.playerId}
														mover={mover}
														detailLabel={t('ownershipChangeDetail', { from, to, delta })}
														fromToLabel={t('ownershipFromTo', { from, to })}
													/>
												)
											})}
										</ol>
									) : (
										<p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
											{t('noOwnershipFallers')}
										</p>
									)}
								</div>
							</div>

							<div>
								<h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
									<HeartPulse aria-hidden="true" className="size-4 text-pink" />
									{t('availabilityWatch')}
								</h3>
								<AvailabilityTeaserList updates={availability} labels={availabilityLabels} />
							</div>
						</CardContent>
					) : (
						<CardContent className="grid gap-6 pt-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
							<div>
								<h3 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
									{teaserMode === 'price'
										? t('latestPriceMoves')
										: teaserMode === 'selected'
											? t('mostSelectedNow')
											: t('trackingStartsSoon')}
								</h3>
								{teaserMode === 'empty' ? (
									<p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
										{t('homeEmptyDescription', { time: '09:40 UTC+8' })}
									</p>
								) : (
									<ol className="space-y-2">
										{teaserMode === 'price' &&
											pulse.priceChanges.slice(0, HOME_TEASER_LIMIT).map((change, index) => {
												const rising = change.direction === 'RISE'
												const Icon = rising ? ArrowUpRight : ArrowDownRight
												return (
													<li
														key={`${change.player.playerId}-${index}`}
														className="flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2"
													>
														<TeaserPlayer player={change.player} />
														<span
															className={`flex items-center gap-1 font-mono text-sm font-bold ${rising ? 'text-success' : 'text-destructive'}`}
														>
															<Icon aria-hidden="true" className="size-4" />
															{rising ? '+' : '-'}£{(Math.abs(change.change) / 10).toFixed(1)}m
														</span>
													</li>
												)
											})}
										{teaserMode === 'selected' &&
											pulse.mostSelected.slice(0, HOME_TEASER_LIMIT).map(player => (
												<li
													key={player.playerId}
													className="flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2"
												>
													<TeaserPlayer player={player} />
													<span className="font-mono text-sm font-bold text-primary-ink">
														{player.selectedByPercent.toFixed(1)}%
													</span>
												</li>
											))}
									</ol>
								)}
							</div>

							<div>
								<h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
									<HeartPulse aria-hidden="true" className="size-4 text-pink" /> {t('availabilityWatch')}
								</h3>
								<AvailabilityTeaserList updates={availability} labels={availabilityLabels} />
							</div>
						</CardContent>
					)}
				</Card>
			</div>
		</section>
	)
}
