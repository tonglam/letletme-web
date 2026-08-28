import { HomePriceChangeCarousel } from '@/components/home/HomePriceChangeCarousel'
import type { HomePriceChangeCarouselProps } from '@/components/home/HomePriceChangeCarousel'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { HomeMarketDesk } from '@/lib/graphql/operations/home'
import type { MarketPriceChange } from '@/lib/graphql/operations/market'
import { loadHomeMarketDesk } from '@/lib/home-market-seed-server'
import { buildHomePriceChangePredictionState } from '@/lib/home-price-change'
import { mapLatestPriceChangeEvent } from '@/lib/price-change-observed'
import { loadPriceChangeBoard } from '@/lib/price-change-server'
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

function mapActualPriceChanges(desk: HomeMarketDesk): {
	date: string | null
	changes: MarketPriceChange[]
} {
	// An EMPTY section has no player row to carry changeDate. Keep the
	// publication's captured date so the no-change state still tells the user
	// when the data was last refreshed.
	const date =
		desk.priceChanges[0]?.changeDate ?? desk.capturedAt?.slice(0, 10) ?? null
	return {
		date,
		changes: desk.priceChanges.filter(change => change.change !== 0)
	}
}

export function HomePriceChangeDeskFallback() {
	return (
		<Card
			className="flex h-full flex-col rounded-none p-4 sm:rounded-lg sm:p-6 lg:p-8"
			aria-hidden="true"
		>
			<Skeleton className="h-4 w-24" />
			<Skeleton className="mt-3 h-7 w-40" />
			<div className="mt-5 flex gap-2">
				<Skeleton className="h-9 flex-1 rounded-md" />
				<Skeleton className="h-9 flex-1 rounded-md" />
				<Skeleton className="size-9 rounded-md" />
			</div>
			<div className="mt-5 space-y-3">
				{[1, 2, 3, 4].map(item => (
					<Skeleton
						key={item}
						className="h-16 w-full rounded-lg"
					/>
				))}
			</div>
		</Card>
	)
}

