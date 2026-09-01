'use client'

import PageShell from '@/components/layout/PageShell'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { MatchCard } from '@/components/live/MatchCard'
import {
	StatsPageHeader,
	StatsTabsShell
} from '@/components/stats/StatsSurfaces'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { executeQuery } from '@/lib/graphql-client'
import {
	liveMatchdayNeedsRefresh,
	shouldPollLiveMatchesTransition,
	shouldPollLiveMatchday
} from '@/lib/live-refresh'
import {
	canReplaceLiveMatchesLkg,
	getLiveMatchesHead,
	getLiveMatchesSnapshot,
	getPreferredLiveMatchesTab,
	retainLiveMatchdayDetailRevision,
	retainLiveMatchPlayerDetails,
	shouldRetainAcceptedLiveMatchDetails,
	type LiveMatchdayStatus
} from '@/lib/live-matches'
import { reportLiveMatchClientSignal } from '@/lib/analytics/client-vitals'
import { usePageActive } from '@/hooks/use-page-active'
import type { Match } from '@/types/match'
import { RefreshCw } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const LIVE_MATCHES_TAB_STORAGE_KEY = 'live-matches-active-tab'
type LiveMatchesTab = 'live' | 'finished' | 'not-started'
type LiveStatusTab = Match['status']

const TAB_CONFIG: ReadonlyArray<{
	value: LiveMatchesTab
	labelKey: 'noLive' | 'noFinished' | 'noNotStarted'
	statuses: ReadonlyArray<LiveStatusTab>
}> = [
	{
		value: 'live',
		labelKey: 'noLive',
		statuses: ['LIVE', 'HT']
	},
	{
		value: 'finished',
		labelKey: 'noFinished',
		statuses: ['FT']
	},
	{
		value: 'not-started',
		labelKey: 'noNotStarted',
		statuses: ['NOT_STARTED', 'UPCOMING']
	}
] as const

function isLiveMatchesTab(value: string): value is LiveMatchesTab {
	return value === 'live' || value === 'finished' || value === 'not-started'
}

type LiveMatchTelemetryResult =
	'ok' | 'error' | 'timeout' | 'auth_error' | 'stale' | 'unavailable'

function liveMatchTelemetryResult(
	availability: string,
	deliveryState: string
): LiveMatchTelemetryResult {
	if (availability === 'UNAVAILABLE' || deliveryState === 'UNAVAILABLE') {
		return 'unavailable'
	}
	if (deliveryState === 'STALE' || deliveryState === 'DEGRADED') {
		return 'stale'
	}
	return 'ok'
}

