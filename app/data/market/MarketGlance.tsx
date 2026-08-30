'use client'

import { ShareActions } from '@/components/share/ShareActions'
import type {
	MarketOwnershipChange,
	MarketOwnershipOverview
} from '@/lib/graphql/operations/market'
import { cn } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, type ReactNode } from 'react'
import { useMarketPlayerSelection } from './MarketPlayerSelection'

function formatOwnership(value: number, locale: string): string {
	return `${new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1,
		signDisplay: 'exceptZero'
	}).format(value)}%`
}

type GlanceCell = {
	label: string
	change: MarketOwnershipChange | null
	tone: 'up' | 'down'
}

export function MarketGlance({
	dailyOwnership,
	gameweekOwnership,
	locale: providedLocale
}: {
	dailyOwnership: MarketOwnershipOverview | null
	gameweekOwnership: MarketOwnershipOverview | null
	locale?: string
}) {
	const t = useTranslations('Market')
	const detectedLocale = useLocale()
	const locale = providedLocale ?? detectedLocale
	const { selectedPlayer, selectPlayer } = useMarketPlayerSelection()
	const cells: GlanceCell[] = [
		{
			label: t('glanceTodayOwnershipRises'),
			change: dailyOwnership?.risers[0] ?? null,
			tone: 'up'
		},
		{
			label: t('glanceTodayOwnershipFalls'),
			change: dailyOwnership?.fallers[0] ?? null,
			tone: 'down'
		},
		{
			label: t('glanceGameweekOwnershipRises'),
			change: gameweekOwnership?.risers[0] ?? null,
			tone: 'up'
		},
		{
			label: t('glanceGameweekOwnershipFalls'),
			change: gameweekOwnership?.fallers[0] ?? null,
			tone: 'down'
		}
	]
	const handlePlayerClick = useCallback(
		(change: MarketOwnershipChange) => {
			selectPlayer(change.player)
			window.requestAnimationFrame(() => {
				document
					.getElementById('market-prices')
					?.scrollIntoView({ behavior: 'smooth', block: 'start' })
			})
		},
		[selectPlayer]
	)
	if (!dailyOwnership && !gameweekOwnership) return null

	return (
		<section
			aria-label={t('glanceTitle')}
			id="market-glance-share"
			data-share-preserve-width="true"
		>
			<div className="mb-3 flex justify-end">
				<ShareActions
					actions={['image']}
					imageTargetId="market-glance-share"
					title={t('glanceTitle')}
					compact
				/>
			</div>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
				{cells.map(cell => {
					const change = cell.change
					const player = change?.player ?? null
					const selected =
						player !== null && selectedPlayer?.id === player.playerId
					return (
						<div
							key={cell.label}
							className={cn(
								'flex min-h-[5.75rem] flex-col justify-between rounded-lg border border-border/70 px-3 py-3',
								selected &&
									'border-primary/70 bg-primary/5 ring-1 ring-primary/30'
							)}
						>
							<p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								{cell.label}
							</p>
							<div className="mt-2 flex min-w-0 items-end justify-between gap-3">
								<p
									className={cn(
										'font-display text-xl font-bold tabular-nums tracking-tight leading-none sm:text-2xl',
										cell.tone === 'up' ? 'text-success' : 'text-destructive'
									)}
								>
									{change
										? formatOwnership(change.changePercentagePoints, locale)
										: '—'}
								</p>
								{change && player ? (
									<button
										type="button"
										onClick={() => handlePlayerClick(change)}
										className="min-w-0 max-w-[58%] text-right text-xs leading-tight text-foreground underline decoration-primary/55 underline-offset-2 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										aria-pressed={selected}
										aria-label={t('openPriceHistory', {
											name: player.webName
										})}
									>
										<span className="block truncate whitespace-nowrap font-medium">
											{player.webName}
										</span>
										<span className="mt-0.5 block truncate whitespace-nowrap text-[10px] text-muted-foreground">
											{player.teamShortName}
										</span>
									</button>
								) : (
									<span className="text-right text-xs text-muted-foreground">
										—
									</span>
								)}
							</div>
						</div>
					)
				})}
			</div>
		</section>
	)
}
