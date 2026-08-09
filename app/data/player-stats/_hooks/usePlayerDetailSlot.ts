'use client'

import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_PLAYER_EVIDENCE_FIXTURES,
	GET_PLAYER_EVIDENCE_PROCESS,
	GET_PLAYER_EVIDENCE_PRODUCTION,
	GET_PLAYER_EVIDENCE_RECENT,
	GET_PLAYER_OVERALL,
	GET_PLAYER_STATE_PROFILE,
	type PlayerDetailData,
	type PlayerDetailResponse,
	type PlayerStateProfileData,
	type PlayerStateProfileResponse
} from '@/lib/graphql/operations/players'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { playerDetailToDirectoryOption } from '../_lib/player-detail-option'

const STORAGE_VERSION = 1
const RECENT_PLAYERS_MAX = 5

export type PlayerEvidenceSection = 'fixtures' | 'recent' | 'season' | 'process'

interface StoredRecentPlayers {
	version: typeof STORAGE_VERSION
	players: PlayerDirectoryOption[]
}

function isPlayerDirectoryOption(
	value: unknown
): value is PlayerDirectoryOption {
	if (!value || typeof value !== 'object') return false
	const player = value as Partial<PlayerDirectoryOption>
	return (
		typeof player.id === 'string' &&
		typeof player.name === 'string' &&
		typeof player.position === 'string' &&
		typeof player.teamShortName === 'string' &&
		typeof player.teamName === 'string'
	)
}

function readRecentPlayers(storageKey: string): PlayerDirectoryOption[] {
	try {
		const raw = window.localStorage.getItem(storageKey)
		if (!raw) return []
		const parsed: unknown = JSON.parse(raw)
		const candidates = Array.isArray(parsed)
			? parsed
			: (parsed as Partial<StoredRecentPlayers>)?.version === STORAGE_VERSION
				? (parsed as Partial<StoredRecentPlayers>).players
				: []
		return Array.isArray(candidates)
			? candidates.filter(isPlayerDirectoryOption).slice(0, RECENT_PLAYERS_MAX)
			: []
	} catch {
		return []
	}
}

function writeRecentPlayers(
	storageKey: string,
	players: PlayerDirectoryOption[]
) {
	try {
		const value: StoredRecentPlayers = {
			version: STORAGE_VERSION,
			players: players.slice(0, RECENT_PLAYERS_MAX)
		}
		window.localStorage.setItem(storageKey, JSON.stringify(value))
	} catch {
		// Storage is optional; comparison still works when it is unavailable.
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
	const [error, setError] = useState<string | null>(null)
	const [stateError, setStateError] = useState<string | null>(null)
	const [isEvidenceLoading, setIsEvidenceLoading] = useState(false)
	const [evidenceError, setEvidenceError] = useState<string | null>(null)
	const evidenceLoadedRef = useRef<Set<PlayerEvidenceSection>>(new Set())
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
		async (player: PlayerDirectoryOption) => {
			if (!eventId) {
				setError(t('currentGameweekUnavailable'))
				return null
			}
			const requestId = requestIdRef.current + 1
			requestIdRef.current = requestId
			setIsLoading(true)
			setIsStateLoading(true)
			setIsEvidenceLoading(false)
			setError(null)
			setStateError(null)
			setEvidenceError(null)
			evidenceLoaded().clear()

			void executeQuery<PlayerStateProfileResponse>(GET_PLAYER_STATE_PROFILE, {
				playerId: Number(player.id),
				horizon: 5
			})
				.then(response => {
					if (requestId !== requestIdRef.current) return
					setPlayerStateProfile(response.playerStateProfile)
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
				if (requestId !== requestIdRef.current) return null
				setPlayerDetail(response.playerDetail)
				return response.playerDetail
			} catch {
				if (requestId !== requestIdRef.current) return null
				setPlayerDetail(null)
				setError(t('loadFailed'))
				return null
			} finally {
				if (requestId === requestIdRef.current) setIsLoading(false)
			}
		},
		[eventId, evidenceLoaded, t]
	)

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
				const response = await executeQuery<{ playerDetail: Partial<PlayerDetailData> | null }>(queryBySection[section], {
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
				if (requestId === requestIdRef.current) setEvidenceError(t('evidenceLoadFailed'))
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
			setEvidenceError(null)
			evidenceLoaded().clear()
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
			setPlayerDetail(null)
			setPlayerStateProfile(null)
			setSelectedPlayer({
				id: String(playerId),
				name: '',
				position: 'MID',
				teamShortName: '',
				teamName: ''
			})

			const detail = await loadPlayerDetail({
				id: String(playerId),
				name: '',
				position: 'MID',
				teamShortName: '',
				teamName: ''
			})

			if (!detail) {
				setSelectedPlayer(null)
				if (!opts?.silentNotFound) setError(t('playerNotFound'))
				return null
			}

			const player = playerDetailToDirectoryOption(detail)
			setSelectedPlayer(player)
			setRecentPlayers(previous => {
				const next = [
					player,
					...previous.filter(item => item.id !== player.id)
				].slice(0, RECENT_PLAYERS_MAX)
				writeRecentPlayers(storageKey, next)
				return next
			})
			return detail
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
		setIsLoading(false)
			setIsStateLoading(false)
			setIsEvidenceLoading(false)
			setEvidenceError(null)
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
		error,
		stateError,
		isEvidenceLoading,
		evidenceError,
		loadEvidence,
		selectPlayer,
		selectPlayerById,
		clearSelection,
		clearRecent
	}
}
