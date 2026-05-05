'use client'

import RootLayout from '@/components/layout/RootLayout'
import { MatchCard } from '@/components/live/MatchCard'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { executeQuery } from '@/lib/graphql-client'
import { GET_LIVE_MATCHES, type LiveMatchesResponse } from '@/lib/graphql/queries'
import { useEvent } from '@/lib/event-context'
import { transformLiveMatches } from '@/lib/live-matches'
import type { Match } from '@/types/match'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const LIVE_MATCHES_TAB_STORAGE_KEY = 'live-matches-active-tab'
const LIVE_MATCHES_AUTO_REFRESH_SECONDS = 60
type LiveMatchesTab = 'live' | 'finished' | 'not-started' | 'upcoming'
type LiveStatusTab = Match['status']

const TAB_CONFIG: ReadonlyArray<{
	value: LiveMatchesTab
	label: string
	statuses: ReadonlyArray<LiveStatusTab>
}> = [
	{
		value: 'live',
		label: 'No live matches',
		statuses: ['LIVE', 'HT'],
	},
	{
		value: 'finished',
		label: 'No finished matches',
		statuses: ['FT'],
	},
	{
		value: 'not-started',
		label: 'No matches not started',
		statuses: ['NOT_STARTED'],
	},
	{
		value: 'upcoming',
		label: 'No upcoming matches',
		statuses: ['UPCOMING'],
	},
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
	const hasLive = matches.some((match) => match.status === 'LIVE' || match.status === 'HT')
	const hasFinished = matches.some((match) => match.status === 'FT')
	const hasNotStarted = matches.some((match) => match.status === 'NOT_STARTED')
	const hasUpcoming = matches.some((match) => match.status === 'UPCOMING')

	if (hasLive) return 'live'
	if (hasNotStarted) return 'not-started'
	if (hasFinished) return 'finished'
	if (hasUpcoming) return 'upcoming'
	return 'live'
}

function AutoRefreshCountdown({
	enabled,
	onRefresh,
}: {
	enabled: boolean
	onRefresh: () => Promise<void>
}) {
	const [countdown, setCountdown] = useState(LIVE_MATCHES_AUTO_REFRESH_SECONDS)
	const refreshInFlightRef = useRef(false)
	const onRefreshRef = useRef(onRefresh)

	useEffect(() => {
		onRefreshRef.current = onRefresh
	}, [onRefresh])

	useEffect(() => {
		if (!enabled) {
			return
		}

		const remainingRef = { current: LIVE_MATCHES_AUTO_REFRESH_SECONDS }

		const intervalId = window.setInterval(() => {
			remainingRef.current -= 1
			if (remainingRef.current <= 0) {
				remainingRef.current = LIVE_MATCHES_AUTO_REFRESH_SECONDS
				if (!refreshInFlightRef.current) {
					refreshInFlightRef.current = true
					void onRefreshRef.current().finally(() => {
						refreshInFlightRef.current = false
					})
				}
			}
			setCountdown(remainingRef.current)
		}, 1000)

		return () => {
			window.clearInterval(intervalId)
		}
	}, [enabled])

	if (!enabled) return null

	return (
		<p className="text-xs text-muted-foreground">
			Auto refresh in {countdown}s
		</p>
	)
}

