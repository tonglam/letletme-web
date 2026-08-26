'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import PageShell from '@/components/layout/PageShell'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { PlayerOwnershipFilter } from '@/components/player/PlayerOwnershipFilter'
import { TeamExposureFilter } from '@/components/player/TeamExposureFilter'
import { MobileCollapsibleFilters } from '@/components/tournament/MobileCollapsibleFilters'
import { OfficialH2HCompetitionView } from '@/components/tournament/OfficialH2HCompetitionView'
import { SearchHeader } from '@/components/tournament/SearchHeader'
import { TournamentHeader } from '@/components/tournament/TournamentHeader'
import { TournamentSelector } from '@/components/tournament/TournamentSelector'
import { TournamentTable } from '@/components/tournament/TournamentTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_LIVE_CONTEXT,
	type LiveContextResponse,
	type LiveSnapshotResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_DETAIL_DESK,
	GET_TOURNAMENT_LIVE_DESK,
	type EntryTournamentsResponse,
	type TournamentDetailDeskResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse
} from '@/lib/graphql/operations/tournaments'
import { usePageActive } from '@/hooks/use-page-active'
import {
	liveSnapshotNeedsRefresh,
	liveContextToSnapshot,
	shouldPollLiveSnapshot
} from '@/lib/live-refresh'
import {
	buildTournamentEntries,
	buildTournamentStats,
	countTraceableTournamentScores,
	getTournamentManagerNextRefreshAt,
	formatLiveAveragePoints,
	getRetainedFailedEntryIds,
	mergeUnavailableTournamentEntryIds,
	mergePartialTournamentRows,
	type LiveTournamentStats
} from '@/lib/tournament/liveEntries'
import { traceableOfficialManagerScore } from '@/lib/live-manager-score'
import {
	isOfficialH2HTournament,
	mapEntryTournamentToLiveTournament
} from '@/lib/tournament/liveTournament'
import {
	areTournamentStandingsReady,
	isTournamentSetupPollingPending
} from '@/lib/tournament/lifecycle'
import {
	readLiveTournamentSelection,
	resolveLiveTournamentSelection,
	writeLiveTournamentSelection
} from '@/lib/tournament/live-selection'
import { Tournament, type TournamentEntry } from '@/types/tournament'
import { Link, useRouter } from '@/i18n/navigation'
import { Eye, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const fetchLivePoints = async (
	entryId: number,
	tournamentId: number,
	eventId: number,
	revision?: string | null
): Promise<{
	rows: TournamentLiveCalcData[]
	failedCount: number
	failedEntryIds: number[]
	officialCoverage: number
	unavailableEntryIds: number[]
	totalEntries: number
	snapshot: LiveSnapshotStatus | null
}> => {
	let response: TournamentLivePointsResponse
	if (revision) {
		const params = new URLSearchParams({
			eventId: String(eventId),
			revision
		})
		const httpResponse = await fetch(
			`/api/live/competitions/${tournamentId}/board?${params.toString()}`,
			{ cache: 'no-store' }
		)
		if (!httpResponse.ok)
			throw new Error(
				`Live competition request failed (${httpResponse.status})`
			)
		response = (await httpResponse.json()) as TournamentLivePointsResponse
	} else {
		// A null live revision must still honor the selected historical GW. The
		// list desk intentionally resolves its event from the live anchor, so use
		// the detail projection, whose eventId argument is the actual selection.
		const detailResponse = await executeQuery<TournamentDetailDeskResponse>(
			GET_TOURNAMENT_DETAIL_DESK,
			{ entryId, tournamentId, eventId },
			{ cache: 'no-store' }
		)
		const detailDesk = detailResponse.tournamentDetailDesk
		const live = detailDesk?.live
		if (live) {
			const unavailableEntryIds = mergeUnavailableTournamentEntryIds(
				live.failedEntryIds,
				[]
			)
			const officialRows = countTraceableTournamentScores(live.rows)
			return {
				rows: live.rows,
				failedCount: unavailableEntryIds.length,
				failedEntryIds: unavailableEntryIds,
				officialCoverage:
					live.totalEntries > 0 ? officialRows / live.totalEntries : 0,
				unavailableEntryIds,
				totalEntries: live.totalEntries,
				snapshot: {
					eventId: live.eventId,
					revision: live.revision,
					state: live.state as LiveSnapshotStatus['state'],
					publishedAt: null,
					checkedAt: null
				}
			}
		}

		// Official H2H tournaments deliberately expose their settled standings
		// through `officialH2H` on the detail desk, not through `live`. The
		// competitions page still needs the current event board, so use the list
		// desk as the event-aware fallback instead of treating that valid H2H
		// response as an unavailable board.
		if (detailDesk?.kind !== 'OFFICIAL_H2H') {
			throw new Error('Tournament live board is unavailable')
		}
		response = await executeQuery<TournamentLivePointsResponse>(
			GET_TOURNAMENT_LIVE_DESK,
			{ entryId, selectedTournamentId: tournamentId, ref: null },
			{ cache: 'no-store' }
		)
		if (response.entryLiveCompetitionsDesk.eventId !== eventId) {
			throw new Error('Tournament live board returned an unexpected gameweek')
		}
	}
	const batch = response.entryLiveCompetitionsDesk
	const unavailableEntryIds = mergeUnavailableTournamentEntryIds(
		batch.failedEntryIds,
		batch.unavailableEntryIds ?? []
	)
	return {
		rows: batch.board ?? [],
		failedCount: unavailableEntryIds.length,
		failedEntryIds: unavailableEntryIds,
		officialCoverage: batch.officialCoverage ?? 0,
		unavailableEntryIds,
		totalEntries: batch.totalEntries,
		snapshot: {
			eventId: batch.eventId,
			revision: batch.revision ?? null,
			state: (batch.windowState ?? batch.state) as LiveSnapshotStatus['state'],
			publishedAt: null,
			checkedAt: null,
			windowState: batch.windowState as LiveSnapshotStatus['windowState'],
			dataAvailability:
				batch.dataAvailability as LiveSnapshotStatus['dataAvailability'],
			nextRefreshAt: batch.nextRefreshAt ?? null
		}
	}
}

interface TournamentClientProps {
	entryId: number
	initialTournaments?: Tournament[]
	initialSelectedTournamentId?: string
	initialEventId: number
	initialCurrentRows?: TournamentLiveCalcData[]
	initialResultsLoaded?: boolean
	initialResultsError?: string | null
	initialSnapshot?: LiveSnapshotStatus | null
	initialOfficialCoverage?: number
}

export default function TournamentClient({
	entryId,
	initialTournaments = [],
	initialSelectedTournamentId = '',
	initialEventId,
	initialCurrentRows = [],
	initialResultsLoaded = false,
	initialResultsError = null,
	initialSnapshot,
	initialOfficialCoverage = 0
}: TournamentClientProps) {
	const t = useTranslations('LiveTournament')
	const format = useFormatter()
	const lifecycleT = useTranslations('TournamentLifecycle')
	const filtersT = useTranslations('Filters')
	const isPageActive = usePageActive()
	const router = useRouter()
	const searchParams = useSearchParams()

	const [searchQuery, setSearchQuery] = useState<string>('')
	const [chipFilter, setChipFilter] = useState<string>('all')
	const [captainFilter, setCaptainFilter] = useState<string>('all')
	const [tournaments, setTournaments] =
		useState<Tournament[]>(initialTournaments)
	const [restoredTournamentId, setRestoredTournamentId] = useState<
		string | null
	>(null)
	const [selectionRestoreComplete, setSelectionRestoreComplete] =
		useState(false)
	const selectionRestoreEntryIdRef = useRef<number | null>(null)
	const cachedTournamentIdRef = useRef<string | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [resultsError, setResultsError] = useState<string | null>(
		initialResultsError
	)
	const [isLoadingTournaments, setIsLoadingTournaments] = useState<boolean>(
		entryId > 0 && initialTournaments.length === 0
	)
	const [isLoadingResults, setIsLoadingResults] = useState<boolean>(false)
	const [snapshot, setSnapshot] = useState<LiveSnapshotStatus | null>(
		initialSnapshot ?? null
	)
	const snapshotRef = useRef<LiveSnapshotStatus | null>(initialSnapshot ?? null)
	const [currentGameweek, setCurrentGameweek] = useState<number>(initialEventId)
	const [selectedGameweek, setSelectedGameweek] =
		useState<number>(initialEventId)
	const requestedGameweekFromUrl = (() => {
		const raw = searchParams.get('gw')
		if (!raw || !/^\d+$/.test(raw)) return null
		const parsed = Number(raw)
		return Number.isInteger(parsed) && parsed >= 1 && parsed <= 38
			? parsed
			: null
	})()
	const initialRetryAttemptedRef = useRef(false)
	const followsAnchorRef = useRef(true)
	const appliedUrlGameweekRef = useRef<number | null | undefined>(undefined)
	const [selectedRows, setSelectedRows] =
		useState<TournamentLiveCalcData[]>(initialCurrentRows)
	const [officialCoverage, setOfficialCoverage] = useState<number>(
		initialOfficialCoverage
	)
	const [tableEntriesForShare, setTableEntriesForShare] = useState<
		TournamentEntry[]
	>([])
	const [staleEntryIds, setStaleEntryIds] = useState<ReadonlySet<number>>(
		() => new Set()
	)
	const selectedEntries = useMemo(
		() =>
			buildTournamentEntries(selectedRows, {
				staleEntryIds: staleEntryIds.size > 0 ? staleEntryIds : undefined
			}),
		[selectedRows, staleEntryIds]
	)
	const [ownershipMatchedEntryIds, setOwnershipMatchedEntryIds] = useState<
		string[] | null
	>(null)
	const [teamExposureMatchedEntryIds, setTeamExposureMatchedEntryIds] =
		useState<string[] | null>(null)
	const [showOwnershipFilter, setShowOwnershipFilter] = useState(true)
	const [showTeamExposureFilter, setShowTeamExposureFilter] = useState(true)
	const selectedStats: LiveTournamentStats = useMemo(
		() => buildTournamentStats(selectedEntries),
		[selectedEntries]
	)
	const managerNextRefreshAt = useMemo(
		() => getTournamentManagerNextRefreshAt(selectedRows),
		[selectedRows]
	)
	const managerScoreSettling = selectedRows.some(
		row => row.score?.state === 'SETTLING'
	)
	const initialResultsKey =
		initialResultsLoaded && initialSelectedTournamentId && initialEventId
			? `${initialSelectedTournamentId}:${initialEventId}`
			: null
	const initialResultsKeyRef = useRef(initialResultsKey)
	const [loadedResultsKey, setLoadedResultsKey] = useState<string | null>(
		initialResultsKey
	)
	const resultsRequestIdRef = useRef(0)
	const failedEntryCountRef = useRef(initialResultsError ? 1 : 0)
	const resultsInFlightRef = useRef<{
		key: string
		promise: Promise<void>
	} | null>(null)
	const freshnessRequestRef = useRef<Promise<void> | null>(null)
	const shareRef = useRef<HTMLDivElement | null>(null)
	const acceptSnapshot = useCallback((next: LiveSnapshotStatus | null) => {
		snapshotRef.current = next
		setSnapshot(next)
	}, [])

	const tournamentIdFromUrl = searchParams.get('tournamentId')
	const normalizedTournamentIdFromUrl = tournamentIdFromUrl?.trim() || null

	const requestedTournamentId =
		(normalizedTournamentIdFromUrl ??
			restoredTournamentId ??
			initialSelectedTournamentId) ||
		null

	useEffect(() => {
		if (entryId <= 0 || tournaments.length === 0) return

		let storage: Storage | null = null
		try {
			storage = window.localStorage
		} catch {
			// Storage is optional; live standings must remain usable when blocked.
		}

		if (selectionRestoreEntryIdRef.current !== entryId) {
			selectionRestoreEntryIdRef.current = entryId
			cachedTournamentIdRef.current = readLiveTournamentSelection(
				storage,
				entryId
			)
			setRestoredTournamentId(null)
		}

		const resolution = resolveLiveTournamentSelection({
			availableIds: tournaments.map(tournament => tournament.id),
			urlTournamentId: normalizedTournamentIdFromUrl,
			cachedTournamentId: cachedTournamentIdRef.current,
			initialTournamentId: initialSelectedTournamentId
		})
		if (resolution.source === 'unknown-url') {
			setSelectionRestoreComplete(true)
			return
		}

		if (resolution.selectedId) {
			setRestoredTournamentId(resolution.selectedId)
			if (resolution.source === 'url') {
				cachedTournamentIdRef.current = resolution.selectedId
				writeLiveTournamentSelection(storage, entryId, resolution.selectedId)
			} else if (!resolution.cachedId) {
				// Do not overwrite a cached id that is temporarily absent from an
				// incomplete membership list. Apply it when the list catches up.
				cachedTournamentIdRef.current = resolution.selectedId
				writeLiveTournamentSelection(storage, entryId, resolution.selectedId)
			}
		}
		setSelectionRestoreComplete(true)
	}, [
		entryId,
		initialSelectedTournamentId,
		normalizedTournamentIdFromUrl,
		tournaments
	])
	const selectedTournament = useMemo(() => {
		if (tournaments.length === 0) return null
		if (requestedTournamentId) {
			return tournaments.find(t => t.id === requestedTournamentId) ?? null
		}
		return tournaments[0] ?? null
	}, [requestedTournamentId, tournaments])
	const selectedTournamentIsOfficialH2H = isOfficialH2HTournament(selectedTournament)
	const selectedTournamentKey = selectedTournament?.id ?? null
	const lastUpdatedAt = useMemo(() => {
		const candidates = [
			snapshot?.checkedAt ?? null,
			...selectedRows.map(
				row => traceableOfficialManagerScore(row.score)?.checkedAt ?? null
			)
		].filter((value): value is string => Boolean(value))

		return candidates.reduce<string | null>((latest, candidate) => {
			if (!latest || Date.parse(candidate) > Date.parse(latest)) return candidate
			return latest
		}, null)
	}, [selectedRows, snapshot?.checkedAt])
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
	const selectedSetupStatus = selectedTournament?.setupStatus
	const selectedInsightsReadyAt = selectedTournament?.insightsReadyAt
	const selectedSetupRepairExhausted = selectedTournament?.setupRepairExhausted
	/** URL asked for a tournament that is not in this entry's membership list. */
	const unknownTournamentFromUrl = Boolean(
		normalizedTournamentIdFromUrl &&
		tournaments.length > 0 &&
		!tournaments.some(t => t.id === normalizedTournamentIdFromUrl)
	)
	const standingsReady = selectedTournament
		? areTournamentStandingsReady(selectedTournament)
		: false

	const loadTournamentResults = useCallback(
		(
			tournamentId: number,
			eventId: number,
			options: { preserveOnError: boolean; revision?: string | null }
		): Promise<void> => {
			const requestKey = `${tournamentId}:${eventId}`
			if (resultsInFlightRef.current?.key === requestKey) {
				return resultsInFlightRef.current.promise
			}

			const requestId = resultsRequestIdRef.current + 1
			resultsRequestIdRef.current = requestId
			const request = (async () => {
				try {
					if (!options.preserveOnError) setIsLoadingResults(true)
					setResultsError(null)
					const currentBatch = await fetchLivePoints(
						entryId,
						tournamentId,
						eventId,
						options.revision !== undefined
							? options.revision
							: (snapshotRef.current?.revision ?? null)
					)
					if (requestId !== resultsRequestIdRef.current) return

					if (currentBatch.failedCount > 0) {
						setResultsError(
							t('partialResults', {
								failed: currentBatch.failedCount,
								total: currentBatch.totalEntries
							})
						)
					}

					failedEntryCountRef.current = currentBatch.failedCount
					setOfficialCoverage(currentBatch.officialCoverage)
					setLoadedResultsKey(requestKey)
					acceptSnapshot(currentBatch.snapshot)
					// Read previous rows via functional update, then set rows + stale separately
					// (avoid nested setState inside another updater).
					setSelectedRows(previousRows => {
						const nextRows = currentBatch.rows
						const retainedIds = getRetainedFailedEntryIds({
							nextRows,
							previousRows,
							failedEntryIds: currentBatch.failedEntryIds,
							preserveFailed: options.preserveOnError
						})
						const merged = mergePartialTournamentRows({
							nextRows,
							previousRows,
							failedEntryIds: currentBatch.failedEntryIds,
							preserveFailed: options.preserveOnError
						})
						// Schedule after this updater commits — not inside the updater body.
						queueMicrotask(() => {
							if (requestId !== resultsRequestIdRef.current) return
							setStaleEntryIds(
								retainedIds.length > 0 ? new Set(retainedIds) : new Set()
							)
						})
						return merged
					})
				} catch {
					if (requestId !== resultsRequestIdRef.current) return
					setResultsError(t('standingsFailed'))
					if (!options.preserveOnError) {
						setSelectedRows([])
						setOfficialCoverage(0)
						setStaleEntryIds(new Set())
						setLoadedResultsKey(null)
					}
				} finally {
					if (requestId === resultsRequestIdRef.current) {
						setIsLoadingResults(false)
					}
				}
			})()

			resultsInFlightRef.current = { key: requestKey, promise: request }
			void request.finally(() => {
				if (resultsInFlightRef.current?.promise === request) {
					resultsInFlightRef.current = null
				}
			})
			return request
		},
		[acceptSnapshot, entryId, t]
	)

	useEffect(() => {
		let isCancelled = false
		if (entryId <= 0) {
			return
		}
		if (initialTournaments.length > 0) {
			return
		}

		const loadEntryTournaments = async () => {
			try {
				setIsLoadingTournaments(true)
				setLoadError(null)

				const data = await executeQuery<EntryTournamentsResponse>(
					GET_ENTRY_TOURNAMENTS,
					{
						entryId: entryId
					}
				)

				if (isCancelled) {
					return
				}

				const mappedTournaments = data.entryTournaments.map(entryTournament =>
					mapEntryTournamentToLiveTournament(entryTournament)
				)
				setTournaments(mappedTournaments)
			} catch {
				if (isCancelled) {
					return
				}

				setLoadError(t('listFailed'))
				setTournaments([])
			} finally {
				if (!isCancelled) {
					setIsLoadingTournaments(false)
				}
			}
		}

		loadEntryTournaments()

		return () => {
			isCancelled = true
		}
	}, [entryId, initialTournaments.length, t])

	useEffect(() => {
		if (requestedGameweekFromUrl === null) {
			appliedUrlGameweekRef.current = null
			return
		}
		if (requestedGameweekFromUrl > currentGameweek) return
		if (appliedUrlGameweekRef.current === requestedGameweekFromUrl) return

		appliedUrlGameweekRef.current = requestedGameweekFromUrl
		followsAnchorRef.current = false
		if (requestedGameweekFromUrl !== selectedGameweek) {
			setSelectedGameweek(requestedGameweekFromUrl)
		}
	}, [currentGameweek, requestedGameweekFromUrl, selectedGameweek])

	useEffect(() => {
		if (
			!isPageActive ||
			!selectedTournamentKey ||
			!isTournamentSetupPollingPending(
				selectedSetupStatus ?? 'READY',
				selectedInsightsReadyAt,
				selectedSetupRepairExhausted
			)
		) {
			return
		}

		let cancelled = false
		let timer: number | undefined
		const poll = async () => {
			try {
				const data = await executeQuery<EntryTournamentsResponse>(
					GET_ENTRY_TOURNAMENTS,
					{ entryId },
					{ cache: 'no-store' }
				)
				if (!cancelled) {
					setTournaments(
						data.entryTournaments.map(mapEntryTournamentToLiveTournament)
					)
				}
			} catch (pollError) {
				console.warn('Tournament setup status unavailable:', pollError)
			} finally {
				if (!cancelled) timer = window.setTimeout(poll, 5_000)
			}
		}

		timer = window.setTimeout(poll, 5_000)
		return () => {
			cancelled = true
			if (timer !== undefined) window.clearTimeout(timer)
		}
	}, [
		entryId,
		isPageActive,
		selectedInsightsReadyAt,
		selectedSetupRepairExhausted,
		selectedSetupStatus,
		selectedTournamentKey
	])

	useEffect(() => {
		if (
			!selectedTournamentKey ||
			!standingsReady ||
			selectedGameweek === undefined
		) {
			// Invalidate any in-flight standings fetch for a previous selection.
			resultsRequestIdRef.current += 1
			resultsInFlightRef.current = null
			const resetTimer = window.setTimeout(() => {
				setIsLoadingResults(false)
				setResultsError(null)
				setSelectedRows([])
				setOfficialCoverage(0)
				setStaleEntryIds(new Set())
				setLoadedResultsKey(null)
			}, 0)
			return () => window.clearTimeout(resetTimer)
		}
		const resultsKey = `${selectedTournamentKey}:${selectedGameweek}`
		if (selectedTournamentIsOfficialH2H) {
			// Official H2H has its own settled fixture/standings projection. Do not
			// run the manager live-board request and surface a misleading points-table
			// error while the H2H view is loading its authoritative snapshot.
			initialResultsKeyRef.current = null
			resultsRequestIdRef.current += 1
			resultsInFlightRef.current = null
			setSelectedRows([])
			setOfficialCoverage(0)
			setStaleEntryIds(new Set())
			setLoadedResultsKey(resultsKey)
			setResultsError(null)
			setIsLoadingResults(false)
			acceptSnapshot(null)
			return
		}
		if (initialResultsKeyRef.current === resultsKey) {
			initialResultsKeyRef.current = null
			if (
				initialResultsError &&
				initialCurrentRows.length === 0 &&
				!initialRetryAttemptedRef.current
			) {
				initialRetryAttemptedRef.current = true
				const retryTimer = window.setTimeout(() => {
					void loadTournamentResults(
						Number(selectedTournamentKey),
						selectedGameweek,
						{
							preserveOnError: false,
							// A full initial failure is often a stale publication
							// snapshot. Force the retry to ask for the current desk.
							revision: null
						}
					)
				}, 1_000)
				return () => window.clearTimeout(retryTimer)
			}
			return
		}

		// UX: drop previous tournament/GW rows in the same turn as selection change
		// so we never paint "new header + old standings" for a frame.
		resultsRequestIdRef.current += 1
		resultsInFlightRef.current = null
		setSelectedRows([])
		setOfficialCoverage(0)
		setStaleEntryIds(new Set())
		setLoadedResultsKey(null)
		setResultsError(null)
		setIsLoadingResults(true)
		acceptSnapshot(null)
		void loadTournamentResults(
			Number(selectedTournamentKey),
			selectedGameweek,
			{
				preserveOnError: false
			}
		)
	}, [
		acceptSnapshot,
		loadTournamentResults,
		initialCurrentRows.length,
		initialResultsError,
		selectedGameweek,
		selectedTournamentIsOfficialH2H,
		selectedTournamentKey,
		standingsReady
	])

	useEffect(() => {
		// Reset filters as soon as the tournament or GW changes (not after fetch).
		setTableEntriesForShare([])
		const resetTimer = window.setTimeout(() => {
			setSearchQuery('')
			setChipFilter('all')
			setCaptainFilter('all')
			setOwnershipMatchedEntryIds(null)
			setTeamExposureMatchedEntryIds(null)
		}, 0)
		return () => window.clearTimeout(resetTimer)
	}, [selectedGameweek, selectedTournament?.id])

	const displayGameweek = selectedGameweek
	const autoRefreshEnabled =
		standingsReady &&
		shouldPollLiveSnapshot({
			isPageActive,
			currentEventId: currentGameweek,
			selectedEventId: selectedGameweek,
			snapshot,
			managerScoreState: managerScoreSettling ? 'SETTLING' : null,
			managerNextRefreshAt,
			windowState: snapshot?.windowState ?? snapshot?.state,
			nextRefreshAt: snapshot?.nextRefreshAt
		})
	const refreshTournamentResults = useCallback(
		async (revision?: string | null) => {
			if (!selectedTournament) return
			await loadTournamentResults(
				Number(selectedTournament.id),
				selectedGameweek,
				{
					preserveOnError: true,
					revision: revision ?? snapshotRef.current?.revision ?? null
				}
			)
		},
		[loadTournamentResults, selectedGameweek, selectedTournament]
	)
	const autoRefreshTournamentResults = useCallback((): Promise<void> => {
		if (!selectedTournament || !standingsReady) return Promise.resolve()
		if (freshnessRequestRef.current) return freshnessRequestRef.current

		const requestId = resultsRequestIdRef.current
		const request = (async () => {
			try {
				const probe = await executeQuery<LiveContextResponse>(
					GET_LIVE_CONTEXT,
					undefined,
					{ cache: 'no-store' }
				)
				if (requestId !== resultsRequestIdRef.current) return
				const context = probe.liveContext
				const observedAnchorEventId = context?.anchorEventId ?? undefined
				if (
					observedAnchorEventId &&
					observedAnchorEventId !== currentGameweek
				) {
					setCurrentGameweek(observedAnchorEventId)
					if (followsAnchorRef.current) {
						setSelectedGameweek(observedAnchorEventId)
					}
					return
				}
				const observedSnapshot = liveContextToSnapshot(probe.liveContext)
				const managerScoreDue = Boolean(
					managerNextRefreshAt && Date.parse(managerNextRefreshAt) <= Date.now()
				)
				if (
					!liveSnapshotNeedsRefresh(snapshotRef.current, observedSnapshot) &&
					!managerScoreDue
				) {
					acceptSnapshot(observedSnapshot)
					if (failedEntryCountRef.current === 0) setResultsError(null)
					return
				}
				await refreshTournamentResults(observedSnapshot?.revision ?? null)
			} catch (probeError) {
				if (requestId !== resultsRequestIdRef.current) return
				console.error('Failed to check live tournament freshness:', probeError)
				setResultsError(t('standingsFailed'))
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
		refreshTournamentResults,
		selectedTournament,
		standingsReady,
		t,
		managerNextRefreshAt,
		currentGameweek
	])
	const handleGameweekChange = useCallback((gameweek: number) => {
		followsAnchorRef.current = false
		setSelectedGameweek(gameweek)
	}, [])
	const captainOptions = useMemo(
		() =>
			Array.from(
				new Set(
					selectedEntries
						.map(entry => entry.captainName)
						.filter(name => !!name && name !== 'N/A')
				)
			).sort((a, b) => a.localeCompare(b)),
		[selectedEntries]
	)

	const handleOwnershipMatchedEntryIdsChange = useCallback(
		(entryIds: string[] | null) => {
			setOwnershipMatchedEntryIds(entryIds)
		},
		[]
	)

	const handleTeamExposureMatchedEntryIdsChange = useCallback(
		(entryIds: string[] | null) => {
			setTeamExposureMatchedEntryIds(entryIds)
		},
		[]
	)

	const dismissOwnershipFilter = useCallback(() => {
		setOwnershipMatchedEntryIds(null)
		setShowOwnershipFilter(false)
	}, [])

	const dismissTeamExposureFilter = useCallback(() => {
		setTeamExposureMatchedEntryIds(null)
		setShowTeamExposureFilter(false)
	}, [])

	const restoreOwnershipFilter = useCallback(() => {
		setShowOwnershipFilter(true)
	}, [])

	const restoreTeamExposureFilter = useCallback(() => {
		setShowTeamExposureFilter(true)
	}, [])

	const handleTableEntriesForShareChange = useCallback(
		(entries: TournamentEntry[]) => {
			setTableEntriesForShare(entries)
		},
		[]
	)

	const ownershipMatchedEntrySet = useMemo(
		() => (ownershipMatchedEntryIds ? new Set(ownershipMatchedEntryIds) : null),
		[ownershipMatchedEntryIds]
	)

	const teamExposureMatchedEntrySet = useMemo(
		() =>
			teamExposureMatchedEntryIds ? new Set(teamExposureMatchedEntryIds) : null,
		[teamExposureMatchedEntryIds]
	)

	const filteredEntries = useMemo(() => {
		const query = searchQuery.trim().toLowerCase()
		const captainQuery = captainFilter.trim().toLowerCase()
		return selectedEntries.filter(entry => {
			const matchesSearch =
				query.length === 0 ||
				entry.teamName.toLowerCase().includes(query) ||
				entry.managerName.toLowerCase().includes(query)

			const matchesChip =
				chipFilter === 'all' ||
				(chipFilter === 'triple' && entry.chips.triple) ||
				(chipFilter === 'bench' && entry.chips.bench) ||
				(chipFilter === 'wildcard' && entry.chips.wildcard) ||
				(chipFilter === 'freehit' && entry.chips.freeHit)

			const matchesCaptain =
				captainFilter === 'all' ||
				captainQuery.length === 0 ||
				entry.captainName.toLowerCase() === captainQuery

			const matchesOwnership =
				ownershipMatchedEntrySet === null ||
				ownershipMatchedEntrySet.has(entry.id)

			const matchesTeamExposure =
				teamExposureMatchedEntrySet === null ||
				teamExposureMatchedEntrySet.has(entry.id)

			return (
				matchesSearch &&
				matchesChip &&
				matchesCaptain &&
				matchesOwnership &&
				matchesTeamExposure
			)
		})
	}, [
		captainFilter,
		chipFilter,
		ownershipMatchedEntrySet,
		teamExposureMatchedEntrySet,
		searchQuery,
		selectedEntries
	])
	const shareText = useMemo(() => {
		const name = selectedTournament?.name ?? t('liveStandings')
		const lines = [
			`# ${name} · GW${displayGameweek}`,
			`${t('averageScore')}: ${formatLiveAveragePoints(selectedStats.averagePoints)} · ${t('highestScore')}: ${selectedStats.highestPoints}`,
			'',
			t('standings')
		]
		const entriesInRankOrder = (
			tableEntriesForShare.length > 0 ? tableEntriesForShare : filteredEntries
		)
			.slice()
			.sort((left, right) => {
				const leftRank =
					Number.isFinite(left.rank) && left.rank > 0
						? left.rank
						: Number.POSITIVE_INFINITY
				const rightRank =
					Number.isFinite(right.rank) && right.rank > 0
						? right.rank
						: Number.POSITIVE_INFINITY
				return leftRank - rightRank || left.id.localeCompare(right.id)
			})
		for (const entry of entriesInRankOrder.slice(0, 20)) {
			lines.push(
				`- ${entry.rank || '—'} ${entry.teamName} · ${entry.gwPoints ?? '—'} GW · ${entry.totalPoints ?? '—'} total`
			)
		}
		lines.push(
			'',
			typeof window !== 'undefined'
				? window.location.href
				: 'https://letletme.top/live/competitions'
		)
		return lines.join('\n')
	}, [
		displayGameweek,
		filteredEntries,
		selectedStats,
		selectedTournament,
		t,
		tableEntriesForShare
	])

	if (entryId <= 0) {
		return (
			<PageShell>
				<div className="container mx-auto max-w-4xl px-4 py-8">
					<StatsPageHeader title={t('liveStandings')} />
					<Card className="p-6 text-sm text-muted-foreground shadow-sm">
						{t('signInPrompt')}{' '}
						<Link
							href="/auth/login?next=/live/competitions"
							className="text-primary-ink underline"
						>
							{t('signIn')}
						</Link>
					</Card>
				</div>
			</PageShell>
		)
	}

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<RouteReadyMarker
					name="LIVE_COMPETITION_BOARD_READY"
					ready={Boolean(
						selectedTournament &&
						selectionRestoreComplete &&
						standingsReady &&
						!isLoadingResults &&
						loadedResultsKey === `${selectedTournament.id}:${selectedGameweek}`
					)}
					audienceHint="session-hint"
					goodMs={1000}
					poorMs={1500}
					readyKey={`${selectedTournament?.id ?? 'none'}:${selectedGameweek ?? 'none'}`}
				/>
				<StatsPageHeader
					title={t('liveStandings')}
					badge={
						<div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
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
								size="sm"
								variant="outline"
								onClick={() => void refreshTournamentResults()}
								disabled={
									!selectedTournament ||
									!standingsReady ||
									isLoadingResults ||
									selectedGameweek === undefined
								}
							>
								<RefreshCw
									data-icon="inline-start"
									className={isLoadingResults ? 'animate-spin' : undefined}
								/>
								{t('refresh')}
							</Button>
							<LiveAutoRefreshCountdown
								enabled={autoRefreshEnabled}
								onRefresh={autoRefreshTournamentResults}
								nextRefreshAt={snapshot?.nextRefreshAt ?? managerNextRefreshAt}
								renderLabel={seconds => t('nextRefresh', { seconds })}
								showLabel={false}
							/>
							{selectedGameweek ? (
								<GameweekBadge gameweek={selectedGameweek} />
							) : null}
						</div>
					}
				/>

				{loadError && (
					<Card className="mb-6 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
						{loadError}
					</Card>
				)}

				{unknownTournamentFromUrl && (
					<Card className="mb-6 space-y-3 border-border/80 p-4 text-sm shadow-sm">
						<p className="text-muted-foreground">{t('competitionNotInList')}</p>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => router.replace('/live/competitions')}
							>
								{t('clear')}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="secondary"
								asChild
							>
								<Link
									href="/competitions/browse"
									prefetch={false}
								>
									{t('errorCtaMyCompetitions')}
								</Link>
							</Button>
						</div>
					</Card>
				)}

				{resultsError && (
					<Card className="p-4 mb-6 border-destructive/30 bg-destructive/5 text-destructive text-sm">
						{resultsError}
					</Card>
				)}

				{/* Always offer the membership list so a bad ?tournamentId= can be corrected in-place. */}
				{tournaments.length > 0 && (
					<TournamentSelector
						tournaments={tournaments}
						// Unknown URL id: force a non-matching value so every membership stays selectable.
						currentTournamentId={
							selectedTournament?.id ??
							(unknownTournamentFromUrl ? '__unknown__' : '')
						}
						onTournamentChange={id => {
							if (selectedTournament && id === selectedTournament.id) return
							setRestoredTournamentId(id)
							cachedTournamentIdRef.current = id
							try {
								writeLiveTournamentSelection(window.localStorage, entryId, id)
							} catch {
								// Storage is optional; URL navigation remains authoritative.
							}
							router.replace(`/live/competitions?tournamentId=${id}`)
						}}
					/>
				)}

				<Card className="p-4 mb-6">
					<GameweekSelector
						onGameweekChange={handleGameweekChange}
						currentGameweek={currentGameweek}
						selectedGameweek={selectedGameweek}
						disabled={
							isLoadingResults || Boolean(selectedTournament && !standingsReady)
						}
					/>
				</Card>

				{isLoadingTournaments && (
					<Card className="border-border/80 p-6 text-sm text-muted-foreground shadow-sm">
						{t('loadingCompetitions')}
					</Card>
				)}

				{!isLoadingTournaments &&
					!selectedTournament &&
					!unknownTournamentFromUrl && (
						<Card className="border-border/80 p-6 text-sm text-muted-foreground shadow-sm">
							{t('noCompetitions')}
						</Card>
					)}

				{selectedTournament && !standingsReady && (
					<Card className="p-8 text-center shadow-sm">
						<p className="font-display text-lg font-semibold tracking-tight">
							{selectedTournament.setupStatus === 'FAILED'
								? lifecycleT('memberFailure')
								: lifecycleT('standingsPreparing')}
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							{selectedTournament.setupStatus === 'FAILED'
								? lifecycleT('insightsLoading')
								: lifecycleT('standingsPreparingDescription')}
						</p>
					</Card>
				)}

		{selectedTournament && standingsReady && (
					<div>
						{!selectedTournamentIsOfficialH2H ? (
							<TournamentHeader
								name={selectedTournament.name}
								averagePoints={selectedStats.averagePoints}
								highestPoints={selectedStats.highestPoints}
								totalEntries={
									selectedStats.totalEntries || selectedTournament.totalEntries
								}
								isLoading={isLoadingResults}
							/>
						) : null}

						{selectedTournamentIsOfficialH2H ? (
							<OfficialH2HCompetitionView
								key={`${selectedTournament.id}:${displayGameweek}`}
								activeEventId={currentGameweek}
								eventId={displayGameweek}
								initialSnapshot={null}
								tournamentId={Number(selectedTournament.id)}
								viewerEntryId={entryId}
							/>
						) : isLoadingResults ? (
							<div
								className="space-y-4"
								aria-busy="true"
								aria-live="polite"
							>
								<Card className="p-6 text-sm text-muted-foreground">
									{t('loadingStandings')}
								</Card>
								<div className="overflow-hidden rounded-xl border border-border/80 bg-card">
									<div className="divide-y divide-border/50">
										{Array.from({ length: 8 }, (_, i) => (
											<div
												key={i}
												className="flex items-center gap-3 px-4 py-3"
											>
												<div className="h-4 w-6 animate-pulse rounded bg-muted" />
												<div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-muted" />
												<div className="h-4 w-12 animate-pulse rounded bg-muted" />
												<div className="h-4 w-10 animate-pulse rounded bg-muted" />
											</div>
										))}
									</div>
								</div>
							</div>
						) : (
							<div ref={shareRef}>
								<SearchHeader
									searchQuery={searchQuery}
									setSearchQuery={setSearchQuery}
									captainOptions={captainOptions}
									chipFilter={chipFilter}
									onChipFilterChange={setChipFilter}
									captainFilter={captainFilter}
									onCaptainFilterChange={setCaptainFilter}
								/>

								{!showOwnershipFilter || !showTeamExposureFilter ? (
									<div className="mb-3 flex flex-wrap items-center gap-2">
										{!showOwnershipFilter ? (
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="gap-1.5"
												onClick={restoreOwnershipFilter}
											>
												<Eye
													className="size-4"
													aria-hidden="true"
												/>
												{filtersT('showFilter', {
													name: filtersT('playerOwnership')
												})}
											</Button>
										) : null}
										{!showTeamExposureFilter ? (
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="gap-1.5"
												onClick={restoreTeamExposureFilter}
											>
												<Eye
													className="size-4"
													aria-hidden="true"
												/>
												{filtersT('showFilter', {
													name: filtersT('teamExposure')
												})}
											</Button>
										) : null}
									</div>
								) : null}

								{showOwnershipFilter || showTeamExposureFilter ? (
									<MobileCollapsibleFilters
										activeCount={
											(ownershipMatchedEntryIds ? 1 : 0) +
											(teamExposureMatchedEntryIds ? 1 : 0)
										}
									>
										{showOwnershipFilter ? (
											<PlayerOwnershipFilter
												key={`${selectedTournament.id}-${displayGameweek}`}
												entries={selectedEntries}
												onMatchedEntryIdsChange={
													handleOwnershipMatchedEntryIdsChange
												}
												onDismiss={dismissOwnershipFilter}
											/>
										) : null}

										{showTeamExposureFilter ? (
											<TeamExposureFilter
												key={`team-${selectedTournament.id}-${displayGameweek}`}
												entries={selectedEntries}
												onMatchedEntryIdsChange={
													handleTeamExposureMatchedEntryIdsChange
												}
												onDismiss={dismissTeamExposureFilter}
											/>
										) : null}
									</MobileCollapsibleFilters>
								) : null}

								<TournamentTable
									key={`table-${selectedTournament.id}-${displayGameweek}`}
									entries={filteredEntries}
									searchQuery=""
									tournamentId={selectedTournament.id}
									gameweek={displayGameweek}
									viewerEntryId={entryId}
									onVisibleEntriesChange={handleTableEntriesForShareChange}
									shareText={shareText}
									shareImageRef={shareRef}
									shareTitle={selectedTournament.name}
								/>
							</div>
						)}
					</div>
				)}
			</div>
		</PageShell>
	)
}
