import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@/i18n/navigation'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_MARKET_PULSE,
	type MarketPlayer,
	type MarketPulseResponse,
} from '@/lib/graphql/operations/market'
import {
	getMarketCoverageMode,
	getMarketTeaserMode,
	rankOwnershipMovers,
	shortMarketPosition,
} from '@/lib/market'
import { positionBadgeClass } from '@/lib/position-style'
import { ArrowDownRight, ArrowRight, ArrowUpRight, HeartPulse } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { unstable_rethrow } from 'next/navigation'
import { connection } from 'next/server'

export function MarketTeaserFallback() {
	return (
		<section className="py-10" aria-hidden="true">
			<div className="mx-auto max-w-4xl px-4">
				<Card className="rounded-none p-5 sm:rounded-xl sm:p-6">
					<Skeleton className="mb-3 h-4 w-28" />
					<Skeleton className="mb-6 h-8 w-52" />
					<div className="grid gap-3 sm:grid-cols-3">
						{[1, 2, 3].map(item => <Skeleton key={item} className="h-16" />)}
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

export async function MarketTeaser() {
	await connection()
	const t = await getTranslations('Market')
	let response: MarketPulseResponse

	try {
		response = await executePublicServerQuery<MarketPulseResponse>(
			GET_MARKET_PULSE,
			{ days: 14 },
			{ cache: 'no-store', timeoutMs: 5_000 },
		)
	} catch (error) {
		unstable_rethrow(error)
		console.error('[market-teaser] RSC fetch failed:', error)
		return null
	}

	const pulse = response.marketPulse
	const teaserMode = getMarketTeaserMode(pulse)
	const coverageMode = getMarketCoverageMode(pulse.coverage)
	const ownership = rankOwnershipMovers(
		pulse.ownershipMovers.risers,
		pulse.ownershipMovers.fallers,
	).slice(0, 3)
	const availability = pulse.availabilityUpdates.slice(0, 2)

	return (
		<section className="py-10" aria-labelledby="home-market-title">
			<div className="mx-auto max-w-4xl px-4">
				<Card className="overflow-hidden rounded-none border-electric/20 sm:rounded-xl">
					<CardHeader className="border-b bg-muted/30 pb-5">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<p className="chyron">{t('homeEyebrow')}</p>
								<CardTitle asChild>
									<h2 id="home-market-title" className="mt-2 text-2xl font-bold uppercase tracking-wide sm:text-3xl">
										{t('homeTitle')}
									</h2>
								</CardTitle>
								<p className="mt-2 text-sm text-muted-foreground">
									{coverageMode === 'last-14-days'
										? t('homeLast14')
										: coverageMode === 'empty'
											? t('homeAwaitingCapture')
											: t('homeSinceTracking')}
								</p>
							</div>
							<Button asChild className="min-h-11 shrink-0 font-display font-semibold uppercase tracking-[0.08em]">
								<Link href="/data/price-changes">
									{t('openMarket')} <ArrowRight aria-hidden="true" />
								</Link>
							</Button>
						</div>
					</CardHeader>
					<CardContent className="grid gap-6 pt-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
						<div>
							<h3 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
								{teaserMode === 'price'
									? t('latestPriceMoves')
									: teaserMode === 'ownership'
										? t('latestOwnershipMoves')
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
									{teaserMode === 'price' && pulse.priceChanges.slice(0, 3).map((change, index) => {
										const rising = change.direction === 'RISE'
										const Icon = rising ? ArrowUpRight : ArrowDownRight
										return (
											<li key={`${change.player.playerId}-${index}`} className="flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2">
												<TeaserPlayer player={change.player} />
												<span className={`flex items-center gap-1 font-mono text-sm font-bold ${rising ? 'text-success' : 'text-destructive'}`}>
													<Icon aria-hidden="true" className="size-4" />
													{rising ? '+' : '-'}£{(Math.abs(change.change) / 10).toFixed(1)}m
												</span>
											</li>
										)
									})}
									{teaserMode === 'ownership' && ownership.map(mover => (
										<li key={mover.player.playerId} className="flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2">
											<TeaserPlayer player={mover.player} />
											<span className={`font-mono text-sm font-bold ${mover.change > 0 ? 'text-success' : 'text-destructive'}`}>
												{mover.change > 0 ? '+' : ''}{mover.change.toFixed(1)} {t('percentagePointsShort')}
											</span>
										</li>
									))}
									{teaserMode === 'selected' && pulse.mostSelected.slice(0, 3).map(player => (
										<li key={player.playerId} className="flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2">
											<TeaserPlayer player={player} />
											<span className="font-mono text-sm font-bold text-primary-ink">{player.selectedByPercent.toFixed(1)}%</span>
										</li>
									))}
								</ol>
							)}
						</div>

						<div>
							<h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
								<HeartPulse aria-hidden="true" className="size-4 text-pink" /> {t('availabilityWatch')}
							</h3>
							{availability.length > 0 ? (
								<ul className="space-y-2">
									{availability.map(update => (
										<li key={update.player.playerId} className="min-h-14 rounded-lg border px-3 py-2">
											<div className="flex items-center justify-between gap-3">
												<p className="truncate text-sm font-semibold">{update.player.webName}</p>
												<span className="shrink-0 font-mono text-xs text-muted-foreground">{update.player.selectedByPercent.toFixed(1)}%</span>
											</div>
											<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{update.news || t('availabilityRecovered')}</p>
										</li>
									))}
								</ul>
							) : (
								<p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t('noAvailabilityUpdates')}</p>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</section>
	)
}
