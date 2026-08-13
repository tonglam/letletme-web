import { MarketView } from '@/app/data/market/MarketView'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { MarketPlayerLookup } from '@/components/data/MarketPlayerLookup'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { CacheTag, publicFetchOptions, RevalidateSeconds } from '@/lib/cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_MARKET_PULSE,
	type MarketPulse,
	type MarketPulseResponse,
} from '@/lib/graphql/operations/market'
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
		descriptionKey: 'priceChangesDescription',
	})
}

async function MarketContent() {
	await connection()
	const t = await getTranslations('Market')
	let pulse: MarketPulse | null = null

	try {
		const response = await executePublicServerQuery<MarketPulseResponse>(
			GET_MARKET_PULSE,
			{ days: 14 },
			publicFetchOptions({
				revalidate: RevalidateSeconds.market,
				tags: [CacheTag.market]
			})
		)
		pulse = response.marketPulse
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
					goodMs={3_000}
					poorMs={4_500}
				/>
				<Alert variant="destructive" className="mb-6" role="alert">
					<AlertTitle>{t('dataUnavailable')}</AlertTitle>
					<AlertDescription>
						{t('dataUnavailableDescription')}
					</AlertDescription>
				</Alert>
				<section className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5">
					<MarketPlayerLookup />
				</section>
			</>
		)
	}

	return (
		<>
			<RouteReadyMarker
				name="MARKET_CONTENT_READY"
				audienceHint="public"
				goodMs={3_000}
				poorMs={4_500}
			/>
			<MarketView pulse={pulse} />
		</>
	)
}

function MarketViewFallback() {
	return (
		<div className="space-y-4">
			<div className="h-4 w-56 animate-pulse rounded bg-muted/50" />
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{[1, 2, 3, 4].map(i => (
					<div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
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
