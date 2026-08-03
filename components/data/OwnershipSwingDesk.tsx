'use client'

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
			<p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
				{t(direction === 'rise' ? 'noOwnershipRisers' : 'noOwnershipFallers')}
			</p>
		)
	}

	return (
		<ol className="space-y-2" aria-label={t(direction === 'rise' ? 'ownershipRisers' : 'ownershipFallers')}>
			{movers.map(mover => {
				const magnitude = largestMove > 0 ? Math.abs(mover.change) / largestMove : 0
				const signedChange = `${mover.change > 0 ? '+' : ''}${formatter.number(mover.change, {
					maximumFractionDigits: 2,
				})}`
				return (
					<li
						key={mover.player.playerId}
						className="relative min-h-16 overflow-hidden rounded-lg border bg-background/80 px-3 py-3"
					>
						<span
							aria-hidden="true"
							className={`absolute inset-y-0 left-0 opacity-10 ${direction === 'rise' ? 'bg-success' : 'bg-destructive'}`}
							style={{ width: `${Math.max(magnitude * 100, 4)}%` }}
						/>
						<div className="relative flex items-center gap-3">
							<Badge className={positionBadgeClass(shortMarketPosition(mover.player.position))}>
								{shortMarketPosition(mover.player.position)}
							</Badge>
							<div className="min-w-0 flex-1">
								<p className="truncate font-semibold">{mover.player.webName}</p>
								<p className="text-xs text-muted-foreground">
									{mover.player.teamShortName} · {formatter.number(mover.previousSelectedByPercent, { maximumFractionDigits: 1 })}% → {formatter.number(mover.selectedByPercent, { maximumFractionDigits: 1 })}%
								</p>
							</div>
							<div className={`flex shrink-0 items-center gap-1 font-mono text-sm font-bold ${direction === 'rise' ? 'text-success' : 'text-destructive'}`}>
								<Icon aria-hidden="true" className="size-4" />
								<span>{signedChange} {t('percentagePointsShort')}</span>
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
		<Tabs defaultValue="risers">
			<TabsList className="mb-4 grid h-12 w-full grid-cols-2 sm:w-80">
				<TabsTrigger className="min-h-11" value="risers">
					{t('risersTab', { count: risers.length })}
				</TabsTrigger>
				<TabsTrigger className="min-h-11" value="fallers">
					{t('fallersTab', { count: fallers.length })}
				</TabsTrigger>
			</TabsList>
			<TabsContent value="risers">
				<MoverList movers={risers} direction="rise" />
			</TabsContent>
			<TabsContent value="fallers">
				<MoverList movers={fallers} direction="fall" />
			</TabsContent>
		</Tabs>
	)
}
