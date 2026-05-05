'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import RootLayout from '@/components/layout/RootLayout'
import { PlayerList } from '@/components/live/PlayerList'
import { TeamStats } from '@/components/live/TeamStats'
import {
	TransferSection,
	type TransferPair
} from '@/components/live/TransferSection'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSession } from '@/lib/auth-client'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_LIVE_POINTS,
	type EventLiveExplainResponse,
	type LiveCalcData,
	type LiveCalcDataResponse
} from '@/lib/graphql/queries'
import { useEvent } from '@/lib/event-context'
import type { Player, PlayerBreakdownStat } from '@/types/player'
import { Loader2, RefreshCw } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'

type NumericPositionMode = 'elementType' | 'squadOrder'

type AggregatedBreakdown = Map<string, { value: number; points: number }>

type BreakdownLookup = Map<
	string,
	{
		teamShortName: string
		stats: PlayerBreakdownStat[]
	}
>

const LIVE_POINTS_AUTO_REFRESH_SECONDS = 60
const aggregateBreakdownStats = (
	stats?: PlayerBreakdownStat[]
): AggregatedBreakdown => {
	return (stats ?? []).reduce<AggregatedBreakdown>((acc, stat) => {
		const existing = acc.get(stat.identifier) ?? { value: 0, points: 0 }
		acc.set(stat.identifier, {
			value: existing.value + (stat.value ?? 0),
			points: existing.points + (stat.points ?? 0)
		})
		return acc
	}, new Map())
}

const rollupBreakdownStats = (
	stats?: PlayerBreakdownStat[]
): PlayerBreakdownStat[] => {
	const aggregated = aggregateBreakdownStats(stats)
	return Array.from(aggregated.entries()).map(([identifier, totals]) => ({
		identifier,
		value: totals.value,
		points: totals.points
	}))
}

function buildEventLiveExplainBatchQuery(elementIds: number[]): string | null {
	if (elementIds.length === 0) {
		return null
	}

	const fields = elementIds
		.map(
			elementId => `
      e${elementId}: eventLiveExplain(eventId: $eventId, elementId: ${elementId}) {
        player {
          id
          webName
          team {
            id
            shortName
          }
        }
        breakdown {
          fixtureId
          stats {
            identifier
            value
            points
          }
        }
      }`
		)
		.join('\n')

	return `
    query GetEventLiveExplainBatch($eventId: Int!) {
      ${fields}
    }
  `
}

function normalizePosition(
	position: unknown,
	numericMode: NumericPositionMode
): Player['position'] {
	// Some APIs return numeric codes:
	// - element type: 1..4 (GKP/DEF/MID/FWD)
	// - squad order: 1..15 (2 GKP, 5 DEF, 5 MID, 3 FWD)
	if (typeof position === 'number') {
		if (numericMode === 'elementType') {
			switch (position) {
				case 1:
					return 'GKP'
				case 2:
					return 'DEF'
				case 3:
					return 'MID'
				case 4:
					return 'FWD'
				default:
					// Keep UI stable; backend sent unexpected value.
					return 'MID'
			}
		}

		// squadOrder
		if (position >= 1 && position <= 2) return 'GKP'
		if (position >= 3 && position <= 7) return 'DEF'
		if (position >= 8 && position <= 12) return 'MID'
		if (position >= 13 && position <= 15) return 'FWD'
		return 'MID'
	}

	if (typeof position !== 'string') {
		return 'MID'
	}

	const p = position.trim().toUpperCase()

	switch (p) {
		case 'GKP':
		case 'GK':
		case 'GOALKEEPER':
			return 'GKP'
		case 'DEF':
		case 'D':
		case 'DEFENDER':
			return 'DEF'
		case 'MID':
		case 'M':
		case 'MIDFIELDER':
			return 'MID'
		case 'FWD':
		case 'FW':
		case 'F':
		case 'FORWARD':
		case 'STR':
			return 'FWD'
		default:
			return 'MID'
	}
}