export function LiveMatchesClient({
	initialMatches,
	initialError,
	currentEventId,
	selectedEventId: initialSelectedEventId,
	initialSnapshot
}: {
	initialMatches: Match[]
	initialError?: string | null
	currentEventId?: number
	selectedEventId?: number
	initialSnapshot?: LiveMatchdayStatus | null
}) {
	const t = useTranslations('LiveMatches')
	const format = useFormatter()
	const isPageActive = usePageActive()
	const [matches, setMatches] = useState<Match[]>(initialMatches)
	const [resolvedCurrentEventId, setResolvedCurrentEventId] = useState<
		number | undefined
	>(currentEventId)
	const [selectedEventId, setSelectedEventId] = useState<number | undefined>(
		initialSelectedEventId ?? currentEventId
	)
	const [activeTab, setActiveTab] = useState<LiveMatchesTab>(() =>
		getPreferredLiveMatchesTab(initialMatches)
	)
	const [isLoading, setIsLoading] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [error, setError] = useState<string | null>(initialError ?? null)
	const [snapshot, setSnapshot] = useState<LiveMatchdayStatus | null>(
		initialSnapshot ?? null
	)
	const snapshotRef = useRef<LiveMatchdayStatus | null>(initialSnapshot ?? null)
	const matchesRef = useRef<Match[]>(initialMatches)
	const hasSavedTabPreference = useRef(false)
	const hasUserSelectedTab = useRef(false)
	const isFetchInFlight = useRef(false)
	const pendingRefreshRef = useRef<{ useActiveEvent: boolean } | null>(null)
	const mountedRef = useRef(true)
	const freshnessRequestRef = useRef<Promise<void> | null>(null)
	const hasLastGoodData = useRef(initialSnapshot != null)
	const acceptMatches = useCallback((next: Match[]) => {
		matchesRef.current = next
		setMatches(next)
	}, [])
	const acceptSnapshot = useCallback((next: LiveMatchdayStatus | null) => {
		snapshotRef.current = next
		setSnapshot(next)
	}, [])

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
		}
	}, [])

	const fetchMatches = useCallback(
		async (
			isRefresh = false,
			eventIds?: { currentEventId?: number; useActiveEvent?: boolean },
			prefetched?: Awaited<ReturnType<typeof getLiveMatchesSnapshot>>
		) => {
			if (isFetchInFlight.current) {
				// Coalesce concurrent manual/auto refreshes into one trailing fetch.
				if (isRefresh) {
					pendingRefreshRef.current = {
						useActiveEvent: eventIds?.useActiveEvent === true
					}
				}
				return
			}

			isFetchInFlight.current = true
			const fullRequestStartedAt = performance.now()

			try {
				if (isRefresh) {
					setIsRefreshing(true)
				} else {
					setIsLoading(true)
				}
				setError(null)
				const data =
					prefetched ??
					(await getLiveMatchesSnapshot(
						executeQuery,
						eventIds?.useActiveEvent
							? null
							: (eventIds?.currentEventId ?? resolvedCurrentEventId ?? null),
						{
							preferHttp: true
						}
					))
				reportLiveMatchClientSignal({
					view: 'FULL',
					durationMs: performance.now() - fullRequestStartedAt,
					decodedBytes: data.decodedBytes,
					result: liveMatchTelemetryResult(
						data.availability,
						data.delivery.state
					)
				})
				if (!mountedRef.current) return
				const acceptedSnapshot = snapshotRef.current
				const canRetainAcceptedDetails =
					data.snapshot !== null &&
					acceptedSnapshot !== null &&
					data.snapshot.season === acceptedSnapshot.season &&
					data.snapshot.eventId === acceptedSnapshot.eventId
				const retainAcceptedDetailRevision =
					canRetainAcceptedDetails &&
					data.snapshot !== null &&
					acceptedSnapshot !== null &&
					shouldRetainAcceptedLiveMatchDetails(data.snapshot, acceptedSnapshot)
				const matchesWithRetainedDetails = retainAcceptedDetailRevision
					? retainLiveMatchPlayerDetails(data.matches, matchesRef.current, {
							detailFallback: 'accepted'
						})
					: data.matches
				const snapshotWithRetainedDetails =
					retainAcceptedDetailRevision && data.snapshot && acceptedSnapshot
						? retainLiveMatchdayDetailRevision(data.snapshot, acceptedSnapshot)
						: data.snapshot
				const replaceablePublication = canReplaceLiveMatchesLkg(
					{
						...data,
						snapshot: snapshotWithRetainedDetails
					},
					acceptedSnapshot
				)
				if (!replaceablePublication && hasLastGoodData.current) {
					if (data.snapshot !== null) setError(t('refreshFailed'))
					return
				}
				const lifecycleCurrentEventId =
					data.currentEventId ??
					(eventIds?.useActiveEvent ? undefined : eventIds?.currentEventId) ??
					resolvedCurrentEventId
				acceptMatches(matchesWithRetainedDetails)
				setResolvedCurrentEventId(lifecycleCurrentEventId)
				setSelectedEventId(lifecycleCurrentEventId)
				acceptSnapshot(snapshotWithRetainedDetails)
				hasLastGoodData.current = replaceablePublication

				if (!hasUserSelectedTab.current && !hasSavedTabPreference.current) {
					setActiveTab(getPreferredLiveMatchesTab(matchesWithRetainedDetails))
				}
			} catch (err) {
				reportLiveMatchClientSignal({
					view: 'FULL',
					durationMs: performance.now() - fullRequestStartedAt,
					result: 'error'
				})
				console.error('Failed to fetch live matches:', err)
				if (mountedRef.current) {
					setError(t(hasLastGoodData.current ? 'refreshFailed' : 'loadFailed'))
				}
			} finally {
				isFetchInFlight.current = false
				if (!mountedRef.current) {
					pendingRefreshRef.current = null
					return
				}
				setIsLoading(false)
				setIsRefreshing(false)
				const pendingRefresh = pendingRefreshRef.current
				if (pendingRefresh) {
					pendingRefreshRef.current = null
					void fetchMatches(
						true,
						pendingRefresh.useActiveEvent ? { useActiveEvent: true } : undefined
					)
				}
			}
		},
		[acceptMatches, acceptSnapshot, resolvedCurrentEventId, t]
	)

	const autoRefreshMatches = useCallback((): Promise<void> => {
		if (freshnessRequestRef.current) return freshnessRequestRef.current
		// isCurrent only — do not fall back to snapshot.eventId for poll identity
		const eventId = resolvedCurrentEventId
		if (!eventId) return Promise.resolve()

		const request = (async () => {
			const probeHead = async (eventId: number | null) => {
				const headRequestStartedAt = performance.now()
				try {
					const result = await getLiveMatchesHead(executeQuery, eventId)
					reportLiveMatchClientSignal({
						view: 'HEAD',
						durationMs: performance.now() - headRequestStartedAt,
						decodedBytes: result.decodedBytes,
						result: liveMatchTelemetryResult(
							result.availability,
							result.delivery.state
						)
					})
					return result
				} catch (error) {
					reportLiveMatchClientSignal({
						view: 'HEAD',
						durationMs: performance.now() - headRequestStartedAt,
						result: 'error'
					})
					throw error
				}
			}
			try {
				const transitionProbe = shouldPollLiveMatchesTransition({
					isPageActive,
					currentEventId: resolvedCurrentEventId,
					snapshot: snapshotRef.current
				})
				if (transitionProbe) {
					// Match V3 owns the active-event pointer for this page. A Live
					// Points context probe can be stale or unavailable after the
					// current event has moved on.
					const observedData = await probeHead(null)
					const observedCurrentEventId =
						observedData.currentEventId ?? undefined
					if (
						observedCurrentEventId &&
						observedCurrentEventId !== resolvedCurrentEventId
					) {
						reportLiveMatchClientSignal({ revisionChanged: true })
						await fetchMatches(true, { currentEventId: observedCurrentEventId })
						return
					}
					if (
						observedData.snapshot &&
						liveMatchdayNeedsRefresh(snapshotRef.current, observedData.snapshot)
					) {
						reportLiveMatchClientSignal({ revisionChanged: true })
						await fetchMatches(true)
						return
					}
					setError(null)
					return
				}
				const observedData = await probeHead(resolvedCurrentEventId)
				const observedSnapshot = observedData.snapshot
				// An unavailable publication is an observation failure, not permission
				// to erase or refetch the last complete board.
				if (!observedSnapshot) {
					// A valid V3 response without a snapshot is the normal post-deadline
					// sync window. Keep the countdown armed and retain any LKG.
					setError(null)
					return
				}
				if (
					observedData.currentEventId &&
					observedData.currentEventId !== resolvedCurrentEventId
				) {
					reportLiveMatchClientSignal({ revisionChanged: true })
					await fetchMatches(true, {
						currentEventId: observedData.currentEventId
					})
					return
				}
				if (!liveMatchdayNeedsRefresh(snapshotRef.current, observedSnapshot)) {
					if (canReplaceLiveMatchesLkg(observedData, snapshotRef.current)) {
						acceptSnapshot(observedSnapshot)
					}
					setError(null)
					return
				}
				reportLiveMatchClientSignal({ revisionChanged: true })
				await fetchMatches(true)
			} catch (probeError) {
				console.error('Failed to check live match freshness:', probeError)
				setError(t('refreshFailed'))
			}
		})()
		freshnessRequestRef.current = request
		void request.finally(() => {
			if (freshnessRequestRef.current === request) {
				freshnessRequestRef.current = null
			}
		})
		return request
	}, [acceptSnapshot, fetchMatches, isPageActive, resolvedCurrentEventId, t])

	const handleTabChange = (value: string) => {
		if (!isLiveMatchesTab(value)) return

		setActiveTab(value)
		hasUserSelectedTab.current = true
		hasSavedTabPreference.current = true
		try {
			window.localStorage.setItem(LIVE_MATCHES_TAB_STORAGE_KEY, value)
		} catch {
			// Tab preference is optional.
		}
	}

	const matchesByTab = useMemo(() => {
		return {
			live: matches.filter(
				match => match.status === 'LIVE' || match.status === 'HT'
			),
			finished: matches
				.filter(match => match.status === 'FT')
				.sort((a, b) => {
					const tA = new Date(a.kickoff || '').getTime()
					const tB = new Date(b.kickoff || '').getTime()
					return (
						(Number.isNaN(tB) ? 1 : 0) - (Number.isNaN(tA) ? 1 : 0) || tB - tA
					)
				}),
			'not-started': matches.filter(
				match => match.status === 'NOT_STARTED' || match.status === 'UPCOMING'
			)
		} satisfies Record<LiveMatchesTab, Match[]>
	}, [matches])
	const tabCountLabel = (tab: LiveMatchesTab) =>
		t('matchCount', { count: matchesByTab[tab].length })
	useEffect(() => {
		if (hasUserSelectedTab.current) return
		if (hasSavedTabPreference.current) return
		let savedTab: string | null = null
		try {
			savedTab = window.localStorage.getItem(LIVE_MATCHES_TAB_STORAGE_KEY)
		} catch {
			return
		}
		if (
			savedTab &&
			isLiveMatchesTab(savedTab) &&
			matchesByTab[savedTab].length > 0
		) {
			hasSavedTabPreference.current = true
			const timeoutId = window.setTimeout(() => setActiveTab(savedTab), 0)
			return () => window.clearTimeout(timeoutId)
		}
		// Remove the retired Next Gameweek tab from older browser sessions.
		if (savedTab === 'upcoming' || (savedTab && isLiveMatchesTab(savedTab))) {
			try {
				window.localStorage.removeItem(LIVE_MATCHES_TAB_STORAGE_KEY)
			} catch {
				// Tab preference is optional.
			}
		}
	}, [matchesByTab])

	const pollingEventId = resolvedCurrentEventId
	const autoRefreshEnabled =
		shouldPollLiveMatchday({
			isPageActive,
			currentEventId: pollingEventId,
			selectedEventId: pollingEventId,
			snapshot
		}) ||
		shouldPollLiveMatchesTransition({
			isPageActive,
			currentEventId: resolvedCurrentEventId,
			snapshot
		})
	const transitionPolling = shouldPollLiveMatchesTransition({
		isPageActive,
		currentEventId: resolvedCurrentEventId,
		snapshot
	})
	const refreshMatches = useCallback(() => {
		void fetchMatches(
			true,
			transitionPolling ? { useActiveEvent: true } : undefined
		)
	}, [fetchMatches, transitionPolling])
	const lastUpdatedAt = snapshot?.times.deskContentUpdatedAt ?? null
	const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string | null>(null)
	useEffect(() => {
		if (!lastUpdatedAt) {
			setLastUpdatedLabel(null)
			return
		}
		const parsed = new Date(lastUpdatedAt)
		if (Number.isNaN(parsed.getTime())) {
			setLastUpdatedLabel(null)
			return
		}
		const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		setLastUpdatedLabel(
			format.dateTime(parsed, {
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				timeZone: browserTimeZone
			})
		)
	}, [format, lastUpdatedAt])
	const detailDelayed =
		matches.some(match => match.status !== 'NOT_STARTED') &&
		(snapshot?.detailDelivery.state === 'PENDING' ||
			snapshot?.detailDelivery.state === 'STALE' ||
			snapshot?.detailDelivery.state === 'DEGRADED')
	const detailUpdatedAt = snapshot?.times.detailContentUpdatedAt ?? null
	const [detailUpdatedLabel, setDetailUpdatedLabel] = useState<string | null>(
		null
	)
	useEffect(() => {
		if (!detailUpdatedAt) {
			setDetailUpdatedLabel(null)
			return
		}
		const parsed = new Date(detailUpdatedAt)
		if (Number.isNaN(parsed.getTime())) {
			setDetailUpdatedLabel(null)
			return
		}
		const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		setDetailUpdatedLabel(
			format.dateTime(parsed, {
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				timeZone: browserTimeZone
			})
		)
	}, [detailUpdatedAt, format])
	const activeTabConfig = TAB_CONFIG.find(config => config.value === activeTab)
	const activeMatches = matchesByTab[activeTab]

	useEffect(() => {
		if (activeMatches.length < 2) return

		const handleKeyDown = (event: KeyboardEvent) => {
			const direction =
				event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
			if (
				direction === 0 ||
				event.defaultPrevented ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey
			) {
				return
			}

			const eventTarget = event.target instanceof Element ? event.target : null
			if (
				eventTarget?.closest(
					'input, textarea, select, [contenteditable="true"], [role="dialog"], [data-radix-dialog-content]'
				)
			) {
				return
			}

			const isMatchNavigation = Boolean(
				eventTarget?.closest('[data-match-navigation="true"]')
			)
			const isInteractive = Boolean(
				eventTarget?.closest(
					'button, a, summary, [role="button"], [role="tab"], [role="menuitem"]'
				)
			)
			if (isInteractive && !isMatchNavigation) return

			const matchIds = activeMatches.map(match => String(match.id))
			const cards = Array.from(
				document.querySelectorAll<HTMLElement>('[data-live-match-card="true"]')
			).filter(card => matchIds.includes(card.dataset.matchId ?? ''))
			if (cards.length < 2) return

			let currentIndex = -1
			const focusedCard = eventTarget?.closest<HTMLElement>(
				'[data-live-match-card="true"]'
			)
			if (focusedCard) currentIndex = cards.indexOf(focusedCard)

			if (currentIndex < 0) {
				const viewportAnchor = Math.min(
					Math.max(window.innerHeight * 0.35, 120),
					window.innerHeight - 80
				)
				currentIndex = cards.findIndex(card => {
					const rect = card.getBoundingClientRect()
					return rect.top <= viewportAnchor && rect.bottom > viewportAnchor
				})
				if (currentIndex < 0) {
					currentIndex = cards.findIndex(
						card => card.getBoundingClientRect().bottom > 0
					)
				}
				if (currentIndex < 0) currentIndex = 0
			}

			const targetCard = cards[currentIndex + direction]
			if (!targetCard) return

			event.preventDefault()
			targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
			window.requestAnimationFrame(() => {
				targetCard
					.querySelector<HTMLElement>('[data-match-navigation="true"]')
					?.focus({ preventScroll: true })
			})
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [activeMatches])

	const headerActions = (
		<div className="flex flex-wrap items-center justify-end gap-2">
			{detailDelayed ? (
				<span
					className="whitespace-nowrap text-xs text-amber-700 dark:text-amber-300"
					role="status"
				>
					{detailUpdatedLabel
						? t('detailUpdatingSince', { time: detailUpdatedLabel })
						: t('detailUpdating')}
				</span>
			) : null}
			{lastUpdatedAt && lastUpdatedLabel ? (
				<time
					dateTime={lastUpdatedAt}
					className="whitespace-nowrap text-xs text-muted-foreground"
					role="status"
				>
					{t('lastUpdated', { time: lastUpdatedLabel })}
				</time>
			) : null}
			<Button
				variant="outline"
				size="icon"
				onClick={refreshMatches}
				disabled={isRefreshing || isLoading}
				className="shrink-0"
			>
				<RefreshCw
					className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
				/>
				<span className="sr-only">{t('refresh')}</span>
			</Button>
			<div className="min-h-4">
				{!isLoading || isRefreshing ? (
					<LiveAutoRefreshCountdown
						enabled={autoRefreshEnabled}
						onRefresh={autoRefreshMatches}
						nextRefreshAt={
							transitionPolling ? null : snapshot?.times.nextRefreshAt
						}
						renderLabel={seconds => t('autoRefresh', { seconds })}
						showLabel={false}
					/>
				) : null}
			</div>
		</div>
	)

	if (isLoading && !isRefreshing) {
		return (
			<PageShell>
				<div className="container mx-auto max-w-4xl px-4 py-8">
					<StatsPageHeader
						title={t('title')}
						badge={
							<Button
								variant="outline"
								size="icon"
								disabled
								className="shrink-0"
							>
								<RefreshCw className="h-4 w-4" />
								<span className="sr-only">{t('refresh')}</span>
							</Button>
						}
					/>
					<div className="flex items-center justify-center rounded-lg border border-border/80 bg-card py-12 shadow-sm">
						<p className="text-muted-foreground">{t('loading')}</p>
					</div>
				</div>
			</PageShell>
		)
	}

	if (error && matches.length === 0 && !isRefreshing) {
		return (
			<PageShell>
				<div className="container mx-auto max-w-4xl px-4 py-8">
					<StatsPageHeader
						title={t('title')}
						badge={headerActions}
					/>
					<div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border/80 bg-card py-12 shadow-sm">
						<p
							className="text-destructive"
							role="alert"
						>
							{t('error', { message: error })}
						</p>
						<Button
							onClick={refreshMatches}
							variant="outline"
						>
							{t('tryAgain')}
						</Button>
					</div>
				</div>
			</PageShell>
		)
	}

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<RouteReadyMarker
					name="LIVE_MATCHDAY_READY"
					ready={!isLoading}
					audienceHint="public"
					goodMs={1000}
					poorMs={1500}
				/>
				{error ? (
					<p
						className="mb-4 text-sm text-destructive"
						role="alert"
					>
						{t('error', { message: error })}
					</p>
				) : null}
				<StatsPageHeader
					title={t('title')}
					badge={headerActions}
				/>
				<div>
					<Tabs
						value={activeTab}
						onValueChange={handleTabChange}
						className="space-y-5"
					>
						<StatsTabsShell>
							<TabsList className="grid h-auto w-full grid-cols-3 gap-1.5 sm:gap-2">
								<TabsTrigger
									value="live"
									className="w-full"
								>
									{t('liveNow')}
									<span className="ml-1 whitespace-nowrap font-mono text-xs text-muted-foreground">
										{tabCountLabel('live')}
									</span>
								</TabsTrigger>
								<TabsTrigger
									value="finished"
									className="w-full"
								>
									{t('finished')}
									<span className="ml-1 whitespace-nowrap font-mono text-xs text-muted-foreground">
										{tabCountLabel('finished')}
									</span>
								</TabsTrigger>
								<TabsTrigger
									value="not-started"
									className="w-full"
								>
									{t('notStarted')}
									<span className="ml-1 whitespace-nowrap font-mono text-xs text-muted-foreground">
										{tabCountLabel('not-started')}
									</span>
								</TabsTrigger>
							</TabsList>
						</StatsTabsShell>

						<TabsContent
							value={activeTab}
							className="mt-0 space-y-5"
						>
							{activeMatches.length > 0 ? (
								activeMatches.map((match, i) => (
									<MatchCard
										key={match.id}
										match={match}
										allMatches={activeMatches}
										currentIndex={i}
										eventId={selectedEventId}
									/>
								))
							) : (
								<p
									className="rounded-lg border border-border/80 bg-card py-8 text-center text-muted-foreground shadow-sm"
									role={
										!snapshot && matches.length === 0 ? 'status' : undefined
									}
								>
									{!snapshot && matches.length === 0
										? t('officialUpdating')
										: activeTabConfig
											? t(activeTabConfig.labelKey)
											: t('none')}
								</p>
							)}
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</PageShell>
	)
}
