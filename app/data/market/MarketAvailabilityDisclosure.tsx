'use client'

import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { MarketAvailabilityList } from '@/components/data/MarketAvailabilityList'
import type { MarketAvailabilityUpdate } from '@/lib/graphql/operations/market'
import { fetchMarketJson, marketRevisionParam } from '@/lib/market-client'
import { markRouteReadyStart } from '@/lib/analytics/route-navigation'
import { MARKET_AVAILABILITY_HIGHLIGHT_LIMIT } from '@/lib/market'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'

export function MarketAvailabilityDisclosure({
	days,
	revision,
	count
}: {
	days: number
	revision: string | null
	count: number
}) {
	const t = useTranslations('Market')
	const locale = useLocale()
	const [loadedUpdates, setLoadedUpdates] = useState<MarketAvailabilityUpdate[]>([])
	const [isLoaded, setIsLoaded] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(false)
	const [availabilityReadyKey, setAvailabilityReadyKey] = useState<string | null>(null)

	const loadUpdates = useCallback(async () => {
		if (isLoaded || loading || !revision) return
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
	}, [days, isLoaded, loading, revision])

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
				{count > MARKET_AVAILABILITY_HIGHLIGHT_LIMIT ? (
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
								<MarketAvailabilityList updates={loadedUpdates} locale={locale} t={t} />
							) : null}
						</div>
					</details>
				) : null}
			</div>
		</>
	)
}
