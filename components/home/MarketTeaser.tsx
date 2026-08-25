import { HomeMarketCarousel } from '@/components/home/HomeMarketCarousel'
import type {
	HomeMarketAvailabilityItem,
	HomeMarketCarouselProps,
	HomeMarketOwnershipMover
} from '@/components/home/HomeMarketCarousel'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
	type MarketOwnershipDay,
	type MarketOwnershipCoverageStatus
} from '@/lib/graphql/operations/market'
import {
	loadHomeMarketOwnership,
	loadHomeMarketPulse
} from '@/lib/home-market-seed-server'
import {
	availabilityBodyText,
	marketAvailabilityStatusKey,
	selectHomeAvailabilityUpdates
} from '@/lib/market-availability'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import { getLocale, getTranslations } from 'next-intl/server'
import { unstable_rethrow } from 'next/navigation'

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
/** Prefer publicly significant ownership; fill below this if the list is short. */
const HOME_AVAILABILITY_MIN_OWNED = 1

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
	const [t, locale] = await Promise.all([
		getTranslations('Market'),
		getLocale()
	])
	const [pulseResult, ownershipResult] = await Promise.allSettled([
		loadHomeMarketPulse(),
		loadHomeMarketOwnership()
	])

	if (pulseResult.status === 'rejected') {
		unstable_rethrow(pulseResult.reason)
		console.error('[market-teaser] pulse fetch failed:', pulseResult.reason)
		return null
	}

	const pulse = pulseResult.value.homeMarketPulse
	const ownership: MarketOwnershipDay | null =
		ownershipResult.status === 'fulfilled'
			? ownershipResult.value.marketOwnershipDay
			: null
	if (ownershipResult.status === 'rejected') {
		unstable_rethrow(ownershipResult.reason)
		console.error(
			'[market-teaser] ownership fetch failed:',
			ownershipResult.reason
		)
	}

	const ownershipReady = ownership?.coverage.status === 'READY'
	const ownershipCanRender =
		ownership !== null &&
		(ownershipReady || ownership.coverage.status === 'PARTIAL')
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
	const availability = selectHomeAvailabilityUpdates(
		pulse.availabilityUpdates,
		HOME_AVAILABILITY_LIMIT,
		HOME_AVAILABILITY_MIN_OWNED
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
		: t('ownershipDataUnavailable')
	const ownershipState: HomeMarketCarouselProps['ownership'] =
		ownership === null
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
		<HomeMarketCarousel
			ownership={ownershipState}
			availability={availabilityItems}
			locale={locale}
			labels={{
				ownershipPage: t('ownershipTitle'),
				ownershipDescription: coverageCopy,
				availabilityPage: t('availabilityWatch'),
				availabilityDescription: t('homeAvailabilityDescription'),
				openMarket: t('openMarket'),
				previousPage: t('homeMarketPrevious'),
				nextPage: t('homeMarketNext'),
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
	)
}
