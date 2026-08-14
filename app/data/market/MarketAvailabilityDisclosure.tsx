'use client'

import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { Badge } from '@/components/ui/badge'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { Link } from '@/i18n/navigation'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import type { MarketAvailabilityUpdate, MarketPlayer } from '@/lib/graphql/operations/market'
import { fetchMarketJson, marketRevisionParam } from '@/lib/market-client'
import { markRouteReadyStart } from '@/lib/analytics/route-navigation'
import { availabilityBodyText, marketAvailabilityStatusKey } from '@/lib/market-availability'
import { shortMarketPosition } from '@/lib/market'
import { positionBadgeClass } from '@/lib/position-style'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

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

function AvailabilityBlock({
	updates,
	locale
}: {
	updates: MarketAvailabilityUpdate[]
	locale: string
}) {
	const t = useTranslations('Market')
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
					<li key={update.player.playerId} className="py-2.5 first:pt-0 last:pb-0">
						<div className="flex items-start gap-2.5">
							<PositionBadge player={update.player} />
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<Link
										prefetch={false}
										href={playerStatsHref({ p1: String(update.player.playerId) })}
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
									{update.player.teamShortName} · {formatOwnership(update.player.selectedByPercent, locale)} {t('owned')}
								</p>
								<p className="mt-1.5 text-sm leading-snug text-foreground">
									{availabilityBodyText(update, key => t(key))}
								</p>
								<p className="mt-1 text-[11px] text-muted-foreground">
									{t('observedOn', { date: formatCalendarDate(update.observedDate, locale) })}
									{chance !== null ? ` · ${t('playingChance', { chance })}` : ''}
								</p>
							</div>
						</div>
					</li>
				)
			})}
		</ul>
	)
}

export function MarketAvailabilityDisclosure({
	highlights,
	updates,
	locale,
	days,
	revision,
	count
}: {
	highlights: MarketAvailabilityUpdate[]
	updates: MarketAvailabilityUpdate[]
	locale: string
	days: number
	revision: string | null
	count: number
}) {
	const t = useTranslations('Market')
	const [loadedUpdates, setLoadedUpdates] = useState(updates)
	const [isLoaded, setIsLoaded] = useState(updates.length > highlights.length)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(false)
	const [availabilityReadyKey, setAvailabilityReadyKey] = useState<string | null>(null)
	const lead =
		highlights.length > 0
			? highlights
			: loadedUpdates.length > 0
				? loadedUpdates
				: updates

	const loadUpdates = useCallback(async () => {
		if (loadedUpdates.length > highlights.length || loading || !revision) return
		setLoading(true)
		setError(false)
		try {
			const readyKey = `${revision}:${days}`
			markRouteReadyStart(
				window.location.pathname,
				performance.now(),
				readyKey
			)
			const data = await fetchMarketJson<{ items?: MarketAvailabilityUpdate[] }>('availability', {
				days: String(days),
				revision: marketRevisionParam(revision)
			})
			setLoadedUpdates(data.items ?? [])
			setIsLoaded(true)
			setAvailabilityReadyKey(readyKey)
		} catch {
			setError(true)
			setAvailabilityReadyKey(null)
		} finally {
			setLoading(false)
		}
	}, [days, highlights.length, loadedUpdates.length, loading, revision])

	useEffect(() => {
		setLoadedUpdates(updates)
		setIsLoaded(updates.length > highlights.length)
	}, [highlights.length, updates])

	return (
		<>
			<RouteReadyMarker
				name="MARKET_AVAILABILITY_READY"
				ready={availabilityReadyKey !== null}
				readyKey={availabilityReadyKey ?? ''}
				audienceHint="public"
				goodMs={500}
				poorMs={1000}
			/>
			<div>
				<AvailabilityBlock updates={lead} locale={locale} />
				{count > highlights.length ? (
					<details
						data-testid="market-availability-disclosure"
						className="mt-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5"
						onToggle={event => {
							if (event.currentTarget.open) void loadUpdates()
						}}
					>
						<summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
							{t('availabilityEvidence', { count })}
						</summary>
						<div className="mt-3 border-t border-border/50 pt-3">
							{loading ? <p className="text-xs text-muted-foreground">{t('searchingPlayers')}</p> : null}
							{error ? <p className="text-xs text-destructive">{t('dataUnavailable')}</p> : null}
							{isLoaded && !loading && !error ? (
								<AvailabilityBlock updates={loadedUpdates} locale={locale} />
							) : null}
						</div>
					</details>
				) : null}
			</div>
		</>
	)
}