function mapLiveDataToPlayers(
	live: LiveCalcData,
	breakdownLookup: BreakdownLookup
): Player[] {
	const benchBoostActive =
		!!live.chip && live.chip.toLowerCase().includes('bench')
	const sortedPicks = [...live.pickList].sort((a, b) => a.position - b.position)

	return sortedPicks.map(pick => {
		const isCaptain = live.captainName === pick.webName
		// Keep bench-vs-starting distinction stable, even when Bench Boost is active.
		const isBench = pick.position >= 12
		const position = normalizePosition(pick.elementType, 'elementType')
		const breakdownEntry = breakdownLookup.get(String(pick.element))
		const breakdownStats = breakdownEntry?.stats ?? []
		const aggregatedBreakdown = aggregateBreakdownStats(breakdownStats)

		const getValue = (identifier: string) =>
			aggregatedBreakdown.get(identifier)?.value
		const getPoints = (identifier: string) =>
			aggregatedBreakdown.get(identifier)?.points

		const minutes = getValue('minutes') ?? pick.minutes
		const goalsScored = getValue('goals_scored') ?? pick.goalsScored
		const assists = getValue('assists') ?? pick.assists
		const cleanSheets = getValue('clean_sheets') ?? 0
		const saves = getValue('saves') ?? 0
		const penaltiesSaved = getValue('penalties_saved') ?? 0
		const yellowCards = getValue('yellow_cards') ?? 0
		const redCards = getValue('red_cards') ?? 0
		const bonusPoints = getPoints('bonus') ?? pick.bonus
		const totalPoints =
			getPoints('total') ?? getPoints('total_points') ?? pick.totalPoints

		let playingStatus: Player['playingStatus']
		if (minutes >= 90) {
			playingStatus = 'FINISHED'
		} else if (minutes > 0) {
			playingStatus = 'PLAYING'
		} else if (pick.starts) {
			playingStatus = 'PLAYING'
		} else {
			playingStatus = 'NOT_STARTED'
		}

		return {
			id: String(pick.element),
			name: pick.webName,
			team: breakdownEntry?.teamShortName ?? '',
			teamShort: breakdownEntry?.teamShortName ?? '',
			position,
			playingStatus,
			isBench,
			isBenchBoostActive: benchBoostActive,
			breakdownStats,
			stats: {
				minutes,
				goals: goalsScored,
				expectedGoals: pick.expectedGoals ?? 0,
				expectedAssists: pick.expectedAssists ?? 0,
				expectedGoalInvolvements: pick.expectedGoalInvolvements ?? 0,
				expectedGoalsConceded: pick.expectedGoalsConceded ?? 0,
				assists,
				saves,
				savePenalty: penaltiesSaved,
				cleanSheets,
				yellowCards,
				redCards,
				points: totalPoints,
				bonusPoints: bonusPoints ?? 0
			},
			isCaptain,
			isViceCaptain: false
		}
	})
}

function LivePointsAutoRefreshCountdown({
	enabled,
	onRefresh
}: {
	enabled: boolean
	onRefresh: () => Promise<void>
}) {
	const [countdown, setCountdown] = useState<number | null>(null)
	const refreshInFlightRef = useRef(false)
	const onRefreshRef = useRef(onRefresh)

	useEffect(() => {
		onRefreshRef.current = onRefresh
	}, [onRefresh])

	useEffect(() => {
		if (!enabled) {
			const resetTimer = window.setTimeout(() => setCountdown(null), 0)
			return () => window.clearTimeout(resetTimer)
		}

		const initialTimer = window.setTimeout(
			() => setCountdown(LIVE_POINTS_AUTO_REFRESH_SECONDS),
			0
		)

		const intervalId = window.setInterval(() => {
			setCountdown(previous => {
				if (previous === null || previous <= 1) {
					if (!refreshInFlightRef.current) {
						refreshInFlightRef.current = true
						void onRefreshRef.current().finally(() => {
							refreshInFlightRef.current = false
						})
					}
					return LIVE_POINTS_AUTO_REFRESH_SECONDS
				}

				return previous - 1
			})
		}, 1000)

		return () => {
			window.clearTimeout(initialTimer)
			window.clearInterval(intervalId)
		}
	}, [enabled])

	if (!enabled || countdown === null) {
		return null
	}

	return (
		<span className="text-xs text-muted-foreground">
			Next refresh in {countdown}s
		</span>
	)
}

