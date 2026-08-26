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
	GET_LIVE_CONTEXT,
	type LiveContextResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import {
	liveRefreshEventIdentityChanged,
	liveContextToSnapshot,
	liveSnapshotNeedsRefresh,
	shouldPollLiveMatchesTransition,
	shouldPollLiveSnapshot
} from '@/lib/live-refresh'
import {
	getLiveMatchesSnapshot,
	getPreferredLiveMatchesTab
} from '@/lib/live-matches'
import { selectLiveMatchEvent } from '@/lib/live-match-selection'
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
		statuses: ['NOT_STARTED']
	}
] as const

function isLiveMatchesTab(value: string): value is LiveMatchesTab {
	return (
		value === 'live' ||
		value === 'finished' ||
		value === 'not-started'
	)
}

export function LiveMatchesClient({
	initialMatches,
	initialError,
	currentEventId,
	selectedEventId: initialSelectedEventId,
	nextEventId,
	initialSnapshot
}: {
	initialMatches: Match[]
	initialError?: string | null
	currentEventId?: number
	selectedEventId?: number
	nextEventId?: number
	initialSnapshot?: LiveSnapshotStatus | null
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
	const [resolvedNextEventId, setResolvedNextEventId] = useState<
		number | undefined
	>(nextEventId)
	const [activeTab, setActiveTab] = useState<LiveMatchesTab>(() =>
		getPreferredLiveMatchesTab(initialMatches)
	)
	const [isLoading, setIsLoading] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [error, setError] = useState<string | null>(initialError ?? null)
	const [snapshot, setSnapshot] = useState<LiveSnapshotStatus | null>(
		initialSnapshot ?? null
	)
	const snapshotRef = useRef<LiveSnapshotStatus | null>(initialSnapshot ?? null)
	const hasSavedTabPreference = useRef(false)
	const hasUserSelectedTab = useRef(false)
	const isFetchInFlight = useRef(false)
	const pendingRefreshRef = useRef(false)
	const mountedRef = useRef(true)
	const freshnessRequestRef = useRef<Promise<void> | null>(null)
	const hasLastGoodData = useRef(initialMatches.length > 0)
	const hasRequestedInitialFixturePlayers = useRef(false)
	const acceptSnapshot = useCallback((next: LiveSnapshotStatus | null) => {
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
			eventIds?: {
				currentEventId?: number
				nextEventId?: number | null
				revision?: string | null
			}
		) => {
			if (isFetchInFlight.current) {
				// Coalesce concurrent manual/auto refreshes into one trailing fetch.
				if (isRefresh) pendingRefreshRef.current = true
				return
			}

			isFetchInFlight.current = true

			try {
				if (isRefresh) {
					setIsRefreshing(true)
				} else {
					setIsLoading(true)
				}
				setError(null)
				const resolvedNextEventIdForSnapshot =
					eventIds && 'nextEventId' in eventIds
						? (eventIds.nextEventId ?? null)
						: (resolvedNextEventId ?? null)

				const data = await getLiveMatchesSnapshot(
					resolvedNextEventIdForSnapshot,
					executeQuery,
					eventIds?.currentEventId ?? resolvedCurrentEventId ?? null,
					{
						preferHttp: true,
						revision:
							eventIds?.revision ?? snapshotRef.current?.revision ?? null
					}
				)
				if (!mountedRef.current) return
				const lifecycleCurrentEventId =
					data.currentEventId ?? eventIds?.currentEventId ?? resolvedCurrentEventId
				const nextSelectedEventId = lifecycleCurrentEventId
					? selectLiveMatchEvent(
							data.matches,
							lifecycleCurrentEventId,
							new Date()
						)
					: undefined
				const mappedMatches =
					nextSelectedEventId &&
					nextSelectedEventId !== lifecycleCurrentEventId
						? data.matches.filter(
								match => match.eventId === nextSelectedEventId
							)
						: data.matches
				setMatches(mappedMatches)
				setResolvedCurrentEventId(lifecycleCurrentEventId)
				setSelectedEventId(nextSelectedEventId)
				setResolvedNextEventId(data.nextEventId ?? undefined)
					acceptSnapshot(
							nextSelectedEventId === lifecycleCurrentEventId
								? data.snapshot
								: null
					)
				hasLastGoodData.current = true

				if (
					!hasUserSelectedTab.current &&
					!hasSavedTabPreference.current
				) {
					setActiveTab(getPreferredLiveMatchesTab(mappedMatches))
				}
			} catch (err) {
				console.error('Failed to fetch live matches:', err)
				if (mountedRef.current) {
					setError(t(hasLastGoodData.current ? 'refreshFailed' : 'loadFailed'))
				}
			} finally {
				isFetchInFlight.current = false
				if (!mountedRef.current) {
					pendingRefreshRef.current = false
					return
				}
				setIsLoading(false)
				setIsRefreshing(false)
				if (pendingRefreshRef.current) {
					pendingRefreshRef.current = false
					void fetchMatches(true)
				}
			}
		},
		[acceptSnapshot, resolvedCurrentEventId, resolvedNextEventId, t]
	)

	const autoRefreshMatches = useCallback((): Promise<void> => {
		if (freshnessRequestRef.current) return freshnessRequestRef.current
		// isCurrent only — do not fall back to snapshot.eventId for poll identity
		const eventId = resolvedCurrentEventId
		if (!eventId) return Promise.resolve()

		const request = (async () => {
			try {
				const probe = await executeQuery<LiveContextResponse>(
					GET_LIVE_CONTEXT,
					undefined,
					{ cache: 'no-store' }
				)
				const context = probe.liveContext
				const observedSnapshot = liveContextToSnapshot(probe.liveContext)
				const observedCurrentEventId = context?.anchorEventId ?? undefined
				const observedNextEventId = context?.nextEventId ?? undefined
				const eventIdentityChanged =
					Boolean(observedCurrentEventId) &&
					liveRefreshEventIdentityChanged(
						resolvedCurrentEventId,
						resolvedNextEventId,
						observedCurrentEventId,
						observedNextEventId
					)
				if (eventIdentityChanged) {
					setResolvedCurrentEventId(observedCurrentEventId)
					setResolvedNextEventId(observedNextEventId)
					await fetchMatches(true, {
						currentEventId: observedCurrentEventId,
						nextEventId: observedNextEventId,
						revision: observedSnapshot?.revision ?? null
					})
					return
				}
				// Once the selected matchday is terminal, this heartbeat is only
				// for discovering a new event identity. Do not reload the same
				// finalized desk just because its checkedAt changed.
				if (
					shouldPollLiveMatchesTransition({
						isPageActive,
						currentEventId: resolvedCurrentEventId,
						nextEventId: resolvedNextEventId,
						snapshot: snapshotRef.current
						})
				) {
						setError(null)
						return
				}
				if (!liveSnapshotNeedsRefresh(snapshotRef.current, observedSnapshot)) {
					acceptSnapshot(observedSnapshot)
					setError(null)
					return
				}
				await fetchMatches(true, {
					revision: observedSnapshot?.revision ?? null
				})
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
	}, [
		acceptSnapshot,
		fetchMatches,
		isPageActive,
		resolvedCurrentEventId,
		resolvedNextEventId,
		t
	])

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
			'not-started': matches.filter(match => match.status === 'NOT_STARTED')
		} satisfies Record<LiveMatchesTab, Match[]>
	}, [matches])
	const tabCountLabel = (tab: LiveMatchesTab) =>
		t('matchCount', { count: matchesByTab[tab].length })
	useEffect(() => {
		if (
			hasRequestedInitialFixturePlayers.current ||
			!initialMatches.some(
				match =>
					match.status === 'LIVE' ||
					match.status === 'HT' ||
					match.status === 'FT'
			)
		)
			return
		hasRequestedInitialFixturePlayers.current = true
		// Keep the score/status desk in the first RSC payload and hydrate the
		// optional player section in the background.
		void fetchMatches(true)
	}, [fetchMatches, initialMatches])

	useEffect(() => {
		if (hasUserSelectedTab.current) return
		if (hasSavedTabPreference.current) return
		let savedTab: string | null = null
		try {
			savedTab = window.localStorage.getItem(LIVE_MATCHES_TAB_STORAGE_KEY)
		} catch {
			return
		}
		if (savedTab && isLiveMatchesTab(savedTab) && matchesByTab[savedTab].length > 0) {
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
	const autoRefreshEnabled = shouldPollLiveSnapshot({
		isPageActive,
		currentEventId: pollingEventId,
		selectedEventId: pollingEventId,
		snapshot,
		windowState: snapshot?.windowState ?? snapshot?.state,
		nextRefreshAt: snapshot?.nextRefreshAt
	}) || shouldPollLiveMatchesTransition({
		isPageActive,
		currentEventId: resolvedCurrentEventId,
		nextEventId: resolvedNextEventId,
		snapshot
	})
	const transitionPolling = shouldPollLiveMatchesTransition({
		isPageActive,
		currentEventId: resolvedCurrentEventId,
		nextEventId: resolvedNextEventId,
		snapshot
	})
	const lastUpdatedAt = snapshot?.checkedAt ?? null
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

			const eventTarget =
				event.target instanceof Element ? event.target : null
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
				onClick={() => fetchMatches(true)}
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
							nextRefreshAt={transitionPolling ? null : snapshot?.nextRefreshAt}
							renderLabel={seconds => t('autoRefresh', { seconds })}
							showLabel={!transitionPolling}
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
							onClick={() => fetchMatches(true)}
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
								<p className="rounded-lg border border-border/80 bg-card py-8 text-center text-muted-foreground shadow-sm">
									{activeTabConfig ? t(activeTabConfig.labelKey) : t('none')}
								</p>
							)}
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</PageShell>
	)
}
