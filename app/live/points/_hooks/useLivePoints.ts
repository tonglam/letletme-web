'use client'

import { usePageActive } from '@/hooks/use-page-active'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_LIVE_POINTS,
	GET_LIVE_SNAPSHOT,
	type EventLiveExplainResponse,
	type LiveCalcData,
	type LiveCalcDataResponse,
	type LiveSnapshotResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import {
	liveSnapshotNeedsRefresh,
	shouldPollLiveSnapshot,
	shouldRefreshLiveExplain
} from '@/lib/live-refresh'
import type { Player } from '@/types/player'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
	breakdownLookupForRequest,
	buildEventLiveExplainBatchQuery,
	type BreakdownLookup,
	type CachedBreakdownLookup,
	mapLiveDataToPlayers,
	rollupBreakdownStats
} from '../_lib/live-points-model'

interface UseLivePointsOptions {
	initialEntryId: number
	initialEventId: number
	initialLiveData?: LiveCalcData
	initialSnapshot?: LiveSnapshotStatus | null
}

export function useLivePoints({
	initialEntryId,
	initialEventId,
	initialLiveData,
	initialSnapshot
}: UseLivePointsOptions) {
	const t = useTranslations('LivePoints')
	const isPageActive = usePageActive()
	const seededEventId = initialLiveData?.event ?? initialEventId
	const [selectedGameweek, setSelectedGameweek] = useState<number | undefined>(
		seededEventId
	)
	const [isLoading, setIsLoading] = useState(
		initialEntryId > 0 && !initialLiveData
	)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [error, setError] = useState<string>()
	const [liveData, setLiveData] = useState<LiveCalcData | undefined>(
		initialLiveData
	)
	const [snapshot, setSnapshot] = useState<LiveSnapshotStatus | null>(
		initialSnapshot ?? null
	)
	const snapshotRef = useRef<LiveSnapshotStatus | null>(initialSnapshot ?? null)
	const [startingPlayers, setStartingPlayers] = useState<Player[]>(() =>
		initialLiveData
			? mapLiveDataToPlayers(initialLiveData, new Map()).filter(
					player => !player.isBench
				)
			: []
	)
	const [benchPlayers, setBenchPlayers] = useState<Player[]>(() =>
		initialLiveData
			? mapLiveDataToPlayers(initialLiveData, new Map()).filter(
					player => player.isBench
				)
			: []
	)
	const [entryIdInput, setEntryIdInput] = useState(
		initialEntryId ? String(initialEntryId) : ''
	)
	const [activeEntryId, setActiveEntryId] = useState(initialEntryId)
	const requestIdRef = useRef(0)
	const hasLoadedLiveDataRef = useRef(Boolean(initialLiveData))
	const skipInitialFetchRef = useRef(Boolean(initialLiveData))
	const lastExplainAttemptAtRef = useRef(0)
	const breakdownCacheRef = useRef<CachedBreakdownLookup | null>(null)
	const inFlightRequestRef = useRef<{
		key: string
		promise: Promise<void>
	} | null>(null)
	const acceptSnapshot = useCallback((next: LiveSnapshotStatus | null) => {
		snapshotRef.current = next
		setSnapshot(next)
	}, [])

	const enrichLivePointBreakdowns = useCallback(
		async (
			requestId: number,
			eventId: number,
			live: LiveCalcData,
			requestKey: string
		) => {
			const now = Date.now()
			if (!shouldRefreshLiveExplain(lastExplainAttemptAtRef.current, now))
				return
			lastExplainAttemptAtRef.current = now

			const uniqueElementIds = Array.from(
				new Set(live.pickList.map(pick => pick.element))
			)
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
					const flattenedStats = (playerExplain.breakdown ?? []).flatMap(
						entry => entry.stats
					)
					breakdownLookup.set(String(playerExplain.player.id), {
						teamShortName: playerExplain.player.team?.shortName ?? '',
						stats: rollupBreakdownStats(flattenedStats)
					})
				}

				breakdownCacheRef.current = { requestKey, lookup: breakdownLookup }
				const enrichedPlayers = mapLiveDataToPlayers(live, breakdownLookup)
				setStartingPlayers(enrichedPlayers.filter(player => !player.isBench))
				setBenchPlayers(enrichedPlayers.filter(player => player.isBench))
			} catch (explainError) {
				console.warn('Failed to fetch explain stats batch:', explainError)
			}
		},
		[]
	)

	const fetchLivePointsForGameweek = useCallback(
		(eventId: number): Promise<void> => {
			if (!activeEntryId) return Promise.resolve()
			const requestKey = `${activeEntryId}:${eventId}`
			if (inFlightRequestRef.current?.key === requestKey) {
				return inFlightRequestRef.current.promise
			}

			const requestId = requestIdRef.current + 1
			requestIdRef.current = requestId
			const request = (async () => {
				const initialLoad = !hasLoadedLiveDataRef.current
				if (initialLoad) setIsLoading(true)
				else setIsRefreshing(true)
				setError(undefined)

				try {
					const liveResponse = await executeQuery<LiveCalcDataResponse>(
						GET_LIVE_POINTS,
						{ eventId, entryId: activeEntryId },
						{ cache: 'no-store' }
					)
					const live = liveResponse.calcLivePointsByEntry
					if (requestId !== requestIdRef.current) return

					const allPlayers = mapLiveDataToPlayers(
						live,
						breakdownLookupForRequest(breakdownCacheRef.current, requestKey)
					)
					hasLoadedLiveDataRef.current = true
					setLiveData(live)
					acceptSnapshot(liveResponse.liveSnapshot)
					setStartingPlayers(allPlayers.filter(player => !player.isBench))
					setBenchPlayers(allPlayers.filter(player => player.isBench))
					void enrichLivePointBreakdowns(requestId, eventId, live, requestKey)
				} catch (fetchError) {
					if (requestId !== requestIdRef.current) return
					console.error('Failed to fetch live points:', fetchError)
					setError(t('loadFailed'))
				} finally {
					if (requestId === requestIdRef.current) {
						setIsLoading(false)
						setIsRefreshing(false)
					}
				}
			})()
			inFlightRequestRef.current = { key: requestKey, promise: request }
			void request.finally(() => {
				if (inFlightRequestRef.current?.promise === request) {
					inFlightRequestRef.current = null
				}
			})
			return request
		},
		[acceptSnapshot, activeEntryId, enrichLivePointBreakdowns, t]
	)

	const submitEntry = useCallback(() => {
		const nextEntryId = Number(entryIdInput)
		if (!Number.isInteger(nextEntryId) || nextEntryId <= 0) {
			setError(t('invalidEntry'))
			return false
		}

		requestIdRef.current += 1
		hasLoadedLiveDataRef.current = false
		setActiveEntryId(nextEntryId)
		setLiveData(undefined)
		setStartingPlayers([])
		setBenchPlayers([])
		acceptSnapshot(null)
		lastExplainAttemptAtRef.current = 0
		breakdownCacheRef.current = null
		setError(undefined)
		setIsLoading(true)
		return true
	}, [acceptSnapshot, entryIdInput, t])

	const changeGameweek = useCallback(
		(gameweek: number) => {
			lastExplainAttemptAtRef.current = 0
			setSelectedGameweek(gameweek)
			void fetchLivePointsForGameweek(gameweek)
		},
		[fetchLivePointsForGameweek]
	)

	const refresh = useCallback(async () => {
		if (selectedGameweek !== undefined)
			await fetchLivePointsForGameweek(selectedGameweek)
	}, [fetchLivePointsForGameweek, selectedGameweek])

	const autoRefresh = useCallback(async () => {
		if (selectedGameweek === undefined) return
		const requestId = requestIdRef.current
		try {
			const probe = await executeQuery<LiveSnapshotResponse>(
				GET_LIVE_SNAPSHOT,
				{ eventId: selectedGameweek },
				{ cache: 'no-store' }
			)
			if (requestId !== requestIdRef.current) return
			if (!liveSnapshotNeedsRefresh(snapshotRef.current, probe.liveSnapshot)) {
				acceptSnapshot(probe.liveSnapshot)
				setError(undefined)
				return
			}
			await fetchLivePointsForGameweek(selectedGameweek)
		} catch (probeError) {
			if (requestId !== requestIdRef.current) return
			console.error('Failed to check live points freshness:', probeError)
			setError(t('loadFailed'))
		}
	}, [acceptSnapshot, fetchLivePointsForGameweek, selectedGameweek, t])

	useEffect(() => {
		if (!activeEntryId) return
		if (skipInitialFetchRef.current) {
			skipInitialFetchRef.current = false
			if (initialLiveData) {
				const requestId = requestIdRef.current + 1
				requestIdRef.current = requestId
				void enrichLivePointBreakdowns(
					requestId,
					initialLiveData.event,
					initialLiveData,
					`${activeEntryId}:${initialLiveData.event}`
				)
			}
			return
		}

		let cancelled = false
		const loadTimer = window.setTimeout(() => {
			if (cancelled) return
			if (selectedGameweek !== undefined)
				void fetchLivePointsForGameweek(selectedGameweek)
			else {
				setError(t('noCurrentGameweek'))
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

	const shouldAutoRefresh = shouldPollLiveSnapshot({
		isPageActive: true,
		currentEventId: initialEventId,
		selectedEventId: selectedGameweek,
		snapshot
	})

	return {
		activeEntryId,
		autoRefresh,
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
		submitEntry
	}
}
