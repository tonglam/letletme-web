'use client'

import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'
import type { PerformanceCorrelation } from '@/lib/analytics/performance-correlation'
import { requestPlayerStatsDesk } from '@/lib/player-stats-desk-client'
import type { PlayerStatsDeskNormalizedEntry } from '@/lib/player-stats-desk'
import type {
	PlayerDetailData,
	PlayerStateContextData,
	PlayerStateOverviewData,
	PlayerStateProcessData,
	PlayerStateProfileData,
	PlayerStatsDeskSection
} from '@/lib/graphql/operations/players'
import { useTranslations } from 'next-intl'
import {
	startTransition,
	useCallback,
	useEffect,
	useRef,
	useState
} from 'react'
import { playerDetailToDirectoryOption } from '../_lib/player-detail-option'
import {
	parseRecentPlayers,
	RECENT_PLAYERS_MAX,
	serializeRecentPlayers
} from '../_lib/recent-player-storage'

export type PlayerEvidenceSection = 'fixtures' | 'recent' | 'season' | 'process'

type PlayerDetailLoadResult =
	| { status: 'loaded'; detail: PlayerDetailData }
	| { status: 'not-found' | 'failed' | 'superseded'; detail: null }

function readRecentPlayers(storageKey: string): PlayerDirectoryOption[] {
	try {
		return parseRecentPlayers(window.localStorage.getItem(storageKey))
	} catch {
		return []
	}
}

function writeRecentPlayers(
	storageKey: string,
	players: PlayerDirectoryOption[]
) {
	try {
		window.localStorage.setItem(storageKey, serializeRecentPlayers(players))
	} catch {
		// Storage is optional; comparison still works when it is unavailable.
	}
}

function withEmptyStateContext(
	core: PlayerStateOverviewData,
	eventId?: number
): PlayerStateProfileData {
	const seasonTimeline = Array.isArray(core.seasonTimeline)
		? core.seasonTimeline
		: null
	const currentPoint = seasonTimeline?.find(
		point => point.season === core.season
	)
	return {
		...core,
		position: core.profileRadar?.position ?? currentPoint?.position ?? 0,
		asOfEventId: core.profileRadar?.asOfEventId ?? eventId ?? null,
		reasons: core.reasons.map(reason => ({ code: reason.code })),
		profileRadar: core.profileRadar
			? {
					source: 'FPL',
					season: core.season,
					...core.profileRadar,
					sampleMinutes: 0,
					smallSample: false,
					axes: core.profileRadar.axes.map(axis => ({
						...axis,
						direction: 'NEUTRAL',
						sampleMinutes: null,
						capability: true,
						reasonCode: null
					}))
				}
			: null,
		seasonTimeline:
			seasonTimeline === null
				? null
				: seasonTimeline.map(point => ({
						...point,
						signals: point.signals.map(signal => ({
							...signal,
							provider: signal.code.startsWith('UNDERSTAT_')
								? 'UNDERSTAT'
								: 'FPL',
							sampleMinutes: null
						}))
					})),
		dimensions: core.dimensions.map(dimension => ({
			...dimension,
			metrics: []
		})),
		ownBaseline: { weightedPercentile: null, seasons: [] },
		peerBaseline: { minimumMinutes: 0, currentPercentile: null },
		careerTrajectory: [],
		outlook: { rating: 'UNAVAILABLE', gameweeks: [] },
		coverage: {
			sources: [],
			metricCoverage: [],
			limitations: []
		}
	}
}

function isCoreState(
	state: PlayerStatsDeskNormalizedEntry['state']
): state is PlayerStateOverviewData {
	return state != null && 'trend' in state && 'dimensions' in state
}

function isStateContext(
	state: PlayerStatsDeskNormalizedEntry['state']
): state is PlayerStateContextData {
	return (
		state != null &&
		'playerId' in state &&
		'coverage' in state &&
		!('trend' in state)
	)
}

function isProcessState(
	state: PlayerStatsDeskNormalizedEntry['state']
): state is PlayerStateProcessData {
	return (
		state != null &&
		'dimensions' in state &&
		'coverage' in state &&
		!('trend' in state)
	)
}

function canonicalBatch(playerId: number, batchPlayerIds?: number[]): number[] {
	return Array.from(new Set([playerId, ...(batchPlayerIds ?? [])]))
		.filter(id => Number.isInteger(id) && id > 0)
		.slice(0, 2)
}

