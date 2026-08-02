'use client'

import { executeQuery } from '@/lib/graphql-client'
import {
	GET_EVENT_LIVE_EXPLAIN,
	GET_PLAYER_LIVE,
	type EventLiveExplainResponse,
	type PlayerLiveResponse,
} from '@/lib/graphql/operations/live'
import type { PlayerStat } from '@/types/match'
import type { PlayerDetail } from '@/types/player-detail'
import { useCallback, useRef, useState } from 'react'
import { buildBreakdownFromPlayerLive, createBasePlayerDetail } from './match-card-model'

export function useMatchPlayerDetail(eventId?: number) {
	const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetail | null>(null)
	const [isOpen, setIsOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const requestIdRef = useRef(0)

	const openPlayerDetail = useCallback(async (player: PlayerStat, team: string, teamShort: string) => {
		const requestId = requestIdRef.current + 1
		requestIdRef.current = requestId
		setSelectedPlayer(createBasePlayerDetail(player, team, teamShort))
		setIsOpen(true)
		setIsLoading(Boolean(player.element && eventId))
		if (!player.element || !eventId) return

		try {
			const [explainData, liveData] = await Promise.all([
				executeQuery<EventLiveExplainResponse>(GET_EVENT_LIVE_EXPLAIN, { eventId, elementId: player.element }),
				executeQuery<PlayerLiveResponse>(GET_PLAYER_LIVE, { playerId: player.element, eventId }),
			])
			if (requestIdRef.current !== requestId) return
			setSelectedPlayer((current) => {
				if (!current) return current
				const explain = explainData.eventLiveExplain
				const live = liveData.playerLive
				return {
					...current,
					name: explain?.player.webName || current.name,
					ownershipPercentage: explain?.selectedBy ?? current.ownershipPercentage,
					points: live?.totalPoints ?? current.points,
					bps: live?.bps ?? current.bps,
					bonusPoints: live?.bonus ?? current.bonusPoints,
					pointsBreakdown: live
						? buildBreakdownFromPlayerLive(live, player.elementType ?? 3)
						: current.pointsBreakdown,
				}
			})
		} catch (detailError) {
			console.warn('Live player detail unavailable:', detailError)
		} finally {
			if (requestIdRef.current === requestId) setIsLoading(false)
		}
	}, [eventId])

	const closePlayerDetail = useCallback(() => {
		requestIdRef.current += 1
		setIsOpen(false)
		setIsLoading(false)
	}, [])

	return { closePlayerDetail, isLoading, isOpen, openPlayerDetail, selectedPlayer }
}
