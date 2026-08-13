'use client'

import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import type { PlayerDirectorySeed } from '@/lib/player-directory-seed'
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

const PlayerStatsView = dynamic(
	() =>
		import('./_components/PlayerStatsView').then(
			module => module.PlayerStatsView
		),
	{
		loading: () => (
			<div
				className="min-h-72 animate-pulse rounded-xl border border-border/70 bg-muted/20"
				role="status"
				aria-label="Loading player details"
			/>
		)
	}
)

export default function PlayerStatsClient({
	initialPlayerIds,
	directorySeed
}: {
	initialPlayerIds: { p1: number | null; p2: number | null }
	directorySeed: PlayerDirectorySeed
}) {
	const t = useTranslations('PlayerStats')
	const { seed: personalSeed, resolved: personalSeedResolved } =
		usePlayerStatsPersonalSeed()
	const { anchorGw, seasonStatsAvailable } = directorySeed
	const mySquadPicks = personalSeed?.mySquadPicks ?? []
	const marketCompareCandidates = personalSeed?.marketCompareCandidates
	const firstPlayer = usePlayerDetailSlot({
		storageKey: RECENT_PLAYERS_KEY_1,
		eventId: anchorGw
	})
	const secondPlayer = usePlayerDetailSlot({
		storageKey: RECENT_PLAYERS_KEY_2,
		eventId: anchorGw
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
	const deepLinkKey = `${initialPlayerIds.p1 ?? ''}:${initialPlayerIds.p2 ?? ''}`
	const deepLinkKeyRef = useRef<string | null>(null)

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

		const seed = async () => {
			if (initialPlayerIds.p1 == null) {
				firstClearSelection()
				secondClearSelection()
				setCompareOpen(false)
				setDeepLinkReady(true)
				return
			}
			const firstDetail = await firstSelectPlayerById(initialPlayerIds.p1, {
				silentNotFound: true
			})
			if (firstDetail && initialPlayerIds.p2 != null) {
				const secondDetail = await secondSelectPlayerById(initialPlayerIds.p2, {
					silentNotFound: true
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
		secondClearSelection
	])

	const playerOnePositionCode = useMemo(() => {
		if (!firstPlayer.playerDetail) return null
		return positionCodeFromElementTypeName(
			firstPlayer.playerDetail.elementTypeName
		)
	}, [firstPlayer.playerDetail])

	const handleSquadSelect = useCallback(
		(playerId: number) => {
			if (secondSelectedPlayerId === String(playerId)) {
				secondClearSelection()
				setCompareOpen(false)
			}
			void firstSelectPlayerById(playerId)
		},
		[firstSelectPlayerById, secondClearSelection, secondSelectedPlayerId]
	)

	const handleFirstSelect = useCallback(
		(player: Parameters<typeof firstSelectPlayer>[0]) => {
			if (secondSelectedPlayerId === player.id) {
				secondClearSelection()
				setCompareOpen(false)
			}
			firstSelectPlayer(player)
		},
		[firstSelectPlayer, secondClearSelection, secondSelectedPlayerId]
	)

	const handleSecondSelect = useCallback(
		(player: Parameters<typeof secondSelectPlayer>[0]) => {
			if (player.id === firstSelectedPlayerId) return
			secondSelectPlayer(player)
		},
		[firstSelectedPlayerId, secondSelectPlayer]
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
			setCompareOpen(true)
			void secondSelectPlayerById(id)
		},
		[firstSelectedPlayerId, secondSelectPlayerById]
	)

	const pickerStatsAvailable =
		firstPlayer.playerDetail?.statsContext.scope === 'CURRENT_SEASON' ||
		(firstPlayer.playerDetail == null && seasonStatsAvailable)
	const personalSeedReady =
		personalSeedResolved && personalSeed?.squadState === 'ready'
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
				ready={directorySeed.playersState === 'ready'}
				audienceHint="public"
				goodMs={3_000}
				poorMs={4_500}
			/>
			<RouteReadyMarker
				name="PLAYER_DETAIL_READY"
				ready={Boolean(firstPlayer.playerDetail)}
				audienceHint="public"
				goodMs={3_500}
				poorMs={5_000}
			/>
			<div
				className={cn(
					'mb-4 h-44 overflow-y-auto rounded-lg border border-border/60 px-3 py-3 sm:h-36',
					personalSeedReady
						? 'bg-muted/10'
						: 'flex items-center text-sm text-muted-foreground',
					!personalSeedResolved && 'animate-pulse bg-muted/20'
				)}
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
					loadEvidence={firstPlayer.loadEvidence}
					loadComparisonEvidence={secondPlayer.loadEvidence}
					loadStateContext={firstPlayer.loadStateContext}
					loadComparisonStateContext={secondPlayer.loadStateContext}
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
				/>
			) : null}
		</>
	)
}
