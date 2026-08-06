'use client'

import { StatsTabsShell } from '@/components/stats/StatsSurfaces'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { MarketOwnershipMover } from '@/lib/graphql/operations/market'
import { shortMarketPosition } from '@/lib/market'
import { positionBadgeClass } from '@/lib/position-style'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

function MoverList({
	movers,
	direction,
}: {
	movers: MarketOwnershipMover[]
	direction: 'rise' | 'fall'
}) {
	const t = useTranslations('Market')
	const formatter = useFormatter()
	const largestMove = Math.max(...movers.map(mover => Math.abs(mover.change)), 0)
	const Icon = direction === 'rise' ? ArrowUpRight : ArrowDownRight

	if (movers.length === 0) {
		return (
			<p className="rounded-lg border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
				{t(direction === 'rise' ? 'noOwnershipRisers' : 'noOwnershipFallers')}
			</p>
		)
	}

	return (
		<ol
			className="space-y-2"
			aria-label={t(direction === 'rise' ? 'ownershipRisers' : 'ownershipFallers')}
		>
			{movers.map(mover => {
				const magnitude =
					largestMove > 0 ? Math.abs(mover.change) / largestMove : 0
				const from = formatter.number(mover.previousSelectedByPercent, {
					maximumFractionDigits: 1,
				})
				const to = formatter.number(mover.selectedByPercent, {
					maximumFractionDigits: 1,
				})
				const delta = `${mover.change > 0 ? '+' : ''}${formatter.number(mover.change, {
					maximumFractionDigits: 2,
				})}%`
				return (
					<li
						key={mover.player.playerId}
						className="relative min-h-14 overflow-hidden rounded-lg border border-border/70 bg-muted/40 px-3 py-3 dark:bg-muted/25"
					>
						<span
							aria-hidden="true"
							className={`absolute inset-y-0 left-0 opacity-[0.08] ${
								direction === 'rise' ? 'bg-success' : 'bg-destructive'
							}`}
							style={{ width: `${Math.max(magnitude * 100, 4)}%` }}
						/>
						<div className="relative flex items-center gap-3">
							<Badge
								className={positionBadgeClass(
									shortMarketPosition(mover.player.position),
								)}
							>
								{shortMarketPosition(mover.player.position)}
							</Badge>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">
									{mover.player.webName}
								</p>
								<p className="text-xs text-muted-foreground">
									{mover.player.teamShortName} ·{' '}
									{t('ownershipFromTo', { from, to })}
								</p>
							</div>
							<div
								className={`flex shrink-0 flex-col items-end font-display text-sm font-semibold tabular-nums ${
									direction === 'rise' ? 'text-success' : 'text-destructive'
								}`}
								title={t('ownershipChangeDetail', { from, to, delta })}
							>
								<span className="flex items-center gap-1">
									<Icon aria-hidden="true" className="size-4" />
									{delta}
								</span>
								<span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
									{t('ownershipLabel')}
								</span>
							</div>
						</div>
					</li>
				)
			})}
		</ol>
	)
}

export function OwnershipSwingDesk({
	risers,
	fallers,
}: {
	risers: MarketOwnershipMover[]
	fallers: MarketOwnershipMover[]
}) {
	const t = useTranslations('Market')

	return (
		<Tabs defaultValue="risers" className="space-y-4">
			<StatsTabsShell>
				<TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 sm:gap-2">
					<TabsTrigger value="risers" className="gap-1.5">
						{t('risersTab', { count: risers.length })}
					</TabsTrigger>
					<TabsTrigger value="fallers" className="gap-1.5">
						{t('fallersTab', { count: fallers.length })}
					</TabsTrigger>
				</TabsList>
			</StatsTabsShell>
			<TabsContent value="risers" className="mt-0">
				<MoverList movers={risers} direction="rise" />
			</TabsContent>
			<TabsContent value="fallers" className="mt-0">
				<MoverList movers={fallers} direction="fall" />
			</TabsContent>
		</Tabs>
	)
}
