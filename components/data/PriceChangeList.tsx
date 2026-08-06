'use client'

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatCompactNumber } from '@/lib/utils'
import { PlayerOption } from '@/types/common'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface PriceChange {
	player: PlayerOption
	oldPrice: number
	newPrice: number
	date: string | null
	positionKnown?: boolean
	transfersIn?: number
	transfersOut?: number
}

interface PriceChangeListProps {
	title: string
	changes: PriceChange[]
	type: 'rise' | 'fall'
}

export function PriceChangeList({
	title,
	changes,
	type,
}: PriceChangeListProps) {
	const t = useTranslations('PriceChangeList')
	const icon =
		type === 'rise' ? (
			<ArrowUpRight className="size-5 shrink-0 text-success" />
		) : (
			<ArrowDownRight className="size-5 shrink-0 text-destructive" />
		)

	const priceClassName =
		type === 'rise' ? 'text-success' : 'text-destructive'

	return (
		<div>
			<h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold tracking-tight">
				{icon}
				{title}
			</h3>
			<div className="space-y-2">
				{changes.map(change => (
					<div
						key={change.player.id}
						className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 p-2.5 sm:p-3 dark:bg-muted/25"
					>
						<div className="flex min-w-0 flex-1 items-center gap-2">
							<span className="w-8 shrink-0 text-xs font-medium text-muted-foreground sm:text-sm">
								{change.player.position}
							</span>
							<span className="w-8 shrink-0 text-xs font-medium text-muted-foreground sm:text-sm">
								{change.player.team}
							</span>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<span
											tabIndex={0}
											className="flex-1 truncate rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											{change.player.name}
										</span>
									</TooltipTrigger>
									<TooltipContent>
										<p>
											{change.player.name} ({change.player.team})
										</p>
										{change.date ? (
											<p className="text-xs text-muted-foreground">
												{change.date}
											</p>
										) : null}
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
						<div className="flex flex-col items-end">
							<span
								className={`ml-2 shrink-0 font-display text-xs font-semibold tabular-nums sm:text-sm ${priceClassName}`}
							>
								{type === 'rise' ? '+' : '-'}£
								{Math.abs(change.newPrice - change.oldPrice).toFixed(1)}m
							</span>
							<span className="text-xs text-muted-foreground">
								{change.oldPrice.toFixed(1)}m → {change.newPrice.toFixed(1)}m
							</span>
							{(change.transfersIn || change.transfersOut) && (
								<span className="mt-1 text-xs text-muted-foreground">
									{type === 'rise'
										? t('transfersIn', {
												count: formatCompactNumber(change.transfersIn || 0),
											})
										: t('transfersOut', {
												count: formatCompactNumber(change.transfersOut || 0),
											})}
								</span>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
