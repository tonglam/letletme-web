'use client'

import { MarketPositionBadge } from '@/components/data/MarketMarkup'
import { ShareActions } from '@/components/share/ShareActions'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import type { MarketPlayer } from '@/lib/graphql/operations/market'
import {
	filterMarketPlayersByPosition,
	MARKET_POSITION_FILTERS,
	type MarketPositionFilter
} from '@/lib/market'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

function formatOwnership(value: number, locale: string): string {
	return `${new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1
	}).format(value)}%`
}

const positionLabels = {
	ALL: 'mostSelectedAllPositions',
	GOALKEEPER: 'mostSelectedGoalkeepers',
	DEFENDER: 'mostSelectedDefenders',
	MIDFIELDER: 'mostSelectedMidfielders',
	FORWARD: 'mostSelectedForwards'
} as const

export function MostSelectedColumn({
	players,
	locale
}: {
	players: MarketPlayer[]
	locale: string
}) {
	const t = useTranslations('Market')
	const tExplore = useTranslations('MarketExplore')
	const [position, setPosition] = useState<MarketPositionFilter>('ALL')
	const filteredPlayers = useMemo(
		() => filterMarketPlayersByPosition(players, position),
		[players, position]
	)

	return (
		<>
			<div className="mb-3 flex flex-col gap-3 border-b border-border/60 pb-2 sm:flex-row sm:items-center sm:justify-between">
				<h2
					id="market-most-selected"
					className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl"
				>
					{t('mostSelectedTitle')}
				</h2>
				<div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end">
					<div
						role="group"
						aria-label={tExplore('mostSelectedPositionFilterLabel')}
						className="flex min-w-0 flex-wrap gap-1.5"
						data-share-exclude="true"
					>
						{MARKET_POSITION_FILTERS.map(filter => {
							const active = position === filter
							return (
								<button
									key={filter}
									type="button"
									data-market-position-filter={filter}
									aria-pressed={active}
									onClick={() => setPosition(filter)}
									className={cn(
										'whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
										active
											? 'border-primary bg-primary text-primary-foreground shadow-sm'
											: 'border-border/70 bg-background/70 text-muted-foreground hover:border-primary/50 hover:text-foreground'
									)}
								>
									{tExplore(positionLabels[filter])}
								</button>
							)
						})}
					</div>
					<ShareActions
						actions={['image']}
						imageTargetId="market-most-selected-share"
						title={t('mostSelectedTitle')}
						compact
					/>
				</div>
			</div>

			{filteredPlayers.length === 0 ? (
				<p
					className="rounded-md border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground"
					role="status"
				>
					{t('noData')}
				</p>
			) : (
				<ul className="grid gap-x-6 sm:grid-cols-2">
					{filteredPlayers.map(player => (
						<li
							key={player.playerId}
							className="market-dense-row"
						>
							<MarketPositionBadge position={player.position} />
							<div className="min-w-0 flex-1">
								<a
									href={playerStatsHref({
										p1: String(player.playerId),
										localePathPrefix: locale === 'en' ? '' : `/${locale}`
									})}
									className="market-player-link"
								>
									{player.webName}
								</a>
								<p className="market-player-subtext">
									{player.teamShortName} · £{(player.price / 10).toFixed(1)}m
								</p>
							</div>
							<div className="market-dense-row__trailing">
								<span className="font-display text-sm font-semibold tabular-nums">
									{formatOwnership(player.selectedByPercent, locale)}
								</span>
							</div>
						</li>
					))}
				</ul>
			)}
		</>
	)
}
