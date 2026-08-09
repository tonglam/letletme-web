'use client'

import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/navigation'
import { positionBadgeClass } from '@/lib/position-style'
import { cn, normalizePosition } from '@/lib/utils'
import { useTranslations } from 'next-intl'

export interface PlayerListItemStats {
	goals?: number | null
	assists?: number | null
	cleanSheets?: number | null
	bonusPoints?: number | null
}

export interface PlayerListItem {
	id: number
	name: string
	position: string
	team?: string | null
	points?: number | null
	price?: number | null
	minutes?: number | null
	stats?: PlayerListItemStats | null
	ownedBy?: number | null
	captainedBy?: number | null
}

function cellNum(value: number | null | undefined, empty = '·'): string {
	if (value == null) return empty
	return String(value)
}

function formatPrice(price: number | null | undefined): string {
	if (price == null || !Number.isFinite(price)) return '·'
	// FPL tenths of £m when value is typically 40–150 range
	if (price >= 20) return `£${(price / 10).toFixed(1)}`
	return `£${price.toFixed(1)}`
}

export function PlayerList({
	players,
	emptyText,
	showRank = true,
	playerHref,
}: {
	players: PlayerListItem[]
	emptyText?: string
	showRank?: boolean
	playerHref?: (player: PlayerListItem) => string | null
}) {
	const t = useTranslations('PlayerDirectory')

	if (players.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				<p className="text-sm">{emptyText ?? t('noPlayersAvailable')}</p>
			</div>
		)
	}

	// Any enrichment → full stat table; otherwise a tighter name/team/pts board
	const rich = players.some(
		p =>
			p.stats != null ||
			typeof p.minutes === 'number' ||
			typeof p.price === 'number' ||
			typeof p.ownedBy === 'number',
	)

	return (
		<div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:px-0">
			<table className="w-full min-w-[20rem] border-collapse text-sm">
				<thead>
					<tr className="border-b border-border/70 bg-muted/40 text-left dark:bg-muted/20">
						{showRank ? (
							<th
								scope="col"
								className="w-8 px-1.5 py-2 text-center font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
							>
								#
							</th>
						) : null}
						<th
							scope="col"
							className="w-10 px-1 py-2 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
						>
							{t('colPosition')}
						</th>
						<th
							scope="col"
							className="px-2 py-2 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
						>
							{t('colPlayer')}
						</th>
						<th
							scope="col"
							className="w-12 px-1 py-2 text-center font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
						>
							{t('colClub')}
						</th>
						{rich ? (
							<>
								<th
									scope="col"
									className="w-10 px-1 py-2 text-center font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
									title={t('colMinutes')}
								>
									{t('colMinutesShort')}
								</th>
								<th
									scope="col"
									className="w-12 px-1 py-2 text-center font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
								>
									£m
								</th>
								<th
									scope="col"
									className="w-8 px-1 py-2 text-center font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
								>
									{t('colGoalsShort')}
								</th>
								<th
									scope="col"
									className="w-8 px-1 py-2 text-center font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
								>
									{t('colAssistsShort')}
								</th>
								<th
									scope="col"
									className="w-8 px-1 py-2 text-center font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
								>
									{t('colCleanSheetsShort')}
								</th>
								<th
									scope="col"
									className="w-8 px-1 py-2 text-center font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
								>
									{t('colBonusShort')}
								</th>
							</>
						) : null}
						<th
							scope="col"
							className="w-12 px-1.5 py-2 text-right font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
						>
							{t('colPointsShort')}
						</th>
					</tr>
				</thead>
				<tbody>
					{players.map((player, index) => {
						const position = normalizePosition(player.position)
						const stats = player.stats

						return (
							<tr
								key={player.id}
								className="border-b border-border/40 last:border-b-0 hover:bg-muted/30"
							>
								{showRank ? (
									<td
										className={cn(
											'px-1.5 py-2 text-center font-mono text-xs tabular-nums text-muted-foreground',
											index < 3 && 'font-semibold text-primary-ink',
										)}
									>
										{index + 1}
									</td>
								) : null}
								<td className="px-1 py-2">
									<Badge
										variant="secondary"
										className={cn(
											'px-1.5 py-0 text-[10px] font-semibold leading-5',
											positionBadgeClass(position),
										)}
									>
										{position}
									</Badge>
								</td>
								<td className="max-w-[9rem] px-2 py-2 sm:max-w-[12rem]">
									{playerHref?.(player) ? (
										<Link
											href={playerHref(player)!}
											className="block truncate text-sm font-semibold tracking-tight text-primary-ink underline decoration-primary/35 underline-offset-2 transition-colors hover:decoration-primary hover:text-primary"
										>
											{player.name}
										</Link>
									) : (
										<span className="block truncate text-sm font-semibold tracking-tight">
											{player.name}
										</span>
									)}
								</td>
								<td className="px-1 py-2 text-center font-mono text-[11px] uppercase tabular-nums text-muted-foreground">
									{player.team?.slice(0, 3) ?? '·'}
								</td>
								{rich ? (
									<>
										<td className="px-1 py-2 text-center font-mono text-xs tabular-nums text-muted-foreground">
											{cellNum(player.minutes)}
										</td>
										<td className="px-1 py-2 text-center font-mono text-xs tabular-nums text-muted-foreground">
											{formatPrice(player.price)}
										</td>
										<td
											className={cn(
												'px-1 py-2 text-center font-mono text-xs tabular-nums',
												(stats?.goals ?? 0) > 0
													? 'font-semibold text-foreground'
													: 'text-muted-foreground/70',
											)}
										>
											{cellNum(stats?.goals)}
										</td>
										<td
											className={cn(
												'px-1 py-2 text-center font-mono text-xs tabular-nums',
												(stats?.assists ?? 0) > 0
													? 'font-semibold text-foreground'
													: 'text-muted-foreground/70',
											)}
										>
											{cellNum(stats?.assists)}
										</td>
										<td
											className={cn(
												'px-1 py-2 text-center font-mono text-xs tabular-nums',
												(stats?.cleanSheets ?? 0) > 0
													? 'font-semibold text-foreground'
													: 'text-muted-foreground/70',
											)}
										>
											{cellNum(stats?.cleanSheets)}
										</td>
										<td
											className={cn(
												'px-1 py-2 text-center font-mono text-xs tabular-nums',
												(stats?.bonusPoints ?? 0) > 0
													? 'font-semibold text-primary-ink'
													: 'text-muted-foreground/70',
											)}
										>
											{cellNum(stats?.bonusPoints)}
										</td>
									</>
								) : null}
								<td className="px-1.5 py-2 text-right font-display text-base font-bold tabular-nums tracking-tight text-primary-ink">
									{typeof player.points === 'number' ? player.points : '·'}
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}