export async function HomePriceChangeDesk() {
	const [tHome, tMarket, tPriceChanges, locale] = await Promise.all([
		getTranslations('Home'),
		getTranslations('Market'),
		getTranslations('PriceChanges'),
		getLocale()
	])
	const [deskResult, predictionResult] = await Promise.allSettled([
		loadHomeMarketDesk(),
		loadPriceChangeBoard()
	])

	let actual: HomePriceChangeCarouselProps['actual']
	let actualDate: string | null = null
	const priceChangeBoard =
		predictionResult.status === 'fulfilled'
			? predictionResult.value.priceChangeBoard
			: null
	const observed = priceChangeBoard
		? mapLatestPriceChangeEvent(priceChangeBoard)
		: null
	if (observed) {
		actualDate = observed.changeDate
		actual = {
			state: observed.state,
			coverageLabel: actualDate
				? tHome('homePriceChangesTodayDescription', {
						date: formatCalendarDate(actualDate, locale)
					})
				: null,
			capturedAt: observed.observedAt,
			rises: observed.rises.slice(0, 5),
			falls: observed.falls.slice(0, 5),
			riseCount: observed.riseCount,
			fallCount: observed.fallCount,
			eventRevision: observed.eventRevision
		}
	} else if (deskResult.status === 'rejected') {
		actual = {
			state: 'UNAVAILABLE',
			coverageLabel: null,
			capturedAt: null,
			rises: [],
			falls: [],
			riseCount: 0,
			fallCount: 0,
			eventRevision: null
		}
	} else {
		const desk = deskResult.value.homeMarketDesk
		const latest = mapActualPriceChanges(desk)
		actualDate = latest.date
		const rises = latest.changes
			.filter(change => change.direction === 'RISE')
			.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
		const falls = latest.changes
			.filter(change => change.direction === 'FALL')
			.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
		actual = {
			state:
				desk.priceChangesState === 'UNAVAILABLE'
					? 'UNAVAILABLE'
					: desk.priceChangesState === 'EMPTY' || latest.changes.length === 0
						? 'EMPTY'
						: 'AVAILABLE',
			coverageLabel: actualDate
				? tHome('homePriceChangesTodayDescription', {
						date: formatCalendarDate(actualDate, locale)
					})
				: null,
			capturedAt: desk.capturedAt,
			rises: rises.slice(0, 5),
			falls: falls.slice(0, 5),
			riseCount: rises.length,
			fallCount: falls.length,
			eventRevision: null
		}
	}

	let likely: HomePriceChangeCarouselProps['likely']
	let liveSeed: HomePriceChangeCarouselProps['liveSeed'] = {
		revision: 'unavailable',
		deadline: null,
		nextDeadlines: []
	}
	if (predictionResult.status === 'rejected') {
		likely = {
			state: 'UNAVAILABLE',
			capturedAt: null,
			rises: [],
			falls: []
		}
	} else {
		const board = priceChangeBoard ?? predictionResult.value.priceChangeBoard
		likely = buildHomePriceChangePredictionState(board, locale)
		liveSeed = {
			revision: board.revision,
			deadline: board.deadline,
			nextDeadlines: board.nextDeadlines
		}
	}

	const actualDescription = actualDate
		? tHome('homePriceChangesTodayDescription', {
				date: formatCalendarDate(actualDate, locale)
			})
		: tHome('homePriceChangesTodayUnavailable')

	const labels: HomePriceChangeCarouselProps['labels'] = {
		title: tHome('homePriceChangesTitle'),
		todayPage: tHome('homePriceChangesToday'),
		todayDescription: actualDescription,
		todayUpdatedPrefix: tHome('homePriceChangesTodayDescription', {
			date: ''
		}).trim(),
		likelyPage: tHome('homePriceChangesLikely'),
		likelyDescription: tHome('homePriceChangesLikelyDescription'),
		openRecorded: tMarket('openMarket'),
		openPredictions: tHome('openPredictions'),
		previousPage: tHome('homePriceChangesPrevious'),
		nextPage: tHome('homePriceChangesNext'),
		pause: tHome('homeCarouselPause'),
		resume: tHome('homeCarouselResume'),
		pagerLabel: tHome('homePriceChangesPagerLabel'),
		priceRises: tMarket('priceRises'),
		priceFalls: tMarket('priceFalls'),
		trendRises: tHome('homePriceTrendRises'),
		trendFalls: tHome('homePriceTrendFalls'),
		noPriceChanges: tHome('homeNoPriceChanges'),
		noPriceRises: tHome('homeNoPriceRises'),
		noPriceFalls: tHome('homeNoPriceFalls'),
		noTrendRises: tHome('homeNoTrendRises'),
		noTrendFalls: tHome('homeNoTrendFalls'),
		noLikelyToChange: tHome('homeNoLikelyToChange'),
		likelyUnavailable: tHome('homeLikelyUnavailable'),
		likelyUnavailableDescription: tHome('homeLikelyUnavailableDescription'),
		dataUnavailable: tMarket('dataUnavailable'),
		dataUnavailableDescription: tMarket('dataUnavailableDescription'),
		status: {
			VERY_LIKELY_RISE: tPriceChanges('statusVeryLikelyRise'),
			LIKELY_RISE: tPriceChanges('statusLikelyRise'),
			UNLIKELY: tPriceChanges('statusUnlikely'),
			LIKELY_FALL: tPriceChanges('statusLikelyFall'),
			VERY_LIKELY_FALL: tPriceChanges('statusVeryLikelyFall'),
			LOCKED: tPriceChanges('statusLocked'),
			CALIBRATING: tPriceChanges('statusCalibrating')
		}
	}

	return (
		<>
			<HomePriceChangeCarousel
				actual={actual}
				likely={likely}
				liveSeed={liveSeed}
				observedEvent={priceChangeBoard?.latestEvent ?? null}
				locale={locale}
				labels={labels}
			/>
			<RouteReadyMarker
				name="HOME_PRICE_CHANGES_READY"
				ready={actual.state !== 'UNAVAILABLE' || likely.state !== 'UNAVAILABLE'}
				readyKey={`${actual.state}:${actualDate ?? 'none'}:${likely.state}`}
				audienceHint="public"
				goodMs={2_000}
				poorMs={3_000}
			/>
		</>
	)
}
