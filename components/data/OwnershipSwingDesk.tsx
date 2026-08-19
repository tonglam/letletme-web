'use client'

import { MarketPositionBadge } from '@/components/data/MarketMarkup'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import type { MarketOwnershipChange } from '@/lib/graphql/operations/market'
import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'

function MoverList({
	movers,
	direction,
	locale
}: {
	movers: MarketOwnershipChange[]
	direction: 'rise' | 'fall'
	locale: string
}) {
	const t = useTranslations('Market')
	const formatter = useFormatter()
	const largestMove = Math.max(
		...movers.map(mover => Math.abs(mover.changePercentagePoints)),
		0
	)
	const Icon = direction === 'rise' ? ArrowUpRight : ArrowDownRight

	if (movers.length === 0) {
		return (
			<p className="rounded-md border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground">
				{t(direction === 'rise' ? 'noOwnershipRisers' : 'noOwnershipFallers')}
			</p>
		)
	}

	return (
		<ol
			aria-label={t(
				direction === 'rise' ? 'ownershipRisers' : 'ownershipFallers'
			)}
		>
			{movers.map(mover => {
				const magnitude =
					largestMove > 0
						? Math.abs(mover.changePercentagePoints) / largestMove
						: 0
				const from = formatter.number(mover.fromSelectedByPercent, {
					maximumFractionDigits: 1
				})
				const to = formatter.number(mover.toSelectedByPercent, {
					maximumFractionDigits: 1
				})
				const deltaValue = `${mover.changePercentagePoints > 0 ? '+' : ''}${formatter.number(
					mover.changePercentagePoints,
					{
						maximumFractionDigits: 2
					}
				)}`
				const delta = t('ownershipPercentagePoints', { value: deltaValue })
				return (
					<li
						key={mover.player.playerId}
						className="market-mover-row"
					>
						<span
							aria-hidden="true"
							className={cn(
								'market-mover-bar',
								direction === 'rise' ? 'bg-success' : 'bg-destructive'
							)}
							style={{ width: `${Math.max(magnitude * 100, 4)}%` }}
						/>
						<div className="market-mover-content">
							<MarketPositionBadge position={mover.player.position} />
							<div className="min-w-0 flex-1">
								<a
									href={playerStatsHref({
										p1: String(mover.player.playerId),
										localePathPrefix: locale === 'en' ? '' : `/${locale}`
									})}
									className="market-player-link"
								>
									{mover.player.webName}
								</a>
								<p className="truncate text-[11px] text-muted-foreground">
									{mover.player.teamShortName} ·{' '}
									{t('ownershipFromTo', { from, to })}
								</p>
							</div>
							<div
								className={cn(
									'flex shrink-0 items-center gap-0.5 font-display text-sm font-semibold tabular-nums',
									direction === 'rise' ? 'text-success' : 'text-destructive'
								)}
								title={t('ownershipChangeDetail', { from, to, delta })}
							>
								<Icon
									aria-hidden="true"
									className="size-3.5"
								/>
								{delta}
							</div>
						</div>
					</li>
				)
			})}
		</ol>
	)
}

/** Rising | Falling side-by-side — no nested tabs. */
export function OwnershipSwingDesk({
	risers,
	fallers
}: {
	risers: MarketOwnershipChange[]
	fallers: MarketOwnershipChange[]
}) {
	const t = useTranslations('Market')
	const locale = useLocale()
	return (
		<div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
			<section aria-labelledby="ownership-risers-heading">
				<p
					id="ownership-risers-heading"
					className="mb-2 flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground"
				>
					<ArrowUpRight
						className="size-3.5 text-success"
						aria-hidden="true"
					/>
					{t('ownershipRisers')}
					<span className="font-mono text-muted-foreground">
						({risers.length})
					</span>
				</p>
				<MoverList
					movers={risers}
					direction="rise"
					locale={locale}
				/>
			</section>
			<section aria-labelledby="ownership-fallers-heading">
				<p
					id="ownership-fallers-heading"
					className="mb-2 flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-destructive"
				>
					<ArrowDownRight
						className="size-3.5"
						aria-hidden="true"
					/>
					{t('ownershipFallers')}
					<span className="font-mono text-muted-foreground">
						({fallers.length})
					</span>
				</p>
				<MoverList
					movers={fallers}
					direction="fall"
					locale={locale}
				/>
			</section>
		</div>
	)
}
