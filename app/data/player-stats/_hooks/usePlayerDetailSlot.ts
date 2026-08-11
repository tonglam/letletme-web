'use client'

import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_PLAYER_EVIDENCE_FIXTURES,
	GET_PLAYER_EVIDENCE_PROCESS,
	GET_PLAYER_EVIDENCE_PRODUCTION,
	GET_PLAYER_EVIDENCE_RECENT,
	GET_PLAYER_OVERALL,
	GET_PLAYER_STATE_CONTEXT,
	GET_PLAYER_STATE_PROFILE,
	type PlayerDetailData,
	type PlayerDetailResponse,
	type PlayerStateContextResponse,
	type PlayerStateProfileData,
	type PlayerStateProfileResponse
} from '@/lib/graphql/operations/players'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
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
	core: NonNullable<PlayerStateProfileResponse['playerStateProfile']>
): PlayerStateProfileData {
	return {
		...core,
		ownBaseline: { weightedPercentile: null, seasons: [] },
		peerBaseline: { minimumMinutes: 0, currentPercentile: null },
		careerTrajectory: [],
		coverage: { ...core.coverage, providers: [] }
	}
}

export function usePlayerDetailSlot({
	storageKey,
	eventId
}: {
	storageKey: string
	eventId?: number
}) {
	const t = useTranslations('PlayerStats')
	const [selectedPlayer, setSelectedPlayer] =
		useState<PlayerDirectoryOption | null>(null)
	const [recentPlayers, setRecentPlayers] = useState<PlayerDirectoryOption[]>(
		[]
	)
	const [playerDetail, setPlayerDetail] = useState<PlayerDetailData | null>(
		null
	)
	const [playerStateProfile, setPlayerStateProfile] =
		useState<PlayerStateProfileData | null>(null)
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
	const evidenceLoadedRef = useRef<Set<PlayerEvidenceSection>>(new Set())
	const stateContextLoadedRef = useRef(false)
	const evidenceLoaded = useCallback(() => {
		if (!(evidenceLoadedRef.current instanceof Set)) {
			evidenceLoadedRef.current = new Set<PlayerEvidenceSection>()
		}
		return evidenceLoadedRef.current
	}, [])
	const requestIdRef = useRef(0)

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

	const loadPlayerDetail = useCallback(
		async (player: PlayerDirectoryOption): Promise<PlayerDetailLoadResult> => {
			if (!eventId) {
				setError(t('currentGameweekUnavailable'))
				return { status: 'failed', detail: null }
			}
			const requestId = requestIdRef.current + 1
			requestIdRef.current = requestId
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

			void executeQuery<PlayerStateProfileResponse>(GET_PLAYER_STATE_PROFILE, {
				playerId: Number(player.id),
				horizon: 5
			})
				.then(response => {
					if (requestId !== requestIdRef.current) return
					setPlayerStateProfile(
						response.playerStateProfile
							? withEmptyStateContext(response.playerStateProfile)
							: null
					)
				})
				.catch(() => {
					if (requestId !== requestIdRef.current) return
					setPlayerStateProfile(null)
					setStateError(t('stateLoadFailed'))
				})
				.finally(() => {
					if (requestId === requestIdRef.current) setIsStateLoading(false)
				})

			try {
				const response = await executeQuery<PlayerDetailResponse>(
					GET_PLAYER_OVERALL,
					{
						playerId: Number(player.id),
						eventId
					}
				)
				if (requestId !== requestIdRef.current) {
					return { status: 'superseded', detail: null }
				}
				setPlayerDetail(response.playerDetail)
				return response.playerDetail
					? { status: 'loaded', detail: response.playerDetail }
					: { status: 'not-found', detail: null }
			} catch {
				if (requestId !== requestIdRef.current) {
					return { status: 'superseded', detail: null }
				}
				setPlayerDetail(null)
				setError(t('loadFailed'))
				return { status: 'failed', detail: null }
			} finally {
				if (requestId === requestIdRef.current) setIsLoading(false)
			}
		},
		[eventId, evidenceLoaded, t]
	)

	const loadStateContext = useCallback(async () => {
		if (
			!selectedPlayer ||
			!playerStateProfile ||
			stateContextLoadedRef.current ||
			isStateContextLoading
		) {
			return
		}
		const requestId = requestIdRef.current
		setIsStateContextLoading(true)
		setStateContextError(null)
		try {
			const response = await executeQuery<PlayerStateContextResponse>(
				GET_PLAYER_STATE_CONTEXT,
				{ playerId: Number(selectedPlayer.id), horizon: 5 }
			)
			if (requestId !== requestIdRef.current) return
			const context = response.playerStateProfile
			if (!context) throw new Error('Player state context unavailable')
			if (playerStateProfile.playerId !== context.playerId) return
			setPlayerStateProfile(previous =>
				previous && previous.playerId === context.playerId
					? {
							...previous,
							ownBaseline: context.ownBaseline,
							peerBaseline: context.peerBaseline,
							careerTrajectory: context.careerTrajectory,
							coverage: {
								...previous.coverage,
								providers: context.coverage.providers
							}
						}
					: previous
			)
			stateContextLoadedRef.current = true
		} catch {
			if (requestId === requestIdRef.current) {
				setStateContextError(t('evidenceLoadFailed'))
			}
		} finally {
			if (requestId === requestIdRef.current) {
				setIsStateContextLoading(false)
			}
		}
	}, [isStateContextLoading, playerStateProfile, selectedPlayer, t])

	const loadEvidence = useCallback(
		async (section: PlayerEvidenceSection) => {
			if (!eventId || !selectedPlayer || evidenceLoaded().has(section)) return
			const requestId = requestIdRef.current
			setIsEvidenceLoading(true)
			setEvidenceError(null)
			const queryBySection: Record<PlayerEvidenceSection, string> = {
				fixtures: GET_PLAYER_EVIDENCE_FIXTURES,
				recent: GET_PLAYER_EVIDENCE_RECENT,
				season: GET_PLAYER_EVIDENCE_PRODUCTION,
				process: GET_PLAYER_EVIDENCE_PROCESS
			}
			try {
				const response = await executeQuery<{
					playerDetail: Partial<PlayerDetailData> | null
				}>(queryBySection[section], {
					playerId: Number(selectedPlayer.id),
					eventId
				})
				if (requestId !== requestIdRef.current) return
				if (response.playerDetail) {
					setPlayerDetail(previous =>
						previous
							? { ...previous, ...response.playerDetail }
							: (response.playerDetail as PlayerDetailData)
					)
					evidenceLoaded().add(section)
				}
			} catch {
				if (requestId === requestIdRef.current)
					setEvidenceError(t('evidenceLoadFailed'))
			} finally {
				if (requestId === requestIdRef.current) setIsEvidenceLoading(false)
			}
		},
		[eventId, evidenceLoaded, selectedPlayer, t]
	)

	const selectPlayer = useCallback(
		(player: PlayerDirectoryOption) => {
			setSelectedPlayer(player)
			setPlayerDetail(null)
			setPlayerStateProfile(null)
			setError(null)
			setStateError(null)
			setStateContextError(null)
			setEvidenceError(null)
			evidenceLoaded().clear()
			stateContextLoadedRef.current = false
			void loadPlayerDetail(player)
			setRecentPlayers(previous => {
				const next = [
					player,
					...previous.filter(item => item.id !== player.id)
				].slice(0, RECENT_PLAYERS_MAX)
				writeRecentPlayers(storageKey, next)
				return next
			})
		},
		[evidenceLoaded, loadPlayerDetail, storageKey]
	)

	const selectPlayerById = useCallback(
		async (playerId: number, opts?: { silentNotFound?: boolean }) => {
			if (!eventId) {
				setError(t('currentGameweekUnavailable'))
				return null
			}
			if (!Number.isInteger(playerId) || playerId <= 0) return null
			setIsLoading(true)
			setError(null)
			setStateError(null)
			setStateContextError(null)
			setPlayerDetail(null)
			setPlayerStateProfile(null)
			setSelectedPlayer({
				id: String(playerId),
				name: '',
				position: 'MID',
				teamShortName: '',
				teamName: ''
			})

			const result = await loadPlayerDetail({
				id: String(playerId),
				name: '',
				position: 'MID',
				teamShortName: '',
				teamName: ''
			})

			if (result.status === 'superseded') return null

			if (result.status !== 'loaded') {
				setSelectedPlayer(null)
				if (result.status === 'not-found' && !opts?.silentNotFound) {
					setError(t('playerNotFound'))
				}
				return null
			}

			const player = playerDetailToDirectoryOption(result.detail)
			setSelectedPlayer(player)
			setRecentPlayers(previous => {
				const next = [
					player,
					...previous.filter(item => item.id !== player.id)
				].slice(0, RECENT_PLAYERS_MAX)
				writeRecentPlayers(storageKey, next)
				return next
			})
			return result.detail
		},
		[eventId, loadPlayerDetail, storageKey, t]
	)

	const clearSelection = useCallback(() => {
		requestIdRef.current += 1
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
	}, [evidenceLoaded])

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
