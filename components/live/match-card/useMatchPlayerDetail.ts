'use client'

import { executeQuery } from '@/lib/graphql-client'
import {
	GET_EVENT_LIVE_EXPLAIN,
	GET_PLAYER_LIVE,
	type EventLiveExplainResponse,
	type PlayerLiveResponse,
} from '@/lib/graphql/operations/live'
import type { Match, PlayerStat } from '@/types/match'
import type { PlayerDetail } from '@/types/player-detail'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { buildBreakdownFromPlayerLive, createBasePlayerDetail } from './match-card-model'

export function useMatchPlayerDetail(eventId?: number, match?: Match, sourceRevision?: string) {
	const [loadedPlayer, setSelectedPlayer] = useState<PlayerDetail | null>(null)
	const [isOpen, setIsOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [selection, setSelection] = useState<{ element?: number; name: string; teamShort: string; eventId?: number } | null>(null)
	const [detailSourceKey, setDetailSourceKey] = useState<string | null>(null)
	const currentTeam = selection && match
		? [match.homeTeam, match.awayTeam].find(team => team.shortName === selection.teamShort)
		: undefined
	const currentPlayer = selection && selection.eventId === eventId
		? currentTeam?.players.find(player => selection.element !== undefined
			? player.element === selection.element
			: player.player === selection.name)
		: undefined
	const sourceKey = currentPlayer && currentTeam
		? JSON.stringify([eventId, sourceRevision, match?.id, currentTeam.shortName, currentPlayer])
		: null
	const selectedPlayer = !match ? loadedPlayer : currentPlayer && currentTeam
		? detailSourceKey === sourceKey && loadedPlayer
			? loadedPlayer
			: createBasePlayerDetail(currentPlayer, currentTeam.name, currentTeam.shortName)
		: null
	const requestIdRef = useRef(0)
	const detailRequestsRef = useRef(new Map<string, Promise<[
		PromiseSettledResult<EventLiveExplainResponse>,
		PromiseSettledResult<PlayerLiveResponse>
	]>>())

	useEffect(() => {
		requestIdRef.current += 1
		setSelection(null)
		setSelectedPlayer(null)
		setIsOpen(false)
		setIsLoading(false)
		return () => {
			requestIdRef.current += 1
		}
	}, [eventId])

	useLayoutEffect(() => {
		// MatchCard can correlate against the current match snapshot. Other
		// consumers pass only an event ID and render the selected player directly;
		// their sourceKey is intentionally null, so comparing it would invalidate
		// every detail request as soon as a player is selected.
		if (match && detailSourceKey !== sourceKey) requestIdRef.current += 1
	}, [detailSourceKey, match, sourceKey])

	const openPlayerDetail = useCallback(async (player: PlayerStat, team: string, teamShort: string) => {
		const requestId = requestIdRef.current + 1
		requestIdRef.current = requestId
		const requestKey = JSON.stringify([eventId, sourceRevision, match?.id, teamShort, player])
		setSelection({ element: player.element, name: player.player, teamShort, eventId })
		setDetailSourceKey(requestKey)
		setSelectedPlayer(createBasePlayerDetail(player, team, teamShort))
		setIsOpen(true)
		setIsLoading(Boolean(player.element && eventId))
		if (!player.element || !eventId) return

		try {
			let request = detailRequestsRef.current.get(requestKey)
			if (!request) {
				// A changed publication must not reuse executeQuery's in-flight result
				// for the previous source revision. This cache only coalesces repeats
				// within the same player/source identity.
				const controller = new AbortController()
				request = Promise.allSettled([
					executeQuery<EventLiveExplainResponse>(
						GET_EVENT_LIVE_EXPLAIN,
						{ eventId, elementId: player.element },
						{ signal: controller.signal }
					),
					executeQuery<PlayerLiveResponse>(
						GET_PLAYER_LIVE,
						{ playerId: player.element, eventId },
						{ signal: controller.signal }
					)
				])
				detailRequestsRef.current.set(requestKey, request)
				void request.finally(() => {
					if (detailRequestsRef.current.get(requestKey) === request) {
						detailRequestsRef.current.delete(requestKey)
					}
				})
			}
			const [explainResult, liveResult] = await request
			if (requestIdRef.current !== requestId) return
			for (const result of [explainResult, liveResult]) {
				if (result.status === 'rejected') console.warn('Live player detail unavailable:', result.reason)
			}
			setSelectedPlayer((current) => {
				if (!current || requestIdRef.current !== requestId) return current
				const explanation = explainResult.status === 'fulfilled' ? explainResult.value.eventLiveExplain : null
				const explain = explanation?.elementId === player.element ? explanation : null
				const live = liveResult.status === 'fulfilled' ? liveResult.value.playerLive : null
				return {
					...current,
					name: explain?.player?.webName || current.name,
					ownershipPercentage: explain?.selectedBy ?? current.ownershipPercentage,
					points: live?.totalPoints ?? current.points,
					bps: live?.bps ?? current.bps,
					bonusPoints: live?.bonus ?? current.bonusPoints,
					stats: live
						? {
							minutes: live.minutes,
							goals: live.goalsScored,
							assists: live.assists,
							cleanSheets: live.cleanSheets,
							saves: live.saves,
							penaltiesSaved: live.penaltiesSaved,
							goalsConceded: live.goalsConceded,
							defensiveContribution: live.defensiveContribution,
							ownGoals: live.ownGoals,
							penaltiesMissed: live.penaltiesMissed,
							yellowCards: live.yellowCards,
							redCards: live.redCards,
						}
						: current.stats,
					// These rows are calculated from stats, not verified official explain.
					breakdownSource: live ? 'provisional' : current.breakdownSource,
					// Request loading has settled, but the scoring breakdown remains
					// pending until live stats can establish its contents.
					breakdownPending: live ? false : current.breakdownPending,
					pointsBreakdown: live
						? buildBreakdownFromPlayerLive(
								live,
								player.elementType ?? 3,
								explain?.contributions ?? [],
							)
						: current.pointsBreakdown,
				}
			})
		} catch (detailError) {
			console.warn('Live player detail unavailable:', detailError)
		} finally {
			if (requestIdRef.current === requestId) setIsLoading(false)
		}
	}, [eventId, match?.id, sourceRevision])

	useEffect(() => {
		if (
			!isOpen ||
			!currentPlayer ||
			!currentTeam ||
			!sourceKey ||
			detailSourceKey === sourceKey
		) return
		void openPlayerDetail(currentPlayer, currentTeam.name, currentTeam.shortName)
	}, [currentPlayer, currentTeam, detailSourceKey, isOpen, openPlayerDetail, sourceKey])

	const closePlayerDetail = useCallback(() => {
		requestIdRef.current += 1
		setIsOpen(false)
		setIsLoading(false)
	}, [])

	const sourceChanged = Boolean(match && currentPlayer && sourceKey && detailSourceKey !== sourceKey)
	return { closePlayerDetail, isLoading: isOpen && Boolean(selectedPlayer) && (isLoading || sourceChanged), isOpen: isOpen && selectedPlayer !== null, openPlayerDetail, selectedPlayer }
}
