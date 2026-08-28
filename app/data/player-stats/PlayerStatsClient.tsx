'use client'

import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { createPerformanceCorrelationId } from '@/lib/analytics/performance-correlation'
import { markRouteReadyStart } from '@/lib/analytics/route-navigation'
import type { PlayerDirectorySeed } from '@/lib/player-directory-seed'
import type { PlayerStatsDeskResponse } from '@/lib/player-stats-desk'
import { primePlayerStatsDeskCache } from '@/lib/player-stats-desk-client'
import { positionCodeFromElementTypeName } from '@/lib/squad-picks'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MySquadRail } from './_components/MySquadRail'
import { PlayerSelectionPanel } from './_components/PlayerSelectionPanel'
import { usePlayerStatsPersonalSeed } from './PlayerStatsPersonalSeedContext'
import { usePlayerDetailSlot } from './_hooks/usePlayerDetailSlot'
import {
	buildPlayerStatsQueryString,
	playerStatsSectionFromHash
} from './_lib/player-stats-url'

const RECENT_PLAYERS_KEY_1 = 'player-stats-recent-1'
const RECENT_PLAYERS_KEY_2 = 'player-stats-recent-2'

const loadPlayerStatsView = () =>
	import('./_components/PlayerStatsView').then(module => module.PlayerStatsView)

const PlayerStatsView = dynamic(loadPlayerStatsView, {
	loading: () => (
		<div
			className="min-h-72 animate-pulse rounded-xl border border-border/70 bg-muted/20"
			role="status"
			aria-label="Loading player details"
		/>
	)
})

