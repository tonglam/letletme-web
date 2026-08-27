'use client'

import { MarketPositionBadge } from '@/components/data/MarketMarkup'
import type { PriceChangePlayer } from '@/lib/graphql/operations/price-changes'
import {
	PRICE_CHANGE_SHARE_MAX_PLAYERS,
	selectPriceChangeSharePlayers,
	type PriceChangeShareLabels
} from '@/app/data/price-changes/_lib/price-change-share'
import { cn } from '@/lib/utils'
import type { RefObject } from 'react'

function formatPrice(value: number): string {
	return `£${(value / 10).toFixed(1)}m`
}

function formatPercent(value: number): string {
	if (Math.abs(value) < 0.05) return '0.0%'
	return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function statusClass(status: PriceChangePlayer['status']): string {
	return status === 'VERY_LIKELY_FALL'
		? 'border-destructive/50 bg-destructive/10 text-destructive'
		: 'border-destructive/35 bg-destructive/5 text-destructive'
}

export function PriceChangeShareCard({
	players,
	labels,
	updatedAtLabel,
	deadlineLabel,
	shareRef
}: {
	players: readonly PriceChangePlayer[]
	labels: Pick<
		PriceChangeShareLabels,
		'title' | 'scope' | 'updated' | 'deadline' | 'progress' | 'signal' | 'none' | 'status'
	>
	updatedAtLabel: string | null
	deadlineLabel: string | null
	shareRef: RefObject<HTMLDivElement | null>
}) {
	const sharePlayers = selectPriceChangeSharePlayers(players)
	const displayedPlayers = sharePlayers.slice(0, PRICE_CHANGE_SHARE_MAX_PLAYERS)

	return (
		<div
			ref={shareRef}
			aria-hidden="true"
			data-share-capture="price-predictions"
			data-share-preserve-width="true"
			className="pointer-events-none fixed left-[-100000px] top-0 w-[760px] bg-[#faf9f5] p-8 text-[#38003c]"
		>
			<div className="rounded-2xl border border-border/80 bg-white p-7 shadow-sm">
				<header className="flex items-start justify-between gap-6 border-b border-border/70 pb-5">
					<div className="min-w-0">
						<p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-primary-ink">
							{labels.title}
						</p>
						<h1 className="mt-1 whitespace-nowrap font-display text-3xl font-bold tracking-tight text-foreground">
							{labels.scope}
						</h1>
					</div>
					<div className="shrink-0 space-y-1 text-right text-xs tabular-nums text-muted-foreground">
						<p className="whitespace-nowrap">
							{labels.updated} {updatedAtLabel ?? '—'}
						</p>
						{deadlineLabel ? (
							<p className="whitespace-nowrap">
								{labels.deadline} {deadlineLabel}
							</p>
						) : null}
					</div>
				</header>

				<div className="mt-5">
					<div className="flex items-center justify-between gap-4">
						<p className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
							{labels.signal}
						</p>
						<p className="whitespace-nowrap text-xs text-muted-foreground">
							{labels.progress}
						</p>
					</div>

					{displayedPlayers.length === 0 ? (
						<p className="mt-4 rounded-xl border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
							{labels.none}
						</p>
					) : (
						<ul className="mt-2 divide-y divide-border/60">
							{displayedPlayers.map(player => (
								<li
									key={player.playerId}
									className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-3"
								>
									<MarketPositionBadge position={player.position} />
									<div className="min-w-0">
										<p className="whitespace-nowrap font-display text-base font-semibold text-primary-ink">
											{player.webName}
										</p>
										<p className="whitespace-nowrap text-xs text-muted-foreground">
											{player.teamName} · {formatPrice(player.currentPrice)}
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-3">
										<span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-destructive">
											{formatPercent(player.progressPercent)}
										</span>
										<span
											className={cn(
												'whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold',
												statusClass(player.status)
											)}
										>
											{labels.status[player.status]}
										</span>
									</div>
								</li>
							))}
						</ul>
					)}

					{sharePlayers.length > displayedPlayers.length ? (
						<p className="mt-3 text-right text-xs text-muted-foreground">
							… +{sharePlayers.length - displayedPlayers.length}
						</p>
					) : null}
				</div>
			</div>
		</div>
	)
}