const evidenceSectionToDeskSection: Record<
	Exclude<PlayerEvidenceSection, 'fixtures'>,
	PlayerStatsDeskSection
> = {
	recent: 'recent',
	season: 'production',
	process: 'process'
}

export function usePlayerDetailSlot({
	storageKey,
	eventId,
	initialEntry = null,
	navigationId
}: {
	storageKey: string
	eventId?: number
	initialEntry?: PlayerStatsDeskNormalizedEntry | null
	navigationId?: string
}) {
	const t = useTranslations('PlayerStats')
	const initialDetail = initialEntry?.overview ?? null
	const initialState = isCoreState(initialEntry?.state)
		? withEmptyStateContext(initialEntry.state, eventId)
		: null
	const [selectedPlayer, setSelectedPlayer] =
		useState<PlayerDirectoryOption | null>(() =>
			initialDetail ? playerDetailToDirectoryOption(initialDetail) : null
		)
	const [recentPlayers, setRecentPlayers] = useState<PlayerDirectoryOption[]>(
		[]
	)
	const [playerDetail, setPlayerDetail] = useState<PlayerDetailData | null>(
		initialDetail
	)
	const [playerStateProfile, setPlayerStateProfile] =
		useState<PlayerStateProfileData | null>(initialState)
	const [isLoading, setIsLoading] = useState(false)
	const [isStateLoading, setIsStateLoading] = useState(false)
	const [isStateContextLoading, setIsStateContextLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [stateError, setStateError] = useState<string | null>(null)
	const [stateContextError, setStateContextError] = useState<string | null>(
		null
	)
	const [isEvidenceLoading, setIsEvidenceLoading] = useState(false)
	const [evidenceError, setEvidenceError] = useState<string | null>(null)
	const evidenceLoadedRef = useRef<Set<PlayerEvidenceSection>>(
		new Set<PlayerEvidenceSection>(initialDetail?.fixtures ? ['fixtures'] : [])
	)
	const stateContextLoadedRef = useRef(false)
	const requestIdRef = useRef(0)
	const evidenceRequestIdRef = useRef(0)
	const overviewControllerRef = useRef<AbortController | null>(null)
	const evidenceControllerRef = useRef<AbortController | null>(null)
	const contextControllerRef = useRef<AbortController | null>(null)

	const evidenceLoaded = useCallback(() => {
		if (!(evidenceLoadedRef.current instanceof Set)) {
			evidenceLoadedRef.current = new Set<PlayerEvidenceSection>()
		}
		return evidenceLoadedRef.current
	}, [])

	const abortRequests = useCallback(() => {
		overviewControllerRef.current?.abort()
		evidenceControllerRef.current?.abort()
		contextControllerRef.current?.abort()
		overviewControllerRef.current = null
		evidenceControllerRef.current = null
		contextControllerRef.current = null
		evidenceRequestIdRef.current += 1
	}, [])

	useEffect(() => {
		let cancelled = false
		queueMicrotask(() => {
			if (cancelled) return
			setRecentPlayers(readRecentPlayers(storageKey))
		})
		return () => {
			cancelled = true
		}
	}, [storageKey])

	useEffect(() => abortRequests, [abortRequests])

	const loadPlayerDetail = useCallback(
		async (
			player: PlayerDirectoryOption,
			batchPlayerIds?: number[],
			interactionContext?: PerformanceCorrelation
		): Promise<PlayerDetailLoadResult> => {
			if (!eventId) {
				setError(t('currentGameweekUnavailable'))
				return { status: 'failed', detail: null }
			}
			abortRequests()
			const requestId = requestIdRef.current + 1
			requestIdRef.current = requestId
			const controller = new AbortController()
			overviewControllerRef.current = controller
			setIsLoading(true)
			setIsStateLoading(true)
			setIsStateContextLoading(false)
			setIsEvidenceLoading(false)
			setError(null)
			setStateError(null)
			setStateContextError(null)
			setEvidenceError(null)
			evidenceLoaded().clear()
			stateContextLoadedRef.current = false

			try {
				const playerId = Number(player.id)
				const response = await requestPlayerStatsDesk(
					{
						playerIds: canonicalBatch(playerId, batchPlayerIds),
						eventId,
						section: 'overview'
					},
					{
						signal: controller.signal,
						navigationId,
						interactionId: interactionContext?.interactionId
					}
				)
				if (requestId !== requestIdRef.current || controller.signal.aborted) {
					return { status: 'superseded', detail: null }
				}
				const entry = response.entries.find(
					candidate => candidate.playerId === playerId
				)
				const detail = entry?.overview ?? null
				if (detail) {
					startTransition(() => {
						setPlayerDetail(detail)
						setSelectedPlayer(playerDetailToDirectoryOption(detail))
						if (isCoreState(entry?.state)) {
							setPlayerStateProfile(withEmptyStateContext(entry.state, eventId))
						} else {
							setPlayerStateProfile(null)
							setStateError(t('stateLoadFailed'))
						}
					})
				}
				if (detail?.fixtures) evidenceLoaded().add('fixtures')
				return detail
					? { status: 'loaded', detail }
					: { status: 'not-found', detail: null }
			} catch (error) {
				if (requestId !== requestIdRef.current || controller.signal.aborted) {
					return { status: 'superseded', detail: null }
				}
				const status =
					error instanceof Error
						? (error as Error & { status?: number }).status
						: null
				setError(status === 404 ? t('playerNotFound') : t('loadFailed'))
				setStateError(t('stateLoadFailed'))
				return { status: status === 404 ? 'not-found' : 'failed', detail: null }
			} finally {
				if (requestId === requestIdRef.current) {
					setIsLoading(false)
					setIsStateLoading(false)
				}
			}
		},
		[abortRequests, eventId, evidenceLoaded, navigationId, t]
	)

	const loadStateContext = useCallback(
		async (batchPlayerIds?: number[]) => {
			if (
				!eventId ||
				!selectedPlayer ||
				!playerStateProfile ||
				stateContextLoadedRef.current ||
				isStateContextLoading
			) {
				return
			}
			contextControllerRef.current?.abort()
			const controller = new AbortController()
			contextControllerRef.current = controller
			const requestId = requestIdRef.current
			const playerId = Number(selectedPlayer.id)
			setIsStateContextLoading(true)
			setStateContextError(null)
			try {
				const response = await requestPlayerStatsDesk(
					{
						playerIds: canonicalBatch(playerId, batchPlayerIds),
						eventId,
						section: 'context'
					},
					{ signal: controller.signal, navigationId }
				)
				if (requestId !== requestIdRef.current || controller.signal.aborted)
					return
				const context = response.entries.find(
					entry => entry.playerId === playerId
				)?.state
				if (!isStateContext(context))
					throw new Error('Player state context unavailable')
				startTransition(() => {
					setPlayerStateProfile(previous =>
						previous && previous.playerId === context.playerId
							? {
									...previous,
									coverage: {
										...previous.coverage,
										...context.coverage
									}
								}
							: previous
					)
				})
				stateContextLoadedRef.current = true
			} catch {
				if (requestId === requestIdRef.current && !controller.signal.aborted) {
					setStateContextError(t('evidenceLoadFailed'))
				}
			} finally {
				if (requestId === requestIdRef.current) setIsStateContextLoading(false)
			}
		},
		[
			eventId,
			isStateContextLoading,
			navigationId,
			playerStateProfile,
			selectedPlayer,
			t
		]
	)

	const loadEvidence = useCallback(
		async (section: PlayerEvidenceSection, batchPlayerIds?: number[]) => {
			if (!eventId || !selectedPlayer || evidenceLoaded().has(section)) return
			if (section === 'fixtures') {
				evidenceLoaded().add('fixtures')
				return
			}
			evidenceControllerRef.current?.abort()
			const evidenceRequestId = evidenceRequestIdRef.current + 1
			evidenceRequestIdRef.current = evidenceRequestId
			const controller = new AbortController()
			evidenceControllerRef.current = controller
			const requestId = requestIdRef.current
			const playerId = Number(selectedPlayer.id)
			setIsEvidenceLoading(true)
			setEvidenceError(null)
			try {
				const response = await requestPlayerStatsDesk(
					{
						playerIds: canonicalBatch(playerId, batchPlayerIds),
						eventId,
						section: evidenceSectionToDeskSection[section]
					},
					{ signal: controller.signal, navigationId }
				)
				if (requestId !== requestIdRef.current || controller.signal.aborted)
					return
				const entry = response.entries.find(
					candidate => candidate.playerId === playerId
				)
				const evidence = entry?.evidence
				if (!evidence) throw new Error('Player evidence unavailable')
				const processState = entry?.state
				startTransition(() => {
					setPlayerDetail(previous =>
						previous
							? { ...previous, ...evidence }
							: (evidence as PlayerDetailData)
					)
					if (section === 'process' && isProcessState(processState)) {
						setPlayerStateProfile(previous => {
							if (!previous || previous.playerId !== processState.playerId)
								return previous
							const processByKind = new Map(
								processState.dimensions.map(dimension => [
									dimension.kind,
									dimension
								])
							)
							return {
								...previous,
								dimensions: previous.dimensions.map(
									dimension => processByKind.get(dimension.kind) ?? dimension
								),
								coverage: {
									...previous.coverage,
									...processState.coverage
								}
							}
						})
					}
				})
				evidenceLoaded().add(section)
			} catch {
				if (requestId === requestIdRef.current && !controller.signal.aborted) {
					setEvidenceError(t('evidenceLoadFailed'))
				}
			} finally {
				if (
					evidenceRequestId === evidenceRequestIdRef.current &&
					evidenceControllerRef.current === controller
				)
					setIsEvidenceLoading(false)
			}
		},
		[eventId, evidenceLoaded, navigationId, selectedPlayer, t]
	)

	const rememberPlayer = useCallback(
		(player: PlayerDirectoryOption) => {
			setRecentPlayers(previous => {
				const next = [
					player,
					...previous.filter(item => item.id !== player.id)
				].slice(0, RECENT_PLAYERS_MAX)
				writeRecentPlayers(storageKey, next)
				return next
			})
		},
		[storageKey]
	)

	const selectPlayer = useCallback(
		(
			player: PlayerDirectoryOption,
			batchPlayerIds?: number[],
			interactionContext?: PerformanceCorrelation
		) => {
			setError(null)
			setStateError(null)
			setStateContextError(null)
			setEvidenceError(null)
			evidenceLoaded().clear()
			stateContextLoadedRef.current = false
			void loadPlayerDetail(player, batchPlayerIds, interactionContext).then(
				result => {
					if (result.status === 'loaded') {
						rememberPlayer(playerDetailToDirectoryOption(result.detail))
					} else if (result.status === 'not-found') {
						setError(t('playerNotFound'))
					}
				}
			)
		},
		[evidenceLoaded, loadPlayerDetail, rememberPlayer, t]
	)

	const selectPlayerById = useCallback(
		async (
			playerId: number,
			opts?: {
				silentNotFound?: boolean
				batchPlayerIds?: number[]
				interactionId?: string
			}
		) => {
			if (!eventId) {
				setError(t('currentGameweekUnavailable'))
				return null
			}
			if (!Number.isInteger(playerId) || playerId <= 0) return null
			if (playerDetail?.id === playerId) return playerDetail
			const placeholder: PlayerDirectoryOption = {
				id: String(playerId),
				name: '',
				position: 'MID',
				teamShortName: '',
				teamName: ''
			}
			const result = await loadPlayerDetail(placeholder, opts?.batchPlayerIds, {
				navigationId,
				interactionId: opts?.interactionId
			})
			if (result.status === 'superseded') return null
			if (result.status !== 'loaded') {
				if (result.status === 'not-found' && !opts?.silentNotFound) {
					setError(t('playerNotFound'))
				}
				return null
			}
			const player = playerDetailToDirectoryOption(result.detail)
			rememberPlayer(player)
			return result.detail
		},
		[eventId, loadPlayerDetail, navigationId, playerDetail, rememberPlayer, t]
	)

	const clearSelection = useCallback(() => {
		requestIdRef.current += 1
		abortRequests()
		setSelectedPlayer(null)
		setPlayerDetail(null)
		setPlayerStateProfile(null)
		setError(null)
		setStateError(null)
		setStateContextError(null)
		setIsLoading(false)
		setIsStateLoading(false)
		setIsStateContextLoading(false)
		setIsEvidenceLoading(false)
		setEvidenceError(null)
		stateContextLoadedRef.current = false
		evidenceLoaded().clear()
	}, [abortRequests, evidenceLoaded])

	const clearRecent = useCallback(() => {
		try {
			window.localStorage.removeItem(storageKey)
		} catch {
			// Storage is optional.
		}
		setRecentPlayers([])
	}, [storageKey])

	return {
		selectedPlayer,
		recentPlayers,
		playerDetail,
		playerStateProfile,
		isLoading,
		isStateLoading,
		isStateContextLoading,
		error,
		stateError,
		stateContextError,
		isEvidenceLoading,
		evidenceError,
		loadEvidence,
		loadStateContext,
		selectPlayer,
		selectPlayerById,
		clearSelection,
		clearRecent
	}
}