export function LiveMatchesClient({
	initialMatches,
	initialError,
}: {
	initialMatches: Match[]
	initialError?: string | null
}) {
	const { currentEventId } = useEvent()
	const eventId = currentEventId ?? undefined
	const [matches, setMatches] = useState<Match[]>(initialMatches)
	const [activeTab, setActiveTab] = useState<LiveMatchesTab>(() =>
		getPreferredTab(initialMatches),
	)
	const [isLoading, setIsLoading] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [error, setError] = useState<string | null>(initialError ?? null)
	const hasSavedTabPreference = useRef(false)
	const isFetchInFlight = useRef(false)

	const fetchMatches = useCallback(async (isRefresh = false) => {
		if (isFetchInFlight.current) return

		isFetchInFlight.current = true

		try {
			if (isRefresh) {
				setIsRefreshing(true)
			} else {
				setIsLoading(true)
			}
			setError(null)
			const data = await executeQuery<LiveMatchesResponse>(GET_LIVE_MATCHES)
			const mappedMatches = transformLiveMatches(data.liveMatches)
			setMatches(mappedMatches)

			if (!hasSavedTabPreference.current) {
				setActiveTab(getPreferredTab(mappedMatches))
			}
		} catch (err) {
			console.error('Failed to fetch live matches:', err)
			setError(err instanceof Error ? err.message : 'Failed to load matches')
			setMatches([])
		} finally {
			setIsLoading(false)
			setIsRefreshing(false)
			isFetchInFlight.current = false
		}
	}, [])

	const handleTabChange = (value: string) => {
		if (!isLiveMatchesTab(value)) return

		setActiveTab(value)
		hasSavedTabPreference.current = true
		localStorage.setItem(LIVE_MATCHES_TAB_STORAGE_KEY, value)
	}

	useEffect(() => {
		const savedTab = localStorage.getItem(LIVE_MATCHES_TAB_STORAGE_KEY)
		if (savedTab && isLiveMatchesTab(savedTab)) {
			hasSavedTabPreference.current = true
			const timeoutId = window.setTimeout(() => setActiveTab(savedTab), 0)
			return () => window.clearTimeout(timeoutId)
		}
	}, [])

	const matchesByTab = useMemo(() => {
		return {
			live: matches.filter((match) => match.status === 'LIVE' || match.status === 'HT'),
			finished: matches
				.filter((match) => match.status === 'FT')
				.sort((a, b) => {
					const tA = new Date(a.kickoff || '').getTime()
					const tB = new Date(b.kickoff || '').getTime()
					return (Number.isNaN(tB) ? 1 : 0) - (Number.isNaN(tA) ? 1 : 0) || tB - tA
				}),
			'not-started': matches.filter((match) => match.status === 'NOT_STARTED'),
			upcoming: matches.filter((match) => match.status === 'UPCOMING'),
		} satisfies Record<LiveMatchesTab, Match[]>
	}, [matches])

	const hasLiveMatches = matchesByTab.live.length > 0
	const activeTabConfig = TAB_CONFIG.find((config) => config.value === activeTab)
	const activeMatches = matchesByTab[activeTab]

	if (isLoading && !isRefreshing) {
		return (
			<RootLayout>
				<div className="container max-w-4xl mx-auto px-4 py-8">
					<div className="flex items-center justify-between mb-8">
						<h1 className="text-3xl font-bold">Live Matches</h1>
						<Button variant="outline" size="icon" disabled className="shrink-0">
							<RefreshCw className="h-4 w-4" />
							<span className="sr-only">Refresh matches</span>
						</Button>
					</div>
					<div className="flex items-center justify-center py-12">
						<p className="text-muted-foreground">Loading matches...</p>
					</div>
				</div>
			</RootLayout>
		)
	}

	if (error && !isRefreshing) {
		return (
			<RootLayout>
				<div className="container max-w-4xl mx-auto px-4 py-8">
					<div className="flex items-center justify-between mb-8">
						<h1 className="text-3xl font-bold">Live Matches</h1>
						<Button
							variant="outline"
							size="icon"
							onClick={() => fetchMatches(true)}
							disabled={isRefreshing}
							className="shrink-0"
						>
							<RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
							<span className="sr-only">Refresh matches</span>
						</Button>
					</div>
					<div className="flex flex-col items-center justify-center py-12 gap-4">
						<p className="text-destructive">Error: {error}</p>
						<Button onClick={() => fetchMatches(true)} variant="outline">
							Try Again
						</Button>
					</div>
				</div>
			</RootLayout>
		)
	}

	return (
		<RootLayout>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<div className="flex items-center justify-between mb-8">
					<h1 className="text-3xl font-bold">Live Matches</h1>
					<div className="flex flex-col items-end gap-1">
						<Button
							variant="outline"
							size="icon"
							onClick={() => fetchMatches(true)}
							disabled={isRefreshing || isLoading}
							className="shrink-0"
						>
							<RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
							<span className="sr-only">Refresh matches</span>
						</Button>
						<AutoRefreshCountdown
							enabled={hasLiveMatches}
							onRefresh={() => fetchMatches(true)}
						/>
					</div>
				</div>
				<Tabs value={activeTab} onValueChange={handleTabChange}>
					<div className="bg-card rounded-lg p-4 mb-6 shadow-sm">
						<TabsList className="w-full grid grid-cols-4 gap-2 sm:gap-4">
							<TabsTrigger value="live" className="w-full">
								Live Now
							</TabsTrigger>
							<TabsTrigger value="finished" className="w-full">
								Finished
							</TabsTrigger>
							<TabsTrigger value="not-started" className="w-full">
								Not Started
							</TabsTrigger>
							<TabsTrigger value="upcoming" className="w-full">
								Upcoming
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value={activeTab} className="space-y-6">
						{activeMatches.length > 0 ? (
							activeMatches.map((match, i) => (
								<MatchCard
									key={match.id}
									match={match}
									allMatches={activeMatches}
									currentIndex={i}
									eventId={eventId}
								/>
							))
						) : (
							<p className="text-center text-muted-foreground py-8">
								{activeTabConfig?.label ?? 'No matches available'}
							</p>
						)}
					</TabsContent>
				</Tabs>
			</div>
		</RootLayout>
	)
}
