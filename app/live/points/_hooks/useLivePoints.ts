'use client'

import { usePageActive } from '@/hooks/use-page-active'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_LIVE_POINTS,
	type EventLiveExplainResponse,
	type LiveCalcData,
	type LiveCalcDataResponse,
} from '@/lib/graphql/operations/live'
import type { Player } from '@/types/player'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
	buildEventLiveExplainBatchQuery,
	type BreakdownLookup,
	mapLiveDataToPlayers,
	rollupBreakdownStats,
} from '../_lib/live-points-model'

interface UseLivePointsOptions {
	initialEntryId: number
	initialEventId: number
	initialLiveData?: LiveCalcData
}

export function useLivePoints({ initialEntryId, initialEventId, initialLiveData }: UseLivePointsOptions) {
	const isPageActive = usePageActive()
	const seededEventId = initialLiveData?.event ?? initialEventId
	const [selectedGameweek, setSelectedGameweek] = useState<number | undefined>(seededEventId)
	const [isLoading, setIsLoading] = useState(initialEntryId > 0 && !initialLiveData)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [error, setError] = useState<string>()
	const [liveData, setLiveData] = useState<LiveCalcData | undefined>(initialLiveData)
	const [startingPlayers, setStartingPlayers] = useState<Player[]>(() =>
		initialLiveData ? mapLiveDataToPlayers(initialLiveData, new Map()).filter((player) => !player.isBench) : [],
	)
	const [benchPlayers, setBenchPlayers] = useState<Player[]>(() =>
		initialLiveData ? mapLiveDataToPlayers(initialLiveData, new Map()).filter((player) => player.isBench) : [],
	)
	const [entryIdInput, setEntryIdInput] = useState(initialEntryId ? String(initialEntryId) : '')
	const [activeEntryId, setActiveEntryId] = useState(initialEntryId)
	const requestIdRef = useRef(0)
	const hasLoadedLiveDataRef = useRef(Boolean(initialLiveData))
	const skipInitialFetchRef = useRef(Boolean(initialLiveData))

	const enrichLivePointBreakdowns = useCallback(
		async (requestId: number, eventId: number, live: LiveCalcData) => {
			const uniqueElementIds = Array.from(new Set(live.pickList.map((pick) => pick.element)))
			const query = buildEventLiveExplainBatchQuery(uniqueElementIds)
			if (!query) return

			try {
				const response = await executeQuery<
					Record<string, EventLiveExplainResponse['eventLiveExplain'] | null>
				>(query, { eventId }, { cache: 'no-store' })

				if (requestId !== requestIdRef.current) return

				const breakdownLookup: BreakdownLookup = new Map()
				for (const playerExplain of Object.values(response)) {
					if (!playerExplain) continue
					const flattenedStats = (playerExplain.breakdown ?? []).flatMap((entry) => entry.stats)
					breakdownLookup.set(String(playerExplain.player.id), {
						teamShortName: playerExplain.player.team?.shortName ?? '',
						stats: rollupBreakdownStats(flattenedStats),
					})
				}

				const enrichedPlayers = mapLiveDataToPlayers(live, breakdownLookup)
				setStartingPlayers(enrichedPlayers.filter((player) => !player.isBench))
				setBenchPlayers(enrichedPlayers.filter((player) => player.isBench))
			} catch (explainError) {
				console.warn('Failed to fetch explain stats batch:', explainError)
			}
		},
		[],
	)

	const fetchLivePointsForGameweek = useCallback(
		async (eventId: number) => {
			if (!activeEntryId) return
			const requestId = requestIdRef.current + 1
			requestIdRef.current = requestId
			const initialLoad = !hasLoadedLiveDataRef.current
			if (initialLoad) setIsLoading(true)
			else setIsRefreshing(true)
			setError(undefined)

			try {
				const liveResponse = await executeQuery<LiveCalcDataResponse>(
					GET_LIVE_POINTS,
					{ eventId, entryId: activeEntryId },
					{ cache: 'no-store' },
				)
				const live = liveResponse.calcLivePointsByEntry
				if (requestId !== requestIdRef.current) return

				const allPlayers = mapLiveDataToPlayers(live, new Map())
				hasLoadedLiveDataRef.current = true
				setLiveData(live)
				setStartingPlayers(allPlayers.filter((player) => !player.isBench))
				setBenchPlayers(allPlayers.filter((player) => player.isBench))
				void enrichLivePointBreakdowns(requestId, eventId, live)
			} catch (fetchError) {
				if (requestId !== requestIdRef.current) return
				console.error('Failed to fetch live points:', fetchError)
				setError(fetchError instanceof Error ? fetchError.message : 'Unknown error while loading live points')
			} finally {
				if (requestId === requestIdRef.current) {
					setIsLoading(false)
					setIsRefreshing(false)
				}
			}
		},
		[activeEntryId, enrichLivePointBreakdowns],
	)

	const submitEntry = useCallback(() => {
		const nextEntryId = Number(entryIdInput)
		if (!Number.isInteger(nextEntryId) || nextEntryId <= 0) {
			setError('Enter a valid FPL entry ID.')
			return false
		}

		requestIdRef.current += 1
		hasLoadedLiveDataRef.current = false
		setActiveEntryId(nextEntryId)
		setLiveData(undefined)
		setStartingPlayers([])
		setBenchPlayers([])
		setError(undefined)
		setIsLoading(true)
		return true
	}, [entryIdInput])

	const changeGameweek = useCallback(
		(gameweek: number) => {
			setSelectedGameweek(gameweek)
			void fetchLivePointsForGameweek(gameweek)
		},
		[fetchLivePointsForGameweek],
	)

	const refresh = useCallback(async () => {
		if (selectedGameweek !== undefined) await fetchLivePointsForGameweek(selectedGameweek)
	}, [fetchLivePointsForGameweek, selectedGameweek])

	useEffect(() => {
		if (!activeEntryId) return
		if (skipInitialFetchRef.current) {
			skipInitialFetchRef.current = false
			if (initialLiveData) {
				const requestId = requestIdRef.current + 1
				requestIdRef.current = requestId
				void enrichLivePointBreakdowns(requestId, initialLiveData.event, initialLiveData)
			}
			return
		}

		let cancelled = false
		const loadTimer = window.setTimeout(() => {
			if (cancelled) return
			if (selectedGameweek !== undefined) void fetchLivePointsForGameweek(selectedGameweek)
			else {
				setError('No current gameweek found')
				setIsLoading(false)
			}
		}, 0)

		return () => {
			cancelled = true
			window.clearTimeout(loadTimer)
		}
		// Loading a new entry is the trigger; the selected gameweek is read at that point.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeEntryId])

	const shouldAutoRefresh =
		selectedGameweek !== undefined && selectedGameweek === initialEventId

	return {
		activeEntryId,
		benchPlayers,
		changeGameweek,
		currentGameweek: initialEventId,
		entryIdInput,
		error,
		isLoading,
		isPageActive,
		isRefreshing,
		liveData,
		refresh,
		selectedGameweek,
		setEntryIdInput,
		shouldAutoRefresh,
		startingPlayers,
		submitEntry,
	}
}
