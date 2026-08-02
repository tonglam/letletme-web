'use client'

import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_PLAYER_DETAIL,
	type PlayerDetailData,
	type PlayerDetailResponse,
} from '@/lib/graphql/operations/players'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

const STORAGE_VERSION = 1
const RECENT_PLAYERS_MAX = 5

interface StoredRecentPlayers {
	version: typeof STORAGE_VERSION
	players: PlayerDirectoryOption[]
}

function isPlayerDirectoryOption(value: unknown): value is PlayerDirectoryOption {
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

function writeRecentPlayers(storageKey: string, players: PlayerDirectoryOption[]) {
	try {
		const value: StoredRecentPlayers = {
			version: STORAGE_VERSION,
			players: players.slice(0, RECENT_PLAYERS_MAX),
		}
		window.localStorage.setItem(storageKey, JSON.stringify(value))
	} catch {
		// Storage is optional; comparison still works when it is unavailable.
	}
}

export function usePlayerDetailSlot({
	storageKey,
	eventId,
}: {
	storageKey: string
	eventId?: number
}) {
	const t = useTranslations('PlayerStats')
	const [selectedPlayer, setSelectedPlayer] = useState<PlayerDirectoryOption | null>(null)
	const [recentPlayers, setRecentPlayers] = useState<PlayerDirectoryOption[]>([])
	const [playerDetail, setPlayerDetail] = useState<PlayerDetailData | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const requestIdRef = useRef(0)

	useEffect(() => {
		let cancelled = false
		queueMicrotask(() => {
			if (!cancelled) setRecentPlayers(readRecentPlayers(storageKey))
		})
		return () => {
			cancelled = true
		}
	}, [storageKey])

	const loadPlayerDetail = useCallback(async (player: PlayerDirectoryOption) => {
		if (!eventId) {
			setError(t('currentGameweekUnavailable'))
			return
		}
		const requestId = requestIdRef.current + 1
		requestIdRef.current = requestId
		setIsLoading(true)
		setError(null)

		try {
			const response = await executeQuery<PlayerDetailResponse>(GET_PLAYER_DETAIL, {
				playerId: Number(player.id),
				eventId,
			})
			if (requestId !== requestIdRef.current) return
			setPlayerDetail(response.playerDetail)
		} catch {
			if (requestId !== requestIdRef.current) return
			setPlayerDetail(null)
			setError(t('loadFailed'))
		} finally {
			if (requestId === requestIdRef.current) setIsLoading(false)
		}
	}, [eventId, t])

	const selectPlayer = useCallback((player: PlayerDirectoryOption) => {
		setSelectedPlayer(player)
		setPlayerDetail(null)
		setError(null)
		void loadPlayerDetail(player)
		setRecentPlayers(previous => {
			const next = [player, ...previous.filter(item => item.id !== player.id)].slice(
				0,
				RECENT_PLAYERS_MAX,
			)
			writeRecentPlayers(storageKey, next)
			return next
		})
	}, [loadPlayerDetail, storageKey])

	const clearSelection = useCallback(() => {
		requestIdRef.current += 1
		setSelectedPlayer(null)
		setPlayerDetail(null)
		setError(null)
		setIsLoading(false)
	}, [])

	const clearRecent = useCallback(() => {
		try {
			window.localStorage.removeItem(storageKey)
		} catch {
			// Storage is optional.
		}
		setRecentPlayers([])
		clearSelection()
	}, [clearSelection, storageKey])

	return {
		selectedPlayer,
		recentPlayers,
		playerDetail,
		isLoading,
		error,
		selectPlayer,
		clearSelection,
		clearRecent,
	}
}
