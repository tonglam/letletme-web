'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_EVENT_LIVE_EXPLAIN,
	GET_PLAYER_LIVE,
	type EventLiveExplainResponse,
	type PlayerLiveResponse
} from '@/lib/graphql/operations/live'
import type { Player } from '@/types/player'
import type { PlayerDetail } from '@/types/player-detail'
import {
	buildLivePlayerDetail,
	buildLivePlayerDetailWithPayload,
	type LivePlayerDetailPayload
} from '@/components/live/player-detail-model'

type LivePlayerSelection = {
	playerId: string
	eventId: number
}

type CachedPayload = {
	key: string
	payload: LivePlayerDetailPayload
}

/**
 * Keeps a pitch detail tied to the selected player and gameweek. The latest
 * players array remains authoritative, while a targeted explain/live request
 * fills a missing official breakdown. Request generations prevent a closed
 * modal or a fast player/GW switch from accepting a late response.
 */
export function useLivePlayerDetail({
	eventId,
	players
}: {
	eventId?: number
	players: Player[]
}): {
	closePlayerDetail: () => void
	isLoading: boolean
	isOpen: boolean
	openPlayerDetail: (playerId: string) => void
	selectedPlayer: PlayerDetail | null
} {
	const [selection, setSelection] = useState<LivePlayerSelection | null>(null)
	const [cachedPayload, setCachedPayload] = useState<CachedPayload | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const requestIdRef = useRef(0)

	const selectionKey = selection
		? `${selection.eventId}:${selection.playerId}`
		: null
	const selectedSourcePlayer = useMemo(() => {
		if (!selection || selection.eventId !== eventId) return null
		return (
			players.find(player => String(player.id) === selection.playerId) ?? null
		)
	}, [eventId, players, selection])

	const selectedPlayer = useMemo(() => {
		if (!selectedSourcePlayer) return null
		const base = buildLivePlayerDetail(selectedSourcePlayer)
		const payload =
			cachedPayload?.key === selectionKey ? cachedPayload.payload : null
		// A batch explanation can land while the targeted request is in flight.
		// Prefer that newer official result over an older targeted payload.
		if (!payload || base.breakdownSource === 'official') return base
		return buildLivePlayerDetailWithPayload(selectedSourcePlayer, payload)
	}, [cachedPayload, selectedSourcePlayer, selectionKey])

	const openPlayerDetail = useCallback(
		(playerId: string) => {
			if (!eventId || !Number.isSafeInteger(eventId) || eventId <= 0) return
			const player = players.find(candidate => String(candidate.id) === playerId)
			if (!player) return
			const nextKey = `${eventId}:${playerId}`
			requestIdRef.current += 1
			setSelection({ playerId, eventId })
			setCachedPayload(current =>
				current?.key === nextKey ? current : null
			)
			setIsLoading(true)
		},
		[eventId, players]
	)

	const closePlayerDetail = useCallback(() => {
		requestIdRef.current += 1
		setSelection(null)
		setCachedPayload(null)
		setIsLoading(false)
	}, [])

	useEffect(() => {
		if (!selection) {
			setIsLoading(false)
			return
		}
		if (selection.eventId !== eventId) {
			requestIdRef.current += 1
			setSelection(null)
			setCachedPayload(null)
			setIsLoading(false)
			return
		}
		// Keep the identity across a transient live-data refresh. The current
		// player array remains authoritative once it is available again.
		if (!selectedSourcePlayer) {
			setIsLoading(false)
			return
		}

		const base = buildLivePlayerDetail(selectedSourcePlayer)
		const elementId = Number(selectedSourcePlayer.id)
		if (
			!Number.isSafeInteger(elementId) ||
			elementId <= 0 ||
			base.breakdownSource === 'official' ||
			cachedPayload?.key === selectionKey
		) {
			setIsLoading(false)
			return
		}

		const requestId = ++requestIdRef.current
		let cancelled = false
		setIsLoading(true)
		void Promise.allSettled([
			executeQuery<EventLiveExplainResponse>(
				GET_EVENT_LIVE_EXPLAIN,
				{ eventId: selection.eventId, elementId },
				{ cache: 'no-store', suppressErrorLog: true }
			),
			executeQuery<PlayerLiveResponse>(
				GET_PLAYER_LIVE,
				{ playerId: elementId, eventId: selection.eventId },
				{ cache: 'no-store', suppressErrorLog: true }
			)
		]).then(([explainResult, liveResult]) => {
			if (
				cancelled ||
				requestId !== requestIdRef.current ||
				selectionKey !==
					(selection
						? `${selection.eventId}:${selection.playerId}`
						: null)
			) {
				return
			}
			const payload: LivePlayerDetailPayload = {
				explain:
					explainResult.status === 'fulfilled'
						? explainResult.value.eventLiveExplain
						: null,
				live:
					liveResult.status === 'fulfilled'
						? liveResult.value.playerLive
						: null
			}
			setCachedPayload({ key: selectionKey!, payload })
		}).finally(() => {
			if (!cancelled && requestId === requestIdRef.current) {
				setIsLoading(false)
			}
		})

		return () => {
			cancelled = true
			requestIdRef.current += 1
		}
	}, [cachedPayload, eventId, selectedSourcePlayer, selection, selectionKey])

	return {
		closePlayerDetail,
		isLoading,
		isOpen: selectedPlayer !== null,
		openPlayerDetail,
		selectedPlayer
	}
}
