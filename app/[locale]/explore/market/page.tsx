import {
	MarketPlayerLookupLauncher,
	MarketView
} from '@/app/data/market/MarketView'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import {
	GET_MARKET_PULSE_SUMMARY,
	type MarketPulse,
	type MarketPulseSummaryResponse
} from '@/lib/graphql/operations/market'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { getTranslations } from 'next-intl/server'
import { unstable_rethrow } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/explore/market',
		titleKey: 'priceChangesTitle',
		descriptionKey: 'priceChangesDescription'
	})
}

async function MarketContent() {
	await connection()
	const translationPromise = getTranslations('Market')
	const dataPromise = executePublicServerQuery<MarketPulseSummaryResponse>(
		GET_MARKET_PULSE_SUMMARY,
		{ days: 14 },
		{ cache: 'no-store', timeoutMs: 2_000 }
	)
	const t = await translationPromise
	let pulse: MarketPulse | null = null
	let revision: string | null = null

	try {
		const response = await dataPromise
		pulse = { ...response.marketPulse, availabilityUpdates: [] }
		revision = response.marketSnapshotContext.revision
	} catch (error) {
		unstable_rethrow(error)
		console.error('[market] RSC fetch failed:', error)
	}

	if (!pulse) {
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
			<MarketView
				pulse={pulse}
				revision={revision}
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

export default async function MarketPage({ params }: PageProps) {
	await getPageLocale(params)
	const t = await getTranslations('Market')

	return (
		<PageShell>
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<StatsPageHeader title={t('title')} />
				<p className="-mt-4 mb-6 max-w-2xl text-sm leading-6 text-muted-foreground">
					{t('pageIntro')}
				</p>

				<Suspense fallback={<MarketViewFallback />}>
					<MarketContent />
				</Suspense>
			</div>
		</PageShell>
	)
}