export default function PlayerStatsClient({
	initialPlayerIds,
	directorySeed,
	initialDeskSeed = null,
	navigationId
}: {
	initialPlayerIds: { p1: number | null; p2: number | null }
	directorySeed: PlayerDirectorySeed
	initialDeskSeed?: PlayerStatsDeskResponse | null
	navigationId: string
}) {
	const t = useTranslations('PlayerStats')
	const { seed: personalSeed, resolved: personalSeedResolved } =
		usePlayerStatsPersonalSeed()
	const { anchorGw, seasonStatsAvailable, seasonStatsStatus } = directorySeed
	const mySquadPicks = personalSeed?.mySquadPicks ?? []
	const marketCompareCandidates = personalSeed?.marketCompareCandidates
	const initialFirstEntry = initialDeskSeed?.entries.find(
		entry => entry.playerId === initialPlayerIds.p1
	)
	const initialSecondEntry = initialDeskSeed?.entries.find(
		entry => entry.playerId === initialPlayerIds.p2
	)
	const firstPlayer = usePlayerDetailSlot({
		storageKey: RECENT_PLAYERS_KEY_1,
		eventId: anchorGw,
		initialEntry: initialFirstEntry,
		navigationId
	})
	const secondPlayer = usePlayerDetailSlot({
		storageKey: RECENT_PLAYERS_KEY_2,
		eventId: anchorGw,
		initialEntry: initialSecondEntry,
		navigationId
	})
	const firstSelectPlayer = firstPlayer.selectPlayer
	const firstSelectPlayerById = firstPlayer.selectPlayerById
	const firstClearSelection = firstPlayer.clearSelection
	const secondSelectPlayer = secondPlayer.selectPlayer
	const secondSelectPlayerById = secondPlayer.selectPlayerById
	const secondClearSelection = secondPlayer.clearSelection
	const firstSelectedPlayerId = firstPlayer.selectedPlayer?.id
	const secondSelectedPlayerId = secondPlayer.selectedPlayer?.id
	const [compareOpen, setCompareOpen] = useState(false)
	const [deepLinkReady, setDeepLinkReady] = useState(false)
	const [directoryReady, setDirectoryReady] = useState(
		directorySeed.playersState === 'ready'
	)
	const handleDirectoryReady = useCallback(() => setDirectoryReady(true), [])
	const deepLinkKey = `${initialPlayerIds.p1 ?? ''}:${initialPlayerIds.p2 ?? ''}`
	const deepLinkKeyRef = useRef<string | null>(null)
	type InteractionClock = {
		id: string
		targetKey: string
		readyKey: string
	}
	const [detailInteraction, setDetailInteraction] =
		useState<InteractionClock | null>(null)
	const [compareInteraction, setCompareInteraction] =
		useState<InteractionClock | null>(null)
	const beginLocalPlayerDetailLoad = useCallback(
		({
			firstPlayerId,
			secondPlayerId,
			scope = 'both'
		}: {
			firstPlayerId: number | string
			secondPlayerId?: number | string | null
			scope?: 'detail' | 'compare' | 'both'
		}): {
			interactionId: string
			detail: InteractionClock
			compare: InteractionClock | null
		} => {
			void loadPlayerStatsView()
			const interactionId = createPerformanceCorrelationId('interaction')
			const startedAt = performance.now()
			const detailTargetKey = String(firstPlayerId)
			const detail = {
				id: interactionId,
				targetKey: detailTargetKey,
				readyKey: `detail:${detailTargetKey}:${interactionId}`
			}
			const compareTargetKey =
				secondPlayerId == null
					? null
					: `${detailTargetKey}:${String(secondPlayerId)}`
			const compare = compareTargetKey
				? {
						id: interactionId,
						targetKey: compareTargetKey,
						readyKey: `compare:${compareTargetKey}:${interactionId}`
					}
				: null
			if (scope === 'detail' || scope === 'both') {
				markRouteReadyStart(
					window.location.pathname,
					startedAt,
					detail.readyKey
				)
			}
			if ((scope === 'compare' || scope === 'both') && compare) {
				markRouteReadyStart(
					window.location.pathname,
					startedAt,
					compare.readyKey
				)
			}
			return { interactionId, detail, compare }
		},
		[]
	)

	useEffect(() => {
		if (!initialDeskSeed || initialDeskSeed.section !== 'overview') return
		primePlayerStatsDeskCache(
			{
				playerIds: initialDeskSeed.entries.map(entry => entry.playerId),
				eventId: initialDeskSeed.eventId,
				horizon: initialDeskSeed.horizon,
				section: 'overview'
			},
			initialDeskSeed
		)
	}, [initialDeskSeed])

	const syncUrl = useCallback(() => {
		if (typeof window === 'undefined') return
		const params = buildPlayerStatsQueryString({
			p1: firstPlayer.selectedPlayer?.id,
			p2: secondPlayer.selectedPlayer?.id
		})
		const hash = window.location.hash
		const path = window.location.pathname
		const next = params ? `${path}?${params}${hash}` : `${path}${hash}`
		window.history.replaceState(null, '', next)
	}, [firstPlayer.selectedPlayer?.id, secondPlayer.selectedPlayer?.id])

	useEffect(() => {
		if (!deepLinkReady) return
		syncUrl()
	}, [deepLinkReady, syncUrl])

	useEffect(() => {
		if (deepLinkKeyRef.current === deepLinkKey) return
		deepLinkKeyRef.current = deepLinkKey
		setDeepLinkReady(false)
		setDetailInteraction(null)
		setCompareInteraction(null)

		const seed = async () => {
			if (initialPlayerIds.p1 == null) {
				firstClearSelection()
				secondClearSelection()
				setCompareOpen(false)
				setDeepLinkReady(true)
				return
			}
			const initialSeedReady =
				firstPlayer.playerDetail?.id === initialPlayerIds.p1 &&
				(initialPlayerIds.p2 == null ||
					secondPlayer.playerDetail?.id === initialPlayerIds.p2)
			if (initialSeedReady) {
				setCompareOpen(initialPlayerIds.p2 != null)
				setDeepLinkReady(true)
				const section = playerStatsSectionFromHash(window.location.hash)
				if (section) {
					window.requestAnimationFrame(() => {
						document
							.getElementById(`ps-${section}`)
							?.scrollIntoView({ behavior: 'smooth', block: 'start' })
					})
				}
				return
			}
			const batchPlayerIds = [initialPlayerIds.p1, initialPlayerIds.p2].filter(
				(value): value is number => value != null
			)
			const firstDetail = await firstSelectPlayerById(initialPlayerIds.p1, {
				silentNotFound: true,
				batchPlayerIds
			})
			if (firstDetail && initialPlayerIds.p2 != null) {
				const secondDetail = await secondSelectPlayerById(initialPlayerIds.p2, {
					silentNotFound: true,
					batchPlayerIds
				})
				setCompareOpen(Boolean(secondDetail))
			} else {
				secondClearSelection()
				setCompareOpen(false)
			}
			setDeepLinkReady(true)
			const section = playerStatsSectionFromHash(window.location.hash)
			if (section) {
				window.requestAnimationFrame(() => {
					const el = document.getElementById(`ps-${section}`)
					el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
				})
			}
		}

		void seed()
	}, [
		initialPlayerIds.p1,
		initialPlayerIds.p2,
		deepLinkKey,
		firstClearSelection,
		firstSelectPlayerById,
		secondSelectPlayerById,
		secondClearSelection,
		firstPlayer.playerDetail?.id,
		secondPlayer.playerDetail?.id
	])

	const playerOnePositionCode = useMemo(() => {
		if (!firstPlayer.playerDetail) return null
		return positionCodeFromElementTypeName(
			firstPlayer.playerDetail.elementTypeName
		)
	}, [firstPlayer.playerDetail])

	const handleSquadSelect = useCallback(
		(playerId: number) => {
			const nextSecondPlayerId =
				secondSelectedPlayerId === String(playerId)
					? null
					: secondSelectedPlayerId
			const interaction = beginLocalPlayerDetailLoad({
				firstPlayerId: playerId,
				secondPlayerId: nextSecondPlayerId
			})
			setDetailInteraction(interaction.detail)
			setCompareInteraction(interaction.compare)
			if (secondSelectedPlayerId === String(playerId)) {
				secondClearSelection()
				setCompareOpen(false)
			}
			void firstSelectPlayerById(playerId, {
				interactionId: interaction.interactionId,
				batchPlayerIds: [playerId, Number(secondSelectedPlayerId)].filter(
					value => Number.isInteger(value) && value > 0
				)
			})
		},
		[
			beginLocalPlayerDetailLoad,
			firstSelectPlayerById,
			secondClearSelection,
			secondSelectedPlayerId
		]
	)

	const handleFirstSelect = useCallback(
		(player: Parameters<typeof firstSelectPlayer>[0]) => {
			const nextSecondPlayerId =
				secondSelectedPlayerId === player.id ? null : secondSelectedPlayerId
			const interaction = beginLocalPlayerDetailLoad({
				firstPlayerId: player.id,
				secondPlayerId: nextSecondPlayerId
			})
			setDetailInteraction(interaction.detail)
			setCompareInteraction(interaction.compare)
			if (secondSelectedPlayerId === player.id) {
				secondClearSelection()
				setCompareOpen(false)
			}
			firstSelectPlayer(
				player,
				[player.id, secondSelectedPlayerId]
					.map(Number)
					.filter(value => Number.isInteger(value) && value > 0),
				{ interactionId: interaction.interactionId }
			)
		},
		[
			beginLocalPlayerDetailLoad,
			firstSelectPlayer,
			secondClearSelection,
			secondSelectedPlayerId
		]
	)

	const handleSecondSelect = useCallback(
		(player: Parameters<typeof secondSelectPlayer>[0]) => {
			if (player.id === firstSelectedPlayerId) return
			const interaction = beginLocalPlayerDetailLoad({
				firstPlayerId: firstSelectedPlayerId ?? '',
				secondPlayerId: player.id,
				scope: 'compare'
			})
			setCompareInteraction(interaction.compare)
			secondSelectPlayer(
				player,
				[player.id, firstSelectedPlayerId]
					.map(Number)
					.filter(value => Number.isInteger(value) && value > 0),
				{ interactionId: interaction.interactionId }
			)
		},
		[beginLocalPlayerDetailLoad, firstSelectedPlayerId, secondSelectPlayer]
	)

	const marketSuggestions = useMemo(() => {
		if (!playerOnePositionCode) return []
		const excludeId = firstSelectedPlayerId
		return (marketCompareCandidates ?? [])
			.filter(c => c.positionCode === playerOnePositionCode)
			.filter(c => excludeId == null || String(c.playerId) !== excludeId)
			.slice(0, 8)
			.map(c => ({
				id: String(c.playerId),
				name: c.webName,
				teamShortName: c.teamShortName,
				badge:
					c.bucket === 'popular-favourable'
						? t('marketComparePopularFavourable')
						: t('marketCompareDifferentialFavourable')
			}))
	}, [marketCompareCandidates, playerOnePositionCode, firstSelectedPlayerId, t])

	const handleMarketSuggestionSelect = useCallback(
		(playerId: string) => {
			const id = Number(playerId)
			if (!Number.isFinite(id)) return
			if (firstSelectedPlayerId === playerId) return
			const interaction = beginLocalPlayerDetailLoad({
				firstPlayerId: firstSelectedPlayerId ?? '',
				secondPlayerId: id,
				scope: 'compare'
			})
			setCompareInteraction(interaction.compare)
			setCompareOpen(true)
			void secondSelectPlayerById(id, {
				interactionId: interaction.interactionId,
				batchPlayerIds: [id, Number(firstSelectedPlayerId)].filter(
					value => Number.isInteger(value) && value > 0
				)
			})
		},
		[beginLocalPlayerDetailLoad, firstSelectedPlayerId, secondSelectPlayerById]
	)

	const pickerStatsAvailable =
		firstPlayer.playerDetail?.statsContext.status === 'AVAILABLE' ||
		(firstPlayer.playerDetail == null && seasonStatsAvailable)
	const personalSeedReady =
		personalSeedResolved && personalSeed?.squadState === 'ready'
	const currentDetailInteraction =
		detailInteraction?.targetKey === firstSelectedPlayerId
			? detailInteraction
			: null
	const currentCompareInteraction =
		compareInteraction?.targetKey ===
		`${firstSelectedPlayerId ?? ''}:${secondSelectedPlayerId ?? ''}`
			? compareInteraction
			: null
	const playerDetailReady =
		Boolean(firstPlayer.playerDetail) &&
		!firstPlayer.isLoading &&
		firstPlayer.playerDetail?.id === Number(firstSelectedPlayerId)
	const playerCompareReady =
		secondSelectedPlayerId != null &&
		Boolean(firstPlayer.playerDetail) &&
		Boolean(secondPlayer.playerDetail) &&
		!firstPlayer.isLoading &&
		!secondPlayer.isLoading
	const playerDetailReadyKey =
		currentDetailInteraction?.readyKey ??
		`detail:${firstSelectedPlayerId ?? ''}`
	const playerCompareReadyKey =
		currentCompareInteraction?.readyKey ??
		`compare:${firstSelectedPlayerId ?? ''}:${secondSelectedPlayerId ?? ''}`
	const personalStatus = !personalSeedResolved
		? null
		: personalSeed?.squadState === 'not-published'
			? t('squadNotPublished')
			: personalSeed?.squadState === 'unbound'
				? t('squadUnbound')
				: t('personalContextUnavailable')

	return (
		<>
			<RouteReadyMarker
				name="PLAYER_DIRECTORY_READY"
				ready={directoryReady}
				navigationId={navigationId}
				audienceHint="public"
				goodMs={1_000}
				poorMs={1_500}
			/>
			<RouteReadyMarker
				name="PLAYER_DIRECTORY_PAINT"
				ready={directoryReady}
				elementTiming="player-directory-result"
				navigationId={navigationId}
				audienceHint="public"
				goodMs={1_000}
				poorMs={1_500}
			/>
			<RouteReadyMarker
				name="PLAYER_DETAIL_READY"
				ready={playerDetailReady}
				readyKey={playerDetailReadyKey}
				navigationId={navigationId}
				interactionId={currentDetailInteraction?.id}
				audienceHint="public"
				goodMs={1_000}
				poorMs={1_500}
			/>
			<RouteReadyMarker
				name="PLAYER_DETAIL_PAINT"
				ready={playerDetailReady}
				readyKey={playerDetailReadyKey}
				elementTiming="player-detail-card"
				navigationId={navigationId}
				interactionId={currentDetailInteraction?.id}
				audienceHint="public"
				goodMs={1_000}
				poorMs={1_500}
			/>
			<RouteReadyMarker
				name="PLAYER_COMPARE_READY"
				ready={playerCompareReady}
				readyKey={playerCompareReadyKey}
				navigationId={navigationId}
				interactionId={currentCompareInteraction?.id}
				audienceHint="public"
				goodMs={1_000}
				poorMs={1_500}
			/>
			<RouteReadyMarker
				name="PLAYER_COMPARE_PAINT"
				ready={playerCompareReady}
				readyKey={playerCompareReadyKey}
				elementTiming="player-detail-card"
				navigationId={navigationId}
				interactionId={currentCompareInteraction?.id}
				audienceHint="public"
				goodMs={1_000}
				poorMs={1_500}
			/>
			<div
				className={cn(
					'mb-4 h-44 overflow-y-auto rounded-lg border border-border/60 px-3 py-3 sm:h-36',
					personalSeedReady
						? 'bg-muted/10'
						: 'flex items-center text-sm text-muted-foreground',
					!personalSeedResolved && 'animate-pulse bg-muted/20'
				)}
				data-player-stats-navigation-id={navigationId}
				aria-busy={!personalSeedResolved}
				role={
					personalSeedReady
						? undefined
						: personalSeed?.squadState === 'unavailable'
							? 'alert'
							: 'status'
				}
				aria-label={
					personalSeedResolved ? undefined : t('personalContextLoading')
				}
			>
				{personalSeedReady ? (
					<MySquadRail
						picks={mySquadPicks}
						selectedPlayerId={firstPlayer.selectedPlayer?.id}
						onSelect={handleSquadSelect}
					/>
				) : (
					personalStatus
				)}
			</div>

			<PlayerSelectionPanel
				first={{
					selectedPlayer: firstPlayer.selectedPlayer,
					recentPlayers: firstPlayer.recentPlayers,
					excludedPlayerId: secondPlayer.selectedPlayer?.id,
					onSelect: handleFirstSelect,
					onClearRecent: firstPlayer.clearRecent
				}}
				compareOpen={compareOpen}
				onAddCompare={() => setCompareOpen(true)}
				canCompare={Boolean(firstPlayer.playerDetail)}
				statsAvailable={pickerStatsAvailable}
				directorySeed={directorySeed}
				onDirectoryReady={handleDirectoryReady}
				marketSuggestions={compareOpen ? marketSuggestions : undefined}
				onSelectMarketSuggestion={handleMarketSuggestionSelect}
				second={
					compareOpen
						? {
								selectedPlayer: secondPlayer.selectedPlayer,
								recentPlayers: secondPlayer.recentPlayers,
								excludedPlayerId: firstPlayer.selectedPlayer?.id,
								onSelect: handleSecondSelect,
								onClearRecent: secondPlayer.clearRecent,
								onClearSelection: () => {
									secondPlayer.clearSelection()
									setCompareInteraction(null)
									setCompareOpen(false)
								}
							}
						: null
				}
			/>

			{initialPlayerIds.p1 != null ||
			firstPlayer.selectedPlayer ||
			firstPlayer.isLoading ||
			firstPlayer.error ? (
				<PlayerStatsView
					selectedPlayer={firstPlayer.selectedPlayer}
					selectedComparison={secondPlayer.selectedPlayer}
					player={firstPlayer.playerDetail}
					comparison={secondPlayer.playerDetail}
					playerState={firstPlayer.playerStateProfile}
					comparisonState={secondPlayer.playerStateProfile}
					isLoading={firstPlayer.isLoading}
					isComparisonLoading={secondPlayer.isLoading}
					isStateLoading={firstPlayer.isStateLoading}
					isComparisonStateLoading={secondPlayer.isStateLoading}
					error={firstPlayer.error}
					comparisonError={secondPlayer.error}
					stateError={firstPlayer.stateError}
					comparisonStateError={secondPlayer.stateError}
					retryPlayerData={() => {
						if (!firstPlayer.selectedPlayer) return
						const batchPlayerIds = [
							firstSelectedPlayerId,
							secondSelectedPlayerId
						]
							.map(Number)
							.filter(value => Number.isInteger(value) && value > 0)
						firstPlayer.selectPlayer(firstPlayer.selectedPlayer, batchPlayerIds)
						if (secondPlayer.selectedPlayer) {
							secondPlayer.selectPlayer(
								secondPlayer.selectedPlayer,
								batchPlayerIds
							)
						}
					}}
					loadEvidence={section =>
						firstPlayer.loadEvidence(
							section,
							[firstSelectedPlayerId, secondSelectedPlayerId]
								.map(Number)
								.filter(value => Number.isInteger(value) && value > 0)
						)
					}
					loadComparisonEvidence={section =>
						secondPlayer.loadEvidence(
							section,
							[firstSelectedPlayerId, secondSelectedPlayerId]
								.map(Number)
								.filter(value => Number.isInteger(value) && value > 0)
						)
					}
					loadStateContext={() =>
						firstPlayer.loadStateContext(
							[firstSelectedPlayerId, secondSelectedPlayerId]
								.map(Number)
								.filter(value => Number.isInteger(value) && value > 0)
						)
					}
					loadComparisonStateContext={() =>
						secondPlayer.loadStateContext(
							[firstSelectedPlayerId, secondSelectedPlayerId]
								.map(Number)
								.filter(value => Number.isInteger(value) && value > 0)
						)
					}
					isEvidenceLoading={firstPlayer.isEvidenceLoading}
					isComparisonEvidenceLoading={secondPlayer.isEvidenceLoading}
					isStateContextLoading={firstPlayer.isStateContextLoading}
					isComparisonStateContextLoading={secondPlayer.isStateContextLoading}
					evidenceError={firstPlayer.evidenceError}
					comparisonEvidenceError={secondPlayer.evidenceError}
					stateContextError={firstPlayer.stateContextError}
					comparisonStateContextError={secondPlayer.stateContextError}
					anchorGw={anchorGw}
					seasonStatsAvailable={seasonStatsAvailable}
					seasonStatsStatus={seasonStatsStatus}
				/>
			) : null}
		</>
	)
}
