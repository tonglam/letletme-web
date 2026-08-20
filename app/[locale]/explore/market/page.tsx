import { MarketPlayerLookupLauncher } from '@/app/data/market/MarketPriceExplorer'
import { MarketDashboard } from '@/app/data/market/MarketDashboard'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizePathname } from '@/i18n/routing'
import { withCapacityRunForRequest } from '@/lib/capacity-run'
import {
	type MarketPulse,
	type MarketPulseSummaryResponse,
	type MarketOwnershipDayResponse,
	type MarketOwnershipOverviewResponse,
	type MarketOwnershipPeriod
} from '@/lib/graphql/operations/market'
import {
	loadMarketOwnershipDay,
	loadMarketOwnershipOverview,
	loadMarketPulseSummary
} from '@/lib/market-overview-server'
import { getTranslations } from 'next-intl/server'
import { redirect, unstable_rethrow } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'

type PageProps = {
	params: LocaleParams
	searchParams: Promise<{ period?: string; date?: string }>
}

function requestedPeriod(value: string | undefined): MarketOwnershipPeriod {
	if (value === 'GAMEWEEK') return value
	return 'DAILY'
}

function requestedDate(
	value: string | undefined,
	period: MarketOwnershipPeriod
): string | null {
	return period === 'DAILY' && value && /^\d{4}-\d{2}-\d{2}$/.test(value)
		? value
		: null
}

function recentCalendarDates(input: {
	firstDate: string | null
	latestDate: string | null
	missingDates: string[]
}): string[] {
	if (!input.latestDate) return []
	const parsed = new Date(input.latestDate + 'T00:00:00.000Z')
	const earliestDate = input.firstDate
		? new Date(input.firstDate + 'T00:00:00.000Z')
		: null
	return Array.from({ length: 7 }, (_, index) => {
		const date = new Date(parsed)
		date.setUTCDate(parsed.getUTCDate() - (6 - index))
		return date.toISOString().slice(0, 10)
	}).filter(date => {
		if (earliestDate && date < earliestDate.toISOString().slice(0, 10)) {
			return false
		}
		return !input.missingDates.includes(date)
	})
}

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/explore/market',
		titleKey: 'priceChangesTitle',
		descriptionKey: 'priceChangesDescription'
	})
}

async function MarketContent({
	locale,
	period,
	date
}: {
	locale: string
	period: MarketOwnershipPeriod
	date: string | null
}) {
	await connection()
	const translationPromise = getTranslations('Market')
	const dataPromise = loadMarketPulseSummary(7)
	const ownershipPromise = date
		? loadMarketOwnershipDay(date)
		: loadMarketOwnershipOverview(period)
	const dailyOverviewPromise = date
		? loadMarketOwnershipOverview('DAILY')
		: null
	const t = await translationPromise
	let pulse: MarketPulse | null = null
	let revision: string | null = null
	let ownership:
		| MarketOwnershipOverviewResponse['marketOwnershipOverview']
		| MarketOwnershipDayResponse['marketOwnershipDay']
		| null = null
	let dailyOverview:
		MarketOwnershipOverviewResponse['marketOwnershipOverview'] | null = null

	const [dataResult, ownershipResult, dailyOverviewResult] =
		await Promise.allSettled([
			dataPromise,
			ownershipPromise,
			dailyOverviewPromise ?? Promise.resolve(null)
		])
	if (dataResult.status === 'fulfilled') {
		pulse = { ...dataResult.value.marketPulse, availabilityUpdates: [] }
		revision = dataResult.value.marketSnapshotContext.revision
	} else {
		unstable_rethrow(dataResult.reason)
		console.error('[market] pulse fetch failed:', dataResult.reason)
	}
	if (ownershipResult.status === 'fulfilled') {
		ownership = date
			? (ownershipResult.value as MarketOwnershipDayResponse).marketOwnershipDay
			: (ownershipResult.value as MarketOwnershipOverviewResponse)
					.marketOwnershipOverview
	} else {
		unstable_rethrow(ownershipResult.reason)
		console.error('[market] ownership fetch failed:', ownershipResult.reason)
	}
	if (dailyOverviewResult.status === 'fulfilled') {
		if (dailyOverviewResult.value) {
			dailyOverview = dailyOverviewResult.value.marketOwnershipOverview
		}
	} else {
		unstable_rethrow(dailyOverviewResult.reason)
		console.error(
			'[market] daily coverage fetch failed:',
			dailyOverviewResult.reason
		)
	}
	const dailyCoverage =
		dailyOverview?.coverage ??
		(!date && ownership?.period === 'DAILY' ? ownership.coverage : null)

	return (
		<>
			<RouteReadyMarker
				name="MARKET_CONTENT_READY"
				audienceHint="public"
				goodMs={1_000}
				poorMs={1_500}
			/>
			{!pulse ? (
				<Alert
					variant="destructive"
					className="mb-6"
					role="alert"
				>
					<AlertTitle>{t('dataUnavailable')}</AlertTitle>
					<AlertDescription>{t('dataUnavailableDescription')}</AlertDescription>
				</Alert>
			) : null}
			<MarketDashboard
				pulse={pulse}
				ownership={ownership}
				requestedPeriod={period}
				requestedDate={date}
				dailyDates={recentCalendarDates({
					firstDate: dailyCoverage?.firstDate ?? null,
					latestDate: dailyCoverage?.latestDate ?? null,
					missingDates: dailyCoverage?.missingDates ?? []
				})}
				revision={revision}
				locale={locale}
			/>
			{!pulse ? (
				<section className="mt-8 rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5">
					<MarketPlayerLookupLauncher initialOpen />
				</section>
			) : null}
		</>
	)
}

function MarketViewFallback() {
	return (
		<div className="space-y-4">
			<div className="h-4 w-56 animate-pulse rounded bg-muted/50" />
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{[1, 2, 3, 4].map(i => (
					<div
						key={i}
						className="h-16 animate-pulse rounded-lg bg-muted/40"
					/>
				))}
			</div>
			<div className="h-48 w-full animate-pulse rounded-lg bg-muted/40" />
		</div>
	)
}

async function renderMarketPage({ params, searchParams }: PageProps) {
	const { locale } = await getPageLocale(params)
	const query = await searchParams
	if (query.period === 'ROLLING_7D') {
		redirect(localizePathname('/explore/market', locale))
	}
	const period = requestedPeriod(query.period)
	const date = requestedDate(query.date, period)
	const t = await getTranslations('Market')

	return (
		<PageShell>
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<StatsPageHeader title={t('title')} />
				<p className="-mt-4 mb-6 max-w-2xl text-sm leading-6 text-muted-foreground">
					{t('pageIntro')}
				</p>

				<Suspense fallback={<MarketViewFallback />}>
					<MarketContent
						locale={locale}
						period={period}
						date={date}
					/>
				</Suspense>
			</div>
		</PageShell>
	)
}

export default async function MarketPage(props: PageProps) {
	return withCapacityRunForRequest(() => renderMarketPage(props))
}
