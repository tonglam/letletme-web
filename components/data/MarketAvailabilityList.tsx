import {
	MarketPositionBadge,
	MarketStatusBadge
} from '@/components/data/MarketMarkup'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import type {
	MarketAvailabilityUpdate,
	MarketPlayer
} from '@/lib/graphql/operations/market'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import {
	availabilityBodyText,
	marketAvailabilityStatusKey
} from '@/lib/market-availability'
import type { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

export type MarketAvailabilityTranslator = ReturnType<
	typeof useTranslations<'Market'>
>

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
	return <MarketPositionBadge position={player.position} />
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

export function MarketAvailabilityList({
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
						key={update.player.playerId}
						className="market-availability-row"
					>
						<div className="market-availability-content">
							<PositionBadge player={update.player} />
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<a
										href={playerStatsHref({
											p1: String(update.player.playerId),
											localePathPrefix: locale === 'en' ? '' : `/${locale}`
										})}
										className="market-availability-link"
									>
										{update.player.webName}
									</a>
									<MarketStatusBadge available={key === 'available'}>
										{t(`status.${key}`)}
									</MarketStatusBadge>
								</div>
								<p className="market-availability-meta">
									{update.player.teamShortName} ·{' '}
									{formatOwnership(update.player.selectedByPercent, locale)}{' '}
									{t('owned')}
								</p>
								<p className="market-availability-body">
									{availabilityBodyText(update, messageKey => t(messageKey))}
								</p>
								<p className="market-availability-date">
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
