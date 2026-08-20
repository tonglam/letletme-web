'use client'

import { usePageActive } from '@/hooks/use-page-active'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_EVENT_LIVE_EXPLAINS,
	GET_LIVE_POINTS,
	GET_LIVE_CONTEXT,
	type LiveContextResponse,
	type EventLiveExplainsResponse,
	type LiveCalcData,
	type LiveCalcDataResponse,
	type LiveSnapshotResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import {
	LIVE_EXPLAIN_REFRESH_INTERVAL_MS,
	liveSnapshotNeedsRefresh,
	liveContextToSnapshot,
	shouldPollLiveSnapshot,
	shouldRefreshLiveExplain
} from '@/lib/live-refresh'
import type { Player } from '@/types/player'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
	breakdownLookupForRequest,
	type BreakdownLookup,
	type CachedBreakdownLookup,
	type LiveDataForRequest,
	mapLiveDataToPlayers,
	normalizeLiveExplainElementIds,
	rollupBreakdownStats,
	selectLiveDataForExplainResponse
} from '../_lib/live-points-model'

interface UseLivePointsOptions {
	initialEntryId: number
	initialEventId: number
	initialSelectedGameweek?: number
	initialLiveData?: LiveCalcData
	initialSnapshot?: LiveSnapshotStatus | null
}

