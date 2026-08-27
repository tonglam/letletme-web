'use client'

import { Badge } from '@/components/ui/badge'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { Link } from '@/i18n/navigation'
import type {
	MarketAvailabilityUpdate,
	MarketPlayer
} from '@/lib/graphql/operations/market'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import {
	availabilityBodyText,
	marketAvailabilityStatusKey
} from '@/lib/market-availability'
import { shortMarketPosition } from '@/lib/market'
import { positionBadgeClass } from '@/lib/position-style'
import { cn } from '@/lib/utils'
import type { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

type MarketAvailabilityTranslator = ReturnType<typeof useTranslations<'Market'>>

function formatCalendarDate(value: string | null, locale: string): string {
	if (!value) return '—'
	const parsed = parseCalendarDate(value)
	if (!parsed) return value
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: CALENDAR_DATE_TIME_ZONE
	}).format(parsed)
}

function formatOwnership(value: number, locale: string): string {
	return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`
}

function PositionBadge({ player }: { player: MarketPlayer }) {
	const position = shortMarketPosition(player.position)
	return (
		<Badge className={cn(positionBadgeClass(position), 'shrink-0 text-[10px]')}>
			{position}
		</Badge>
	)
}

function EmptyHint({ children }: { children: ReactNode }) {
	return (
		<p
			className="rounded-md border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground"
			role="status"
		>
			{children}
		</p>
	)
}

export function MarketAvailabilityClientList({
	updates,
	locale,
	t
}: {
	updates: MarketAvailabilityUpdate[]
	locale: string
	t: MarketAvailabilityTranslator
}) {
	if (updates.length === 0) {
		return <EmptyHint>{t('noAvailabilityUpdates')}</EmptyHint>
	}
	return (
		<ul className="space-y-0 divide-y divide-border/50">
			{updates.map(update => {
				const key = marketAvailabilityStatusKey(update.status)
				const chance =
					update.chanceOfPlayingThisRound ?? update.chanceOfPlayingNextRound
				return (
					<li
						key={`${update.player.playerId}:${update.observedDate}`}
						className="py-2.5 first:pt-0 last:pb-0"
					>
						<div className="flex items-start gap-2.5">
							<PositionBadge player={update.player} />
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<Link
										prefetch={false}
										href={playerStatsHref({
											p1: String(update.player.playerId)
										})}
										className="text-sm font-medium text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
									>
										{update.player.webName}
									</Link>
									<Badge
										variant={key === 'available' ? 'secondary' : 'outline'}
										className="text-[10px]"
									>
										{t(`status.${key}`)}
									</Badge>
								</div>
								<p className="mt-0.5 text-[11px] text-muted-foreground">
									{update.player.teamShortName} ·{' '}
									{formatOwnership(update.player.selectedByPercent, locale)}{' '}
									{t('owned')}
								</p>
								<p className="mt-1.5 text-sm leading-snug text-foreground">
									{availabilityBodyText(update, messageKey => t(messageKey))}
								</p>
								<p className="mt-1 text-[11px] text-muted-foreground">
									{t('observedOn', {
										date: formatCalendarDate(update.observedDate, locale)
									})}
									{chance !== null
										? ` · ${t('playingChance', { chance })}`
										: ''}
								</p>
							</div>
						</div>
					</li>
				)
			})}
		</ul>
	)
}
