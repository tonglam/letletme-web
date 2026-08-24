import { HomePriceChangeCarousel } from '@/components/home/HomePriceChangeCarousel'
import type { HomePriceChangeCarouselProps } from '@/components/home/HomePriceChangeCarousel'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { MarketPriceChange } from '@/lib/graphql/operations/market'
import type { PriceChangeBoard } from '@/lib/graphql/operations/price-changes'
import {
	isLikelyToChange,
	sortPriceChangePlayers
} from '@/lib/price-change-sorting'
import { loadHomeMarketPulse } from '@/lib/home-market-seed-server'
import { loadPriceChangeBoard } from '@/lib/price-change-server'
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

function selectLatestPriceChanges(priceChanges: MarketPriceChange[]): {
	date: string | null
	changes: MarketPriceChange[]
} {
	const date =
		Array.from(new Set(priceChanges.map(change => change.changeDate)))
			.sort()
			.at(-1) ?? null
	const changes = (date
		? priceChanges.filter(change => change.changeDate === date)
		: priceChanges
	).filter(change => change.change !== 0)

	return { date, changes }
}

function buildPredictionState(
	board: PriceChangeBoard,
	locale: string,
	notices: { partial: string; stale: string }
): HomePriceChangeCarouselProps['likely'] {
	const players = sortPriceChangePlayers(
		board.players.filter(isLikelyToChange),
		{ locale }
	)
	const notice =
		board.status === 'PARTIAL'
			? notices.partial
			: board.status === 'STALE'
				? notices.stale
				: null

	return {
		state:
			board.status === 'UNAVAILABLE'
				? 'UNAVAILABLE'
				: players.length > 0
					? 'AVAILABLE'
					: 'EMPTY',
		players,
		notice
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
	const [pulseResult, predictionResult] = await Promise.allSettled([
		loadHomeMarketPulse(),
		loadPriceChangeBoard()
	])

	let actual: HomePriceChangeCarouselProps['actual']
	let actualDate: string | null = null
	if (pulseResult.status === 'rejected') {
		unstable_rethrow(pulseResult.reason)
		console.error(
			'[home-price-change-desk] pulse fetch failed:',
			pulseResult.reason
		)
		actual = {
			state: 'UNAVAILABLE',
			coverageLabel: null,
			rises: [],
			falls: []
		}
	} else {
		const pulse = pulseResult.value.homeMarketPulse
		const latest = selectLatestPriceChanges(pulse.priceChanges)
		actualDate = latest.date ?? pulse.coverage.latestDate ?? null
		actual = {
			state: latest.changes.length > 0 ? 'AVAILABLE' : 'EMPTY',
			coverageLabel: actualDate
				? tHome('homePriceChangesTodayDescription', {
					date: formatCalendarDate(actualDate, locale)
				})
				: null,
			rises: latest.changes
				.filter(change => change.direction === 'RISE')
				.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
				.slice(0, 5),
			falls: latest.changes
				.filter(change => change.direction === 'FALL')
				.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
				.slice(0, 5)
		}
	}

	let likely: HomePriceChangeCarouselProps['likely']
	if (predictionResult.status === 'rejected') {
		unstable_rethrow(predictionResult.reason)
		console.error(
			'[home-price-change-desk] prediction fetch failed:',
			predictionResult.reason
		)
		likely = {
			state: 'UNAVAILABLE',
			players: [],
			notice: null
		}
	} else {
		likely = buildPredictionState(
			predictionResult.value.priceChangeBoard,
			locale,
			{
				partial: tHome('homeLikelyPartial'),
				stale: tHome('homeLikelyStale')
			}
		)
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
		likelyPage: tHome('homePriceChangesLikely'),
		likelyDescription: tHome('homePriceChangesLikelyDescription'),
		openRecorded: tMarket('openMarket'),
		openPredictions: tHome('openPredictions'),
		previousPage: tHome('homePriceChangesPrevious'),
		nextPage: tHome('homePriceChangesNext'),
		pagerLabel: tHome('homePriceChangesPagerLabel'),
		priceRises: tMarket('priceRises'),
		priceFalls: tMarket('priceFalls'),
		noPriceChanges: tHome('homeNoPriceChanges'),
		noPriceRises: tHome('homeNoPriceRises'),
		noPriceFalls: tHome('homeNoPriceFalls'),
		noLikelyToChange: tHome('homeNoLikelyToChange'),
		likelyUnavailable: tHome('homeLikelyUnavailable'),
		likelyUnavailableDescription: tHome(
			'homeLikelyUnavailableDescription'
		),
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
		<HomePriceChangeCarousel
			actual={actual}
			likely={likely}
			locale={locale}
			labels={labels}
		/>
	)
}
