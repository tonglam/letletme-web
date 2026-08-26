import { HomeMarketCarousel } from '@/components/home/HomeMarketCarousel'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import type {
	HomeMarketAvailabilityItem,
	HomeMarketCarouselProps,
	HomeMarketOwnershipMover
} from '@/components/home/HomeMarketCarousel'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { HomeMarketSectionState } from '@/lib/graphql/operations/home'
import {
	type MarketOwnershipDay,
	type MarketOwnershipCoverageStatus
} from '@/lib/graphql/operations/market'
import { loadHomeMarketDesk } from '@/lib/home-market-seed-server'
import {
	availabilityBodyText,
	marketAvailabilityStatusKey
} from '@/lib/market-availability'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import { getLocale, getTranslations } from 'next-intl/server'

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

/** Home teaser keeps a short list; full desks live on /explore/market. */
const HOME_TEASER_LIMIT = 5
const HOME_AVAILABILITY_LIMIT = 5

export function MarketTeaserFallback() {
	return (
		<div aria-hidden="true">
			<Card className="rounded-none p-5 sm:rounded-xl sm:p-6">
				<Skeleton className="mb-3 h-4 w-28" />
				<Skeleton className="mb-6 h-8 w-52" />
				<div className="grid gap-3 sm:grid-cols-2">
					{[1, 2, 3, 4].map(item => (
						<Skeleton
							key={item}
							className="h-16"
						/>
					))}
				</div>
			</Card>
		</div>
	)
}

