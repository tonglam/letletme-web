'use client'

import { Badge } from '@/components/ui/badge'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { Link } from '@/i18n/navigation'
import type { MarketOwnershipMover } from '@/lib/graphql/operations/market'
import { shortMarketPosition } from '@/lib/market'
import { positionBadgeClass } from '@/lib/position-style'
import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

function MoverList({
	movers,
	direction
}: {
	movers: MarketOwnershipMover[]
	direction: 'rise' | 'fall'
}) {
	const t = useTranslations('Market')
	const formatter = useFormatter()
	const largestMove = Math.max(
		...movers.map(mover => Math.abs(mover.change)),
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
					largestMove > 0 ? Math.abs(mover.change) / largestMove : 0
				const from = formatter.number(mover.previousSelectedByPercent, {
					maximumFractionDigits: 1
				})
				const to = formatter.number(mover.selectedByPercent, {
					maximumFractionDigits: 1
				})
				const delta = `${mover.change > 0 ? '+' : ''}${formatter.number(
					mover.change,
					{
						maximumFractionDigits: 2
					}
				)}%`
				return (
					<li
						key={mover.player.playerId}
						className="relative overflow-hidden border-b border-border/50 py-2 last:border-b-0"
					>
						<span
							aria-hidden="true"
							className={cn(
								'absolute inset-y-0 left-0 opacity-[0.07]',
								direction === 'rise' ? 'bg-success' : 'bg-destructive'
							)}
							style={{ width: `${Math.max(magnitude * 100, 4)}%` }}
						/>
						<div className="relative flex items-center gap-2.5">
							<Badge
								className={cn(
									positionBadgeClass(
										shortMarketPosition(mover.player.position)
									),
									'shrink-0 text-[10px]'
								)}
							>
								{shortMarketPosition(mover.player.position)}
							</Badge>
							<div className="min-w-0 flex-1">
								<Link
									prefetch={false}
									href={playerStatsHref({ p1: String(mover.player.playerId) })}
									className="truncate text-sm font-medium leading-tight text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
								>
									{mover.player.webName}
								</Link>
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
	risers: MarketOwnershipMover[]
	fallers: MarketOwnershipMover[]
}) {
	const t = useTranslations('Market')
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
				/>
			</section>
		</div>
	)
}
