'use client'

import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { MarketAvailabilityClientList } from '@/components/data/MarketAvailabilityClientList'
import type { MarketAvailabilityUpdate } from '@/lib/graphql/operations/market'
import { fetchMarketJson, marketRevisionParam } from '@/lib/market-client'
import { markRouteReadyStart } from '@/lib/analytics/route-navigation'
import { MARKET_AVAILABILITY_HIGHLIGHT_LIMIT } from '@/lib/market'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

type LoadedSnapshot = {
	key: string
	items: MarketAvailabilityUpdate[]
	totalCount: number
	nextOffset: number | null
}

type ReadySnapshot = {
	key: string
	readyKey: string
}

type AvailabilityError = {
	key: string
	kind: 'unavailable' | 'revision'
}

const availabilityItemKey = (item: MarketAvailabilityUpdate): string =>
	`${item.player.playerId}:${item.observedDate}`

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
	const common = useTranslations('Common')
	const locale = useLocale()
	const snapshotKey = `${revision ?? 'none'}:${days}`
	const [loadedSnapshot, setLoadedSnapshot] = useState<LoadedSnapshot | null>(
		null
	)
	const [loadingKey, setLoadingKey] = useState<string | null>(null)
	const [error, setError] = useState<AvailabilityError | null>(null)
	const [readySnapshot, setReadySnapshot] = useState<ReadySnapshot | null>(null)
	const detailsRef = useRef<HTMLDetailsElement | null>(null)
	const latestSnapshotKey = useRef(snapshotKey)
	const loadInitialRef = useRef<() => Promise<void>>(async () => {})
	const loadedUpdates =
		loadedSnapshot?.key === snapshotKey ? loadedSnapshot.items : []
	const isLoaded = loadedSnapshot?.key === snapshotKey
	const loading = loadingKey?.startsWith(`${snapshotKey}:`) ?? false
	const nextOffset =
		loadedSnapshot?.key === snapshotKey ? loadedSnapshot.nextOffset : null
	const revisionChanged =
		error?.key === snapshotKey && error.kind === 'revision'
	const unavailable = error?.key === snapshotKey && error.kind === 'unavailable'
	const availabilityReadyKey =
		readySnapshot?.key === snapshotKey ? readySnapshot.readyKey : null

	const loadPage = useCallback(
		async (offset: number) => {
			if (
				!revision ||
				loading ||
				(offset === 0 && isLoaded) ||
				(offset > 0 && (!isLoaded || nextOffset !== offset))
			)
				return
			const requestKey = snapshotKey
			const requestLoadingKey = `${requestKey}:${offset}`
			setLoadingKey(requestLoadingKey)
			setError(null)
			try {
				if (offset === 0) {
					markRouteReadyStart(
						window.location.pathname,
						performance.now(),
						requestKey
					)
				}
				const data = await fetchMarketJson<{
					revision?: string
					items?: MarketAvailabilityUpdate[]
					totalCount?: number
					nextOffset?: number | null
				}>('availability', {
					days: String(days),
					revision: marketRevisionParam(revision),
					offset: String(offset)
				})
				if (latestSnapshotKey.current !== requestKey) return
				if (
					marketRevisionParam(data.revision) !== marketRevisionParam(revision)
				) {
					throw new Error('__MARKET_SNAPSHOT_CHANGED__')
				}
				const pageItems = data.items ?? []
				const totalCount = data.totalCount ?? pageItems.length
				setLoadedSnapshot(current => {
					const previous =
						offset === 0 || current?.key !== requestKey ? [] : current.items
					const seen = new Set(previous.map(availabilityItemKey))
					const items = [...previous]
					for (const item of pageItems) {
						if (seen.has(availabilityItemKey(item))) continue
						seen.add(availabilityItemKey(item))
						items.push(item)
					}
					return {
						key: requestKey,
						items,
						totalCount,
						nextOffset: data.nextOffset ?? null
					}
				})
				if (offset === 0) {
					setReadySnapshot({ key: requestKey, readyKey: requestKey })
				}
			} catch (requestError) {
				if (latestSnapshotKey.current !== requestKey) return
				const revisionError =
					requestError instanceof Error &&
					requestError.message === '__MARKET_SNAPSHOT_CHANGED__'
				if (revisionError) setLoadedSnapshot(null)
				setError({
					key: requestKey,
					kind: revisionError ? 'revision' : 'unavailable'
				})
				setReadySnapshot(null)
			} finally {
				setLoadingKey(current =>
					current === requestLoadingKey ? null : current
				)
			}
		},
		[days, isLoaded, loading, nextOffset, revision, snapshotKey]
	)

	const loadInitial = useCallback(() => loadPage(0), [loadPage])
	const loadMore = useCallback(() => {
		if (nextOffset !== null) void loadPage(nextOffset)
	}, [loadPage, nextOffset])

	useEffect(() => {
		latestSnapshotKey.current = snapshotKey
	}, [snapshotKey])

	useEffect(() => {
		loadInitialRef.current = loadInitial
	}, [loadInitial])

	useEffect(() => {
		if (detailsRef.current?.open) void loadInitialRef.current()
	}, [snapshotKey])

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
						ref={detailsRef}
						data-testid="market-availability-disclosure"
						className="mt-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5"
						onToggle={event => {
							if (event.currentTarget.open) void loadInitial()
						}}
					>
						<summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
							{t('availabilityEvidence', { count })}
						</summary>
						<div className="mt-3 border-t border-border/50 pt-3">
							{loading && !isLoaded ? (
								<p className="text-xs text-muted-foreground">
									{t('searchingPlayers')}
								</p>
							) : null}
							{revisionChanged ? (
								<div className="space-y-2 text-xs text-destructive">
									<p>{common('pageLoadErrorDescription')}</p>
									<button
										type="button"
										className="rounded-md border px-2.5 py-1 font-medium hover:bg-muted"
										onClick={() => void loadInitial()}
									>
										{common('tryAgain')}
									</button>
								</div>
							) : null}
							{unavailable ? (
								<p className="text-xs text-destructive">
									{t('dataUnavailable')}
								</p>
							) : null}
							{isLoaded && !loading && !revisionChanged ? (
								<>
									<p className="mb-3 text-xs text-muted-foreground">
										{t('observationCount', {
											observed: loadedUpdates.length,
											requested: loadedSnapshot?.totalCount ?? count
										})}
									</p>
									<MarketAvailabilityClientList
										updates={loadedUpdates}
										locale={locale}
										t={t}
									/>
									{nextOffset !== null ? (
										<button
											type="button"
											className="mt-3 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
											onClick={loadMore}
											disabled={loading}
										>
											{loading
												? t('searchingPlayers')
												: t('availabilityLoadMore')}
										</button>
									) : null}
								</>
							) : null}
						</div>
					</details>
				) : null}
			</div>
		</>
	)
}
