import { MarketPlayerLookupLauncher } from '@/app/data/market/MarketPriceExplorer'
import { MarketDashboard } from '@/app/data/market/MarketDashboard'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import {
	GET_MARKET_PULSE_SUMMARY,
	GET_MARKET_OWNERSHIP_OVERVIEW,
	GET_MARKET_OWNERSHIP_DAY,
	type MarketPulse,
	type MarketPulseSummaryResponse,
	type MarketOwnershipDayResponse,
	type MarketOwnershipOverviewResponse,
	type MarketOwnershipPeriod
} from '@/lib/graphql/operations/market'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { getTranslations } from 'next-intl/server'
import { unstable_rethrow } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'

type PageProps = {
	params: LocaleParams
	searchParams: Promise<{ period?: string; date?: string }>
}

function requestedPeriod(value: string | undefined): MarketOwnershipPeriod {
	if (value === 'GAMEWEEK' || value === 'ROLLING_7D') return value
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

function recentCalendarDates(latestDate: string | null): string[] {
	if (!latestDate) return []
	const parsed = new Date(latestDate + 'T00:00:00.000Z')
	return Array.from({ length: 7 }, (_, index) => {
		const date = new Date(parsed)
		date.setUTCDate(parsed.getUTCDate() - (6 - index))
		return date.toISOString().slice(0, 10)
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
	const dataPromise = executePublicServerQuery<MarketPulseSummaryResponse>(
		GET_MARKET_PULSE_SUMMARY,
		{ days: 7 },
		{ cache: 'no-store', timeoutMs: 2_000 }
	)
	const ownershipPromise = date
		? executePublicServerQuery<MarketOwnershipDayResponse>(
				GET_MARKET_OWNERSHIP_DAY,
				{ date, limit: 10 },
				{ cache: 'no-store', timeoutMs: 2_000 }
			)
		: executePublicServerQuery<MarketOwnershipOverviewResponse>(
				GET_MARKET_OWNERSHIP_OVERVIEW,
				{ period, limit: 10 },
				{ cache: 'no-store', timeoutMs: 2_000 }
			)
	const t = await translationPromise
	let pulse: MarketPulse | null = null
	let revision: string | null = null
	let ownership:
		| MarketOwnershipOverviewResponse['marketOwnershipOverview']
		| MarketOwnershipDayResponse['marketOwnershipDay']
		| null = null
	let latestDate: string | null = null

	try {
		const [response, ownershipResponse] = await Promise.all([
			dataPromise,
			ownershipPromise
		])
		pulse = { ...response.marketPulse, availabilityUpdates: [] }
		revision = response.marketSnapshotContext.revision
		ownership = date
			? (ownershipResponse as MarketOwnershipDayResponse).marketOwnershipDay
			: (ownershipResponse as MarketOwnershipOverviewResponse)
					.marketOwnershipOverview
		latestDate =
			response.marketPulse.coverage.latestDate ?? ownership.coverage.latestDate ?? null
	} catch (error) {
		unstable_rethrow(error)
		console.error('[market] RSC fetch failed:', error)
	}

	if (!pulse || !ownership) {
		return (
			<>
				<RouteReadyMarker
					name="MARKET_CONTENT_READY"
					audienceHint="public"
					goodMs={1_000}
					poorMs={1_500}
				/>
				<Alert
					variant="destructive"
					className="mb-6"
					role="alert"
				>
					<AlertTitle>{t('dataUnavailable')}</AlertTitle>
					<AlertDescription>{t('dataUnavailableDescription')}</AlertDescription>
				</Alert>
				<section className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5">
					<MarketPlayerLookupLauncher initialOpen />
				</section>
			</>
		)
	}

	return (
		<>
			<RouteReadyMarker
				name="MARKET_CONTENT_READY"
				audienceHint="public"
				goodMs={1_000}
				poorMs={1_500}
			/>
			<MarketDashboard
				pulse={pulse}
				ownership={ownership}
				dailyDates={recentCalendarDates(latestDate)}
				revision={revision}
				locale={locale}
			/>
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

export default async function MarketPage({ params, searchParams }: PageProps) {
	const { locale } = await getPageLocale(params)
	const query = await searchParams
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