export default function LivePoints() {
	const { currentEventId, entryId: sharedEntryId } = useEvent()
	const { data: sessionData } = useSession()
	const initialEntryId = sharedEntryId ?? 0
	const sessionEntryId = sessionData?.user?.fplEntryId ?? 0

	const [currentGameweek, setCurrentGameweek] = useState<number | undefined>(
		currentEventId ?? undefined
	)
	const [selectedGameweek, setSelectedGameweek] = useState<number | undefined>(
		currentEventId ?? undefined
	)
	const [isLoading, setIsLoading] = useState(initialEntryId > 0)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [error, setError] = useState<string | undefined>(undefined)
	const [liveData, setLiveData] = useState<LiveCalcData | undefined>(undefined)
	const [startingPlayers, setStartingPlayers] = useState<Player[]>([])
	const [benchPlayers, setBenchPlayers] = useState<Player[]>([])
	const [entryTransfers, setEntryTransfers] = useState<TransferPair[]>([])
	const [entryIdInput, setEntryIdInput] = useState(
		initialEntryId ? String(initialEntryId) : ''
	)
	const [activeEntryId, setActiveEntryId] = useState(initialEntryId)
	const requestIdRef = useRef(0)
	const hasLoadedLiveDataRef = useRef(false)

	useEffect(() => {
		if (activeEntryId || !sessionEntryId) {
			return
		}

		const loadTimer = window.setTimeout(() => {
			setEntryIdInput(String(sessionEntryId))
			setActiveEntryId(sessionEntryId)
			setIsLoading(true)
		}, 0)

		return () => window.clearTimeout(loadTimer)
	}, [activeEntryId, sessionEntryId])

	const enrichLivePointBreakdowns = useCallback(
		async (requestId: number, eventId: number, live: LiveCalcData) => {
			const uniqueElementIds = Array.from(
				new Set(live.pickList.map(pick => pick.element))
			)
			const explainBatchQuery = buildEventLiveExplainBatchQuery(uniqueElementIds)
			if (!explainBatchQuery) return

			try {
				const explainBatchResponse = await executeQuery<
					Record<string, EventLiveExplainResponse['eventLiveExplain'] | null>
				>(explainBatchQuery, { eventId }, { cache: 'no-store' })

				if (requestId !== requestIdRef.current) {
					return
				}

				const breakdownLookup: BreakdownLookup = new Map()
				Object.values(explainBatchResponse).forEach(playerExplain => {
					if (!playerExplain) {
						return
					}

					const flattenedStats = (playerExplain.breakdown ?? []).flatMap(
						entry => entry.stats
					)

					breakdownLookup.set(String(playerExplain.player.id), {
						teamShortName: playerExplain.player.team?.shortName ?? '',
						stats: rollupBreakdownStats(flattenedStats)
					})
				})

				const enrichedPlayers = mapLiveDataToPlayers(live, breakdownLookup)
				setStartingPlayers(enrichedPlayers.filter(p => !p.isBench))
				setBenchPlayers(enrichedPlayers.filter(p => p.isBench))
			} catch (explainError) {
				console.warn('Failed to fetch explain stats batch:', explainError)
			}
		},
		[]
	)

	const fetchLivePointsForGameweek = useCallback(
		async (eventId: number) => {
			if (!activeEntryId) return
			const requestId = requestIdRef.current + 1
			requestIdRef.current = requestId

			const initialLoad = !hasLoadedLiveDataRef.current
			if (initialLoad) {
				setIsLoading(true)
			} else {
				setIsRefreshing(true)
			}
			setError(undefined)

			try {
				const liveResponse = await executeQuery<LiveCalcDataResponse>(
					GET_LIVE_POINTS,
					{
						eventId,
						entryId: activeEntryId
					},
					{ cache: 'no-store' }
				)

				const live = liveResponse.calcLivePointsByEntry

				if (requestId !== requestIdRef.current) {
					return
				}

				const allPlayers = mapLiveDataToPlayers(live, new Map())
				hasLoadedLiveDataRef.current = true
				setLiveData(live)
				setStartingPlayers(allPlayers.filter(p => !p.isBench))
				setBenchPlayers(allPlayers.filter(p => p.isBench))
				setEntryTransfers([])
				setIsLoading(false)
				setIsRefreshing(false)
				void enrichLivePointBreakdowns(requestId, eventId, live)
			} catch (err) {
				if (requestId !== requestIdRef.current) {
					return
				}
				console.error('Failed to fetch live points:', err)
				const message =
					err instanceof Error
						? err.message
						: 'Unknown error while loading live points'
				setError(message)
			} finally {
				if (requestId === requestIdRef.current) {
					setIsLoading(false)
					setIsRefreshing(false)
				}
			}
		},
		[activeEntryId, enrichLivePointBreakdowns]
	)

	const handleEntrySubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const nextEntryId = Number(entryIdInput)

		if (!Number.isInteger(nextEntryId) || nextEntryId <= 0) {
			setError('Enter a valid FPL entry ID.')
			return
		}

		requestIdRef.current += 1
		hasLoadedLiveDataRef.current = false
		setActiveEntryId(nextEntryId)
		setLiveData(undefined)
		setStartingPlayers([])
		setBenchPlayers([])
		setEntryTransfers([])
		setError(undefined)
		setIsLoading(true)
	}

	useEffect(() => {
		if (!activeEntryId) {
			return
		}
		let cancelled = false
		const loadTimer = window.setTimeout(() => {
			if (cancelled) return
			if (selectedGameweek !== undefined) {
				void fetchLivePointsForGameweek(selectedGameweek)
			} else {
				setError('No current gameweek found')
				setIsLoading(false)
			}
		}, 0)

		return () => {
			cancelled = true
			window.clearTimeout(loadTimer)
		}
	// selectedGameweek and entryId are stable initializer values from mount
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeEntryId])

	const entrySearch = (
		<form
			onSubmit={handleEntrySubmit}
			className="flex flex-col gap-3 sm:flex-row"
		>
			<Input
				type="number"
				inputMode="numeric"
				min={1}
				value={entryIdInput}
				onChange={event => setEntryIdInput(event.target.value)}
				placeholder="Enter FPL entry ID"
				aria-label="FPL entry ID"
				className="sm:max-w-xs"
			/>
			<Button type="submit">View Live Points</Button>
		</form>
	)

	if (!activeEntryId && !isLoading) {
		return (
			<RootLayout>
				<div className="container max-w-4xl mx-auto px-4 py-8">
					<h1 className="text-3xl font-bold mb-6">Live Points</h1>
					<div className="bg-card rounded-lg shadow-sm p-6 sm:p-8">
						<p className="text-muted-foreground mb-4">
							Enter an FPL entry ID to view live points.
						</p>
						{entrySearch}
						{error && (
							<p className="mt-3 text-sm text-destructive">{error}</p>
						)}
					</div>
				</div>
			</RootLayout>
		)
	}

	if (isLoading && !liveData) {
		return (
			<RootLayout>
				<div className="container max-w-4xl mx-auto px-4 py-8">
					<h1 className="text-3xl font-bold mb-6">Live Points</h1>
					<div className="mb-4 rounded-lg bg-card p-4 shadow-sm">
						{entrySearch}
					</div>
					<div className="mb-6">
						{selectedGameweek !== undefined ? (
							<GameweekSelector
								onGameweekChange={setSelectedGameweek}
								currentGameweek={currentGameweek}
								selectedGameweek={selectedGameweek}
								disabled
							/>
						) : (
							<Skeleton className="h-16 w-full rounded-lg" />
						)}
						<p className="mt-2 text-xs text-muted-foreground">
							Loading live points for entry {activeEntryId}...
						</p>
					</div>

					{/* Team Stats Skeleton */}
					<div className="bg-card rounded-lg shadow-sm overflow-hidden mb-8">
						<div className="p-6">
							<Skeleton className="h-8 w-48 mb-2" />
							<Skeleton className="h-5 w-32 mb-8" />
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
								{[1, 2, 3, 4].map(i => (
									<div
										key={i}
										className="bg-primary/5 rounded-lg p-4"
									>
										<Skeleton className="h-5 w-20 mb-3" />
										<Skeleton className="h-8 w-16" />
									</div>
								))}
							</div>
							<div className="mt-6 pt-6 border-t">
								<Skeleton className="h-5 w-24 mb-3" />
								<div className="flex gap-2">
									<Skeleton className="h-6 w-16 rounded-full" />
									<Skeleton className="h-6 w-20 rounded-full" />
								</div>
							</div>
						</div>
					</div>

					{/* Tabs Skeleton */}
					<div className="bg-card rounded-lg p-4 mb-6 shadow-sm">
						<div className="grid grid-cols-2 gap-2 sm:gap-4">
							<Skeleton className="h-10 w-full rounded-md" />
							<Skeleton className="h-10 w-full rounded-md" />
						</div>
					</div>

					{/* Player List Skeleton */}
					<div className="bg-card rounded-lg shadow-sm overflow-hidden mb-8">
						{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
							<div
								key={i}
								className="p-4 border-b last:border-b-0"
							>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-4 flex-1">
										<Skeleton className="h-4 w-12" />
										<Skeleton className="h-4 w-20" />
										<Skeleton className="h-4 w-32" />
									</div>
									<div className="flex items-center gap-6">
										<div className="hidden md:flex gap-4">
											{[1, 2, 3, 4, 5, 6, 7].map(j => (
												<Skeleton
													key={j}
													className="h-12 w-10"
												/>
											))}
										</div>
										<Skeleton className="h-12 w-16" />
									</div>
								</div>
							</div>
						))}
					</div>

					{/* Transfers Skeleton */}
					<div className="bg-card rounded-lg shadow-sm overflow-hidden">
						<div className="p-4 border-b">
							<Skeleton className="h-5 w-24" />
						</div>
						<div className="p-8 text-center">
							<Skeleton className="h-4 w-48 mx-auto" />
						</div>
					</div>
				</div>
			</RootLayout>
		)
	}

	if (!liveData) {
		return (
			<RootLayout>
				<div className="container max-w-4xl mx-auto px-4 py-8">
					<div className="mb-6 rounded-lg bg-card p-4 shadow-sm">
						{entrySearch}
					</div>
					<div className="mb-6">
						<GameweekSelector
							onGameweekChange={(gw) => {
								setSelectedGameweek(gw)
								void fetchLivePointsForGameweek(gw)
							}}
							currentGameweek={currentGameweek}
							selectedGameweek={selectedGameweek}
						/>
					</div>
					<div className="text-center text-sm text-destructive">
						{error ?? 'No live data available for this team.'}
					</div>
				</div>
			</RootLayout>
		)
	}

	const shouldAutoRefresh =
		selectedGameweek !== undefined &&
		currentGameweek !== undefined &&
		selectedGameweek === currentGameweek

	const startingPicks = liveData.pickList.filter(p => p.position <= 11)
	const playedCount = startingPicks.filter(p => (p.minutes ?? 0) > 0).length

	const derivedTeamStats = {
		teamName: liveData.entryName ?? `Entry ${liveData.entry}`,
		playerName: liveData.playerName ?? '',
		livePoints: liveData.livePoints,
		transferCost: liveData.transferCost ?? 0,
		captainName: liveData.captainName,
		liveTotalPoints: liveData.liveTotalPoints,
		played: `${playedCount}/${startingPicks.length}`,
		chips: {
			bench: !!liveData.chip && liveData.chip.toLowerCase().includes('bench'),
			triple:
				!!liveData.chip &&
				(liveData.chip.toLowerCase().includes('3x') ||
					liveData.chip.toLowerCase().includes('triple')),
			wildcard:
				!!liveData.chip && liveData.chip.toLowerCase().includes('wildcard')
		}
	}

	return (
		<RootLayout>
			<div className="container max-w-4xl mx-auto px-4 py-8 relative">
				{isRefreshing && (
					<div className="absolute inset-0 z-10 flex items-start justify-end pointer-events-none">
						<div className="mt-2 flex items-center gap-2 rounded-full bg-card/90 px-3 py-2 shadow-sm text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin text-primary" />
							<span>Loading gameweek…</span>
						</div>
					</div>
				)}
				<div className="mb-6">
					<div className="mb-4 rounded-lg bg-card p-4 shadow-sm">
						{entrySearch}
					</div>
					<GameweekSelector
						onGameweekChange={(gw) => {
							setSelectedGameweek(gw)
							void fetchLivePointsForGameweek(gw)
						}}
						currentGameweek={currentGameweek}
						selectedGameweek={selectedGameweek}
						disabled={isLoading || isRefreshing}
					/>
						<div className="mt-2 flex items-center justify-between">
							<p className="text-xs text-muted-foreground">
								{shouldAutoRefresh
									? 'Auto refreshes every minute for the current gameweek.'
									: 'Auto refresh paused for past or unavailable gameweeks.'}
							</p>
							<div className="flex items-center gap-3">
								<LivePointsAutoRefreshCountdown
									enabled={shouldAutoRefresh}
								onRefresh={async () => {
									if (selectedGameweek !== undefined) {
										await fetchLivePointsForGameweek(selectedGameweek)
									}
								}}
							/>
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									selectedGameweek !== undefined &&
									void fetchLivePointsForGameweek(selectedGameweek)
								}
								disabled={
									isLoading || isRefreshing || selectedGameweek === undefined
								}
								className="h-8"
							>
								<RefreshCw
									className={`mr-2 h-3.5 w-3.5 ${
										isRefreshing ? 'animate-spin' : ''
									}`}
								/>
								Refresh
							</Button>
						</div>
					</div>
				</div>

				<div className={isRefreshing ? 'opacity-75 transition-opacity' : ''}>
					<TeamStats stats={derivedTeamStats} />
				</div>

				<Tabs
					defaultValue="list"
					className="w-full"
				>
					<div className="bg-card rounded-lg p-4 mb-6 shadow-sm">
						<TabsList className="w-full grid grid-cols-2 gap-2 sm:gap-4">
							<TabsTrigger
								value="list"
								className="w-full"
							>
								List View
							</TabsTrigger>
							<TabsTrigger
								value="pitch"
								className="w-full"
							>
								Pitch View
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="list">
						<div
							className={`bg-card rounded-lg shadow-sm overflow-hidden ${
								isRefreshing ? 'opacity-75 transition-opacity' : ''
							}`}
						>
							<PlayerList
								startingPlayers={startingPlayers}
								benchPlayers={benchPlayers}
							/>
						</div>
					</TabsContent>

					<TabsContent value="pitch">
						<div className="bg-card rounded-lg shadow-md p-8">
							<div className="text-center text-muted-foreground">
								<h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
								<p>The pitch view feature is currently under development.</p>
							</div>
						</div>
					</TabsContent>
				</Tabs>

				<div className="mt-8">
					<TransferSection transfers={entryTransfers} />
				</div>
			</div>
		</RootLayout>
	)
}