export async function MarketTeaser() {
	const [t, tHome, locale] = await Promise.all([
		getTranslations('Market'),
		getTranslations('Home'),
		getLocale()
	])
	const deskResult = await Promise.allSettled([loadHomeMarketDesk()])

	if (deskResult[0].status === 'rejected') {
		return null
	}

	const desk = deskResult[0].value.homeMarketDesk
	const ownership: MarketOwnershipDay | null = desk.ownership

	const ownershipReady = desk.ownershipState === 'AVAILABLE'
	const ownershipCanRender = ownershipReady && ownership !== null
	// Keep rise / fall separate so the desk reads like a transfer board, not a mixed top-3.
	const ownershipRisers = [...(ownership?.risers ?? [])]
		.sort((a, b) => b.changePercentagePoints - a.changePercentagePoints)
		.slice(0, HOME_TEASER_LIMIT)
	const ownershipFallers = [...(ownership?.fallers ?? [])]
		.sort((a, b) => a.changePercentagePoints - b.changePercentagePoints)
		.slice(0, HOME_TEASER_LIMIT)
	const formatDelta = (value: number) =>
		t('ownershipPercentagePoints', {
			value: `${value > 0 ? '+' : ''}${value.toFixed(1)}`
		})
	const availability = desk.availabilityUpdates.slice(
		0,
		HOME_AVAILABILITY_LIMIT
	)

	const ownershipStatusCopy: Record<MarketOwnershipCoverageStatus, string> = {
		READY: t('ownershipStatus.READY'),
		PARTIAL: t('ownershipStatus.PARTIAL'),
		NO_DATA: t('ownershipStatus.NO_DATA'),
		BASELINE_MISSING: t('ownershipStatus.BASELINE_MISSING'),
		NO_PREVIOUS_GAMEWEEK: t('ownershipStatus.NO_PREVIOUS_GAMEWEEK'),
		NO_UPCOMING_GAMEWEEK: t('ownershipStatus.NO_UPCOMING_GAMEWEEK')
	}
	const coverageCopy = ownership
		? ownershipReady
			? t('homeDailyCoverage', {
					date: formatCalendarDate(
						ownership.coverage.toDate ?? ownership.date ?? null,
						locale
					)
				})
			: ownershipStatusCopy[ownership.coverage.status]
		: desk.ownershipState === 'EMPTY'
			? t('homeEmptyDescription', { time: '09:25–09:35 UTC+8' })
			: t('ownershipDataUnavailable')
	const ownershipState: HomeMarketCarouselProps['ownership'] =
		desk.ownershipState === 'UNAVAILABLE'
			? {
					state: 'UNAVAILABLE',
					risers: [],
					fallers: []
				}
			: ownershipCanRender
				? {
						state: 'AVAILABLE',
						risers: ownershipRisers.map(mover => ({
							player: mover.player,
							changePercentagePoints: mover.changePercentagePoints,
							fromToLabel: t('ownershipFromTo', {
								from: mover.fromSelectedByPercent.toFixed(1),
								to: mover.toSelectedByPercent.toFixed(1)
							}),
							deltaLabel: formatDelta(mover.changePercentagePoints),
							detailLabel: t('ownershipChangeDetail', {
								from: mover.fromSelectedByPercent.toFixed(1),
								to: mover.toSelectedByPercent.toFixed(1),
								delta: formatDelta(mover.changePercentagePoints)
							})
						})),
						fallers: ownershipFallers.map(mover => ({
							player: mover.player,
							changePercentagePoints: mover.changePercentagePoints,
							fromToLabel: t('ownershipFromTo', {
								from: mover.fromSelectedByPercent.toFixed(1),
								to: mover.toSelectedByPercent.toFixed(1)
							}),
							deltaLabel: formatDelta(mover.changePercentagePoints),
							detailLabel: t('ownershipChangeDetail', {
								from: mover.fromSelectedByPercent.toFixed(1),
								to: mover.toSelectedByPercent.toFixed(1),
								delta: formatDelta(mover.changePercentagePoints)
							})
						}))
					}
				: {
						state: 'EMPTY',
						risers: [],
						fallers: []
					}
	const availabilityItems: HomeMarketAvailabilityItem[] = availability.map(
		update => {
			const key = marketAvailabilityStatusKey(update.status)
			return {
				player: update.player,
				statusLabel: t(`status.${key}`),
				body: availabilityBodyText(update, messageKey => t(messageKey))
			}
		}
	)
	const ownershipEmptyDescription =
		ownership?.coverage.status === 'BASELINE_MISSING'
			? t('homeOwnershipBaselineMissingDescription', {
					date: ownership.date ?? ownership.coverage.toDate ?? '—'
				})
			: t('homeEmptyDescription', { time: '09:25–09:35 UTC+8' })

	return (
		<>
			<HomeMarketCarousel
				ownership={ownershipState}
				ownershipUpdatedAt={
					ownershipReady
						? ownership?.coverage.capturedAt ?? desk.capturedAt
						: null
				}
				availability={availabilityItems}
				availabilityState={desk.availabilityState as HomeMarketSectionState}
				locale={locale}
				labels={{
					ownershipPage: t('ownershipTitle'),
					ownershipDescription: coverageCopy,
					ownershipUpdatedPrefix: t('lastUpdated', { date: '' }).trim(),
					availabilityPage: t('availabilityWatch'),
					availabilityDescription: t('homeAvailabilityDescription'),
					openMarket: t('openMarket'),
					previousPage: t('homeMarketPrevious'),
					nextPage: t('homeMarketNext'),
					pause: tHome('homeCarouselPause'),
					resume: tHome('homeCarouselResume'),
					pagerLabel: t('homeMarketPagerLabel'),
					ownershipRising: t('homeOwnershipRising'),
					ownershipFalling: t('homeOwnershipFalling'),
					noOwnershipRisers: t('noOwnershipRisers'),
					noOwnershipFallers: t('noOwnershipFallers'),
					ownershipEmptyTitle: t('ownershipStatus.NO_DATA'),
					ownershipEmptyDescription,
					ownershipUnavailableTitle: t('ownershipDataUnavailable'),
					ownershipUnavailableDescription: t('ownershipDataUnavailable'),
					availabilityEmpty: t('noAvailabilityUpdates')
				}}
			/>
			<RouteReadyMarker
				name="HOME_MARKET_READY"
				ready={
					desk.ownershipState !== 'UNAVAILABLE' ||
					desk.availabilityState !== 'UNAVAILABLE'
				}
				readyKey={desk.revision}
				audienceHint="public"
				goodMs={2_000}
				poorMs={3_000}
			/>
		</>
	)
}
