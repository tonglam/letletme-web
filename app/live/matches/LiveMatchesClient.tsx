'use client'

import PageShell from '@/components/layout/PageShell'
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
	GET_CURRENT_AND_NEXT_EVENTS,
	type EventsResponse
} from '@/lib/graphql/operations/events'
import {
	GET_LIVE_SNAPSHOT,
	type LiveSnapshotResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import {
	liveRefreshEventIdentityChanged,
	liveSnapshotNeedsRefresh,
	shouldPollLiveSnapshot
} from '@/lib/live-refresh'
import { getLiveMatchesSnapshot } from '@/lib/live-matches'
import { usePageActive } from '@/hooks/use-page-active'
import type { Match } from '@/types/match'
import { RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const LIVE_MATCHES_TAB_STORAGE_KEY = 'live-matches-active-tab'
type LiveMatchesTab = 'live' | 'finished' | 'not-started' | 'upcoming'
type LiveStatusTab = Match['status']

const TAB_CONFIG: ReadonlyArray<{
	value: LiveMatchesTab
	labelKey: 'noLive' | 'noFinished' | 'noNotStarted' | 'noUpcoming'
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
	},
	{
		value: 'upcoming',
		labelKey: 'noUpcoming',
		statuses: ['UPCOMING']
	}
] as const

function isLiveMatchesTab(value: string): value is LiveMatchesTab {
	return (
		value === 'live' ||
		value === 'finished' ||
		value === 'not-started' ||
		value === 'upcoming'
	)
}

function getPreferredTab(matches: Match[]): LiveMatchesTab {
	const hasLive = matches.some(
		match => match.status === 'LIVE' || match.status === 'HT'
	)
	const hasFinished = matches.some(match => match.status === 'FT')
	const hasNotStarted = matches.some(match => match.status === 'NOT_STARTED')
	const hasUpcoming = matches.some(match => match.status === 'UPCOMING')

	if (hasLive) return 'live'
	if (hasNotStarted) return 'not-started'
	if (hasFinished) return 'finished'
	if (hasUpcoming) return 'upcoming'
	return 'live'
}

export function LiveMatchesClient({
	initialMatches,
	initialError,
	currentEventId,
	nextEventId,
	initialSnapshot
}: {
	initialMatches: Match[]
	initialError?: string | null
	currentEventId?: number
	nextEventId?: number
	initialSnapshot?: LiveSnapshotStatus | null
}) {
	const t = useTranslations('LiveMatches')
	const isPageActive = usePageActive()
	const [matches, setMatches] = useState<Match[]>(initialMatches)
	const [resolvedCurrentEventId, setResolvedCurrentEventId] = useState<
		number | undefined
	>(currentEventId)
	const [resolvedNextEventId, setResolvedNextEventId] = useState<
		number | undefined
	>(nextEventId)
	const [activeTab, setActiveTab] = useState<LiveMatchesTab>(() =>
		getPreferredTab(initialMatches)
	)
	const [isLoading, setIsLoading] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [error, setError] = useState<string | null>(initialError ?? null)
	const [snapshot, setSnapshot] = useState<LiveSnapshotStatus | null>(
		initialSnapshot ?? null
	)
	const snapshotRef = useRef<LiveSnapshotStatus | null>(initialSnapshot ?? null)
	const hasSavedTabPreference = useRef(false)
	const isFetchInFlight = useRef(false)
	const pendingRefreshRef = useRef(false)
	const mountedRef = useRef(true)
	const freshnessRequestRef = useRef<Promise<void> | null>(null)
	const hasLastGoodData = useRef(initialMatches.length > 0)
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
			eventIds?: { currentEventId?: number; nextEventId?: number }
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
				const data = await getLiveMatchesSnapshot(
					eventIds?.nextEventId ?? resolvedNextEventId ?? null,
					executeQuery,
					eventIds?.currentEventId ?? resolvedCurrentEventId ?? null
				)
				if (!mountedRef.current) return
				const mappedMatches = data.matches
				setMatches(mappedMatches)
				setResolvedCurrentEventId(data.currentEventId ?? undefined)
				setResolvedNextEventId(data.nextEventId ?? undefined)
				acceptSnapshot(data.snapshot)
				hasLastGoodData.current = true

				if (!hasSavedTabPreference.current) {
					setActiveTab(getPreferredTab(mappedMatches))
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
				const events = await executeQuery<EventsResponse>(
					GET_CURRENT_AND_NEXT_EVENTS,
					undefined,
					{ cache: 'no-store' }
				)
				const currentEventId = events.current[0]?.id
				const nextEventId = events.next[0]?.id
				if (
					currentEventId &&
					liveRefreshEventIdentityChanged(
						resolvedCurrentEventId,
						resolvedNextEventId,
						currentEventId,
						nextEventId
					)
				) {
					setResolvedCurrentEventId(currentEventId)
					setResolvedNextEventId(nextEventId)
					await fetchMatches(true, { currentEventId, nextEventId })
					return
				}
				const probe = await executeQuery<LiveSnapshotResponse>(
					GET_LIVE_SNAPSHOT,
					{ eventId },
					{ cache: 'no-store' }
				)
				if (
					!liveSnapshotNeedsRefresh(snapshotRef.current, probe.liveSnapshot)
				) {
					acceptSnapshot(probe.liveSnapshot)
					setError(null)
					return
				}
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
	}, [acceptSnapshot, fetchMatches, resolvedCurrentEventId, resolvedNextEventId, t])

	const handleTabChange = (value: string) => {
		if (!isLiveMatchesTab(value)) return

		setActiveTab(value)
		hasSavedTabPreference.current = true
		try {
			window.localStorage.setItem(LIVE_MATCHES_TAB_STORAGE_KEY, value)
		} catch {
			// Tab preference is optional.
		}
	}

	useEffect(() => {
		let savedTab: string | null = null
		try {
			savedTab = window.localStorage.getItem(LIVE_MATCHES_TAB_STORAGE_KEY)
		} catch {
			return
		}
		if (savedTab && isLiveMatchesTab(savedTab)) {
			hasSavedTabPreference.current = true
			const timeoutId = window.setTimeout(() => setActiveTab(savedTab), 0)
			return () => window.clearTimeout(timeoutId)
		}
	}, [])

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
			'not-started': matches.filter(match => match.status === 'NOT_STARTED'),
			upcoming: matches.filter(match => match.status === 'UPCOMING')
		} satisfies Record<LiveMatchesTab, Match[]>
	}, [matches])

	const pollingEventId = resolvedCurrentEventId
	const autoRefreshEnabled = shouldPollLiveSnapshot({
		isPageActive,
		currentEventId: pollingEventId,
		selectedEventId: pollingEventId,
		snapshot,
		probeEventIdentity: true
	})
	const activeTabConfig = TAB_CONFIG.find(config => config.value === activeTab)
	const activeMatches = matchesByTab[activeTab]

	const headerActions = (
		<div className="flex flex-col items-end gap-1">
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
			{!isLoading || isRefreshing ? (
				<LiveAutoRefreshCountdown
					enabled={autoRefreshEnabled}
					onRefresh={autoRefreshMatches}
					renderLabel={seconds => t('autoRefresh', { seconds })}
				/>
			) : null}
		</div>
	)

	if (isLoading && !isRefreshing) {
		return (
			<PageShell>
				<div className="container mx-auto max-w-4xl px-4 py-8">
					<StatsPageHeader
						eyebrow={t('eyebrow')}
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
						eyebrow={t('eyebrow')}
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
				{error ? (
					<p
						className="mb-4 text-sm text-destructive"
						role="alert"
					>
						{t('error', { message: error })}
					</p>
				) : null}
				<StatsPageHeader
					eyebrow={t('eyebrow')}
					title={t('title')}
					badge={headerActions}
				/>
				<Tabs
					value={activeTab}
					onValueChange={handleTabChange}
					className="space-y-5"
				>
					<StatsTabsShell>
						<TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
							<TabsTrigger
								value="live"
								className="w-full"
							>
								{t('liveNow')}
							</TabsTrigger>
							<TabsTrigger
								value="finished"
								className="w-full"
							>
								{t('finished')}
							</TabsTrigger>
							<TabsTrigger
								value="not-started"
								className="w-full"
							>
								{t('notStarted')}
							</TabsTrigger>
							<TabsTrigger
								value="upcoming"
								className="w-full"
							>
								{t('upcoming')}
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
									eventId={resolvedCurrentEventId}
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
		</PageShell>
	)
}