export function useLivePoints({
	initialEntryId,
	initialEventId,
	initialSelectedGameweek,
	initialLiveData,
	initialSnapshot,
}: UseLivePointsOptions) {
	const t = useTranslations('LivePoints')
	const isPageActive = usePageActive()
	const seededEventId = initialLiveData?.event ?? initialEventId
	const [selectedGameweek, setSelectedGameweek] = useState<number | undefined>(
		initialSelectedGameweek ?? seededEventId
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
	const currentRequestKeyRef = useRef<string | null>(
		initialEntryId > 0 ? `${initialEntryId}:${seededEventId}` : null
	)
	const latestLiveDataRef = useRef<LiveDataForRequest | null>(
		initialLiveData
			? {
					requestKey: `${initialEntryId}:${initialLiveData.event}`,
					live: initialLiveData
				}
			: null
	)
	const inFlightRequestRef = useRef<{
		key: string
		promise: Promise<void>
	} | null>(null)
	const lastSeedKeyRef = useRef<string | null>(null)
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

			const elementIds = normalizeLiveExplainElementIds(
				live.pickList.map(pick => pick.element)
			)
			if (elementIds.length === 0) return

			try {
				const response = await executeQuery<EventLiveExplainsResponse>(
					GET_EVENT_LIVE_EXPLAINS,
					{ eventId, elementIds },
					{ cache: 'no-store' }
				)

				const targetLive = selectLiveDataForExplainResponse({
					responseRequestId: requestId,
					currentRequestId: requestIdRef.current,
					requestKey,
					currentRequestKey: currentRequestKeyRef.current,
					responseLive: live,
					currentLive: latestLiveDataRef.current
				})
				if (!targetLive) return

				const breakdownLookup: BreakdownLookup = new Map()
				for (const playerExplain of response.eventLiveExplains) {
					const flattenedStats =
						playerExplain.contributions ??
						(playerExplain.breakdown ?? []).flatMap(entry => entry.stats)
					breakdownLookup.set(String(playerExplain.elementId), {
						stats: rollupBreakdownStats(flattenedStats),
						explanationStats: playerExplain.stats
					})
				}

				breakdownCacheRef.current = { requestKey, lookup: breakdownLookup }
				const enrichedPlayers = mapLiveDataToPlayers(
					targetLive,
					breakdownLookup
				)
				setStartingPlayers(enrichedPlayers.filter(player => !player.isBench))
				setBenchPlayers(enrichedPlayers.filter(player => player.isBench))
			} catch (explainError) {
				if (lastExplainAttemptAtRef.current === now) {
					lastExplainAttemptAtRef.current = 0
				}
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
			currentRequestKeyRef.current = requestKey
			const request = (async () => {
				const switchingGameweek =
					hasLoadedLiveDataRef.current &&
					latestLiveDataRef.current?.requestKey !== requestKey
				const initialLoad = !hasLoadedLiveDataRef.current
				// Clear previous GW paint when switching so failures never show stale squad.
				if (switchingGameweek) {
					hasLoadedLiveDataRef.current = false
					latestLiveDataRef.current = null
					breakdownCacheRef.current = null
					setLiveData(undefined)
					setStartingPlayers([])
					setBenchPlayers([])
					acceptSnapshot(null)
					setIsLoading(true)
				} else if (initialLoad) {
					setIsLoading(true)
				} else {
					setIsRefreshing(true)
				}
				setError(undefined)

				try {
					const liveResponse = await executeQuery<LiveCalcDataResponse>(
						GET_LIVE_POINTS,
						{ eventId, entryId: activeEntryId },
						{ cache: 'no-store' },
					)
					const live = liveResponse.calcLivePointsByEntry
					if (requestId !== requestIdRef.current) return

					const allPlayers = mapLiveDataToPlayers(
						live,
						breakdownLookupForRequest(breakdownCacheRef.current, requestKey),
					)
					hasLoadedLiveDataRef.current = true
					latestLiveDataRef.current = { requestKey, live }
					setLiveData(live)
					acceptSnapshot(liveResponse.liveSnapshot)
					setStartingPlayers(allPlayers.filter(player => !player.isBench))
					setBenchPlayers(allPlayers.filter(player => player.isBench))
					void enrichLivePointBreakdowns(requestId, eventId, live, requestKey)
				} catch (fetchError) {
					if (requestId !== requestIdRef.current) return
					console.error('Failed to fetch live points:', fetchError)
					setError(t('loadFailed'))
					// Keep cleared state on GW switch failure — do not restore prior GW.
					if (switchingGameweek) {
						setLiveData(undefined)
						setStartingPlayers([])
						setBenchPlayers([])
						acceptSnapshot(null)
						latestLiveDataRef.current = null
						hasLoadedLiveDataRef.current = false
					}
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
		currentRequestKeyRef.current = null
		latestLiveDataRef.current = null
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
			const probe = await executeQuery<LiveContextResponse>(
				GET_LIVE_CONTEXT,
				undefined,
				{ cache: 'no-store' },
			)
			if (requestId !== requestIdRef.current) return
			const observedSnapshot = liveContextToSnapshot(probe.liveContext)
			if (!liveSnapshotNeedsRefresh(snapshotRef.current, observedSnapshot)) {
				acceptSnapshot(observedSnapshot)
				setError(undefined)
				const latestLive = latestLiveDataRef.current
				if (
					latestLive?.requestKey === currentRequestKeyRef.current &&
					latestLive.live.event === selectedGameweek
				) {
					await enrichLivePointBreakdowns(
						requestIdRef.current,
						selectedGameweek,
						latestLive.live,
						latestLive.requestKey
					)
				}
				return
			}
			await fetchLivePointsForGameweek(selectedGameweek)
		} catch (probeError) {
			if (requestId !== requestIdRef.current) return
			console.error('Failed to check live points freshness:', probeError)
			setError(t('loadFailed'))
		}
	}, [
		acceptSnapshot,
		enrichLivePointBreakdowns,
		fetchLivePointsForGameweek,
		selectedGameweek,
		t
	])

	useEffect(() => {
		const initialSnapshotKey = initialSnapshot
			? [
					initialSnapshot.eventId,
					initialSnapshot.revision,
					initialSnapshot.state,
					initialSnapshot.publishedAt,
					initialSnapshot.checkedAt
				].join(':')
			: ''
		const seedKey = [
			initialEntryId,
			initialEventId,
			initialSelectedGameweek ?? '',
			initialLiveData?.event ?? '',
			initialLiveData?.livePoints ?? '',
			initialSnapshotKey,
		].join(':')

		if (lastSeedKeyRef.current === seedKey) return
		lastSeedKeyRef.current = seedKey

		const seededEventId = initialLiveData?.event ?? initialEventId
		const nextSelectedGameweek =
			initialSelectedGameweek ?? seededEventId

		setActiveEntryId(initialEntryId)
		setEntryIdInput(initialEntryId ? String(initialEntryId) : '')
		setSelectedGameweek(nextSelectedGameweek)

		if (initialLiveData && initialEntryId > 0) {
			const requestKey = `${initialEntryId}:${initialLiveData.event}`
			skipInitialFetchRef.current = true
			hasLoadedLiveDataRef.current = true
			currentRequestKeyRef.current = requestKey
			latestLiveDataRef.current = { requestKey, live: initialLiveData }
			setLiveData(initialLiveData)
			acceptSnapshot(initialSnapshot ?? null)
			const allPlayers = mapLiveDataToPlayers(
				initialLiveData,
				breakdownLookupForRequest(breakdownCacheRef.current, requestKey)
			)
			setStartingPlayers(allPlayers.filter(player => !player.isBench))
			setBenchPlayers(allPlayers.filter(player => player.isBench))
			setIsLoading(false)
			setIsRefreshing(false)
			setError(undefined)

			const requestId = requestIdRef.current + 1
			requestIdRef.current = requestId
			void enrichLivePointBreakdowns(
				requestId,
				initialLiveData.event,
				initialLiveData,
				requestKey
			)
			return
		}

		if (initialEntryId > 0) {
			skipInitialFetchRef.current = true
			hasLoadedLiveDataRef.current = false
			latestLiveDataRef.current = null
			currentRequestKeyRef.current = null
			breakdownCacheRef.current = null
			setLiveData(undefined)
			setStartingPlayers([])
			setBenchPlayers([])
			acceptSnapshot(initialSnapshot ?? null)
			setIsLoading(true)
			setError(undefined)
			void fetchLivePointsForGameweek(nextSelectedGameweek)
		}
	}, [
		acceptSnapshot,
		enrichLivePointBreakdowns,
		fetchLivePointsForGameweek,
		initialEntryId,
		initialEventId,
		initialLiveData,
		initialSelectedGameweek,
		initialSnapshot,
	])

	useEffect(() => {
		if (!activeEntryId) return
		if (skipInitialFetchRef.current) {
			skipInitialFetchRef.current = false
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

	useEffect(() => {
		if (
			!isPageActive ||
			snapshot?.state !== 'SETTLED' ||
			selectedGameweek === undefined ||
			snapshot.eventId !== selectedGameweek
		) {
			return
		}
		const requestKey = currentRequestKeyRef.current
		const latestLive = latestLiveDataRef.current
		if (!requestKey || latestLive?.requestKey !== requestKey) return

		// Snapshot polling intentionally stops once the event settles. Keep one
		// bounded explanation-only retry aligned with the durable persistence
		// cadence so a previous-cycle or transiently failed detail batch can land.
		const elapsed = Date.now() - lastExplainAttemptAtRef.current
		const delay = Math.max(0, LIVE_EXPLAIN_REFRESH_INTERVAL_MS - elapsed)
		const retryTimer = window.setTimeout(() => {
			const currentLive = latestLiveDataRef.current
			if (
				currentRequestKeyRef.current !== requestKey ||
				currentLive?.requestKey !== requestKey
			) {
				return
			}
			void enrichLivePointBreakdowns(
				requestIdRef.current,
				selectedGameweek,
				currentLive.live,
				requestKey
			)
		}, delay)

		return () => window.clearTimeout(retryTimer)
	}, [
		enrichLivePointBreakdowns,
		isPageActive,
		selectedGameweek,
		snapshot?.eventId,
		snapshot?.revision,
		snapshot?.state
	])

	const shouldAutoRefresh = shouldPollLiveSnapshot({
		isPageActive,
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
