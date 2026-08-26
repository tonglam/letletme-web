'use client'

import {
	DataTable,
	DataTd,
	DataTh,
	DataThead,
	DataTr,
} from '@/components/data/DataTable'
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
	onPlayerClick
}: {
	players: PlayerListItem[]
	emptyText?: string
	showRank?: boolean
	playerHref?: (player: PlayerListItem) => string | null
	onPlayerClick?: (player: PlayerListItem) => void
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
		<DataTable minWidthClass="min-w-[20rem]">
			<DataThead>
				{showRank ? (
					<DataTh
						align="center"
						className="w-8"
					>
						#
					</DataTh>
				) : null}
				<DataTh className="w-10 px-1">{t('colPosition')}</DataTh>
				<DataTh className="px-2">{t('colPlayer')}</DataTh>
				<DataTh
					align="center"
					className="w-12 px-1"
				>
					{t('colClub')}
				</DataTh>
				{rich ? (
					<>
						<DataTh
							align="center"
							className="w-10 px-1"
							title={t('colMinutes')}
						>
							{t('colMinutesShort')}
						</DataTh>
						<DataTh
							align="center"
							className="w-12 px-1"
						>
							£m
						</DataTh>
						<DataTh
							align="center"
							className="w-8 px-1"
						>
							{t('colGoalsShort')}
						</DataTh>
						<DataTh
							align="center"
							className="w-8 px-1"
						>
							{t('colAssistsShort')}
						</DataTh>
						<DataTh
							align="center"
							className="w-8 px-1"
						>
							{t('colCleanSheetsShort')}
						</DataTh>
						<DataTh
							align="center"
							className="w-8 px-1"
						>
							{t('colBonusShort')}
						</DataTh>
					</>
				) : null}
				<DataTh
					align="right"
					className="w-12"
				>
					{t('colPointsShort')}
				</DataTh>
			</DataThead>
			<tbody>
				{players.map((player, index) => {
					const position = normalizePosition(player.position)
					const stats = player.stats

					return (
						<DataTr key={player.id}>
							{showRank ? (
								<DataTd
									align="center"
									className={cn(
										'font-mono text-xs tabular-nums text-muted-foreground',
										index < 3 && 'font-semibold text-primary-ink',
									)}
								>
									{index + 1}
								</DataTd>
							) : null}
							<DataTd className="px-1">
								<Badge
									variant="secondary"
									className={cn(
										'px-1.5 py-0 text-label font-semibold leading-5',
										positionBadgeClass(position),
									)}
								>
									{position}
								</Badge>
							</DataTd>
							<DataTd className="max-w-[9rem] px-2 sm:max-w-[12rem]">
								{onPlayerClick ? (
									<button
										type="button"
										className="block w-full truncate bg-transparent p-0 text-left text-sm font-semibold tracking-tight text-primary-ink underline decoration-primary/35 underline-offset-2 transition-colors hover:decoration-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
										onClick={() => onPlayerClick(player)}
									>
										{player.name}
									</button>
								) : playerHref?.(player) ? (
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
							</DataTd>
							<DataTd
								align="center"
								className="px-1 font-mono text-caption uppercase tabular-nums text-muted-foreground"
							>
								{player.team?.slice(0, 3) ?? '·'}
							</DataTd>
							{rich ? (
								<>
									<DataTd
										align="center"
										className="px-1 font-mono text-xs tabular-nums text-muted-foreground"
									>
										{cellNum(player.minutes)}
									</DataTd>
									<DataTd
										align="center"
										className="px-1 font-mono text-xs tabular-nums text-muted-foreground"
									>
										{formatPrice(player.price)}
									</DataTd>
									<DataTd
										align="center"
										className={cn(
											'px-1 font-mono text-xs tabular-nums',
											(stats?.goals ?? 0) > 0
												? 'font-semibold text-foreground'
												: 'text-muted-foreground/70',
										)}
									>
										{cellNum(stats?.goals)}
									</DataTd>
									<DataTd
										align="center"
										className={cn(
											'px-1 font-mono text-xs tabular-nums',
											(stats?.assists ?? 0) > 0
												? 'font-semibold text-foreground'
												: 'text-muted-foreground/70',
										)}
									>
										{cellNum(stats?.assists)}
									</DataTd>
									<DataTd
										align="center"
										className={cn(
											'px-1 font-mono text-xs tabular-nums',
											(stats?.cleanSheets ?? 0) > 0
												? 'font-semibold text-foreground'
												: 'text-muted-foreground/70',
										)}
									>
										{cellNum(stats?.cleanSheets)}
									</DataTd>
									<DataTd
										align="center"
										className={cn(
											'px-1 font-mono text-xs tabular-nums',
											(stats?.bonusPoints ?? 0) > 0
												? 'font-semibold text-primary-ink'
												: 'text-muted-foreground/70',
										)}
									>
										{cellNum(stats?.bonusPoints)}
									</DataTd>
								</>
							) : null}
							<DataTd
								align="right"
								className="font-display text-base font-bold tabular-nums tracking-tight text-primary-ink"
							>
								{typeof player.points === 'number' ? player.points : '·'}
							</DataTd>
						</DataTr>
					)
				})}
			</tbody>
		</DataTable>
	)
}
