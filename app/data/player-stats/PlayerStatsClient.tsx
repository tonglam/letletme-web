'use client'

import PageShell from '@/components/layout/PageShell'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import type { MarketCompareCandidate } from '@/lib/market-compare'
import type { SquadPickSeed } from '@/lib/squad-picks'
import { positionCodeFromElementTypeName } from '@/lib/squad-picks'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MySquadRail } from './_components/MySquadRail'
import { PlayerSelectionPanel } from './_components/PlayerSelectionPanel'
import { PlayerStatsView } from './_components/PlayerStatsView'
import { usePlayerDetailSlot } from './_hooks/usePlayerDetailSlot'
import {
	buildPlayerStatsQueryString,
	playerStatsSectionFromHash
} from './_lib/player-stats-url'

const RECENT_PLAYERS_KEY_1 = 'player-stats-recent-1'
const RECENT_PLAYERS_KEY_2 = 'player-stats-recent-2'

export default function PlayerStatsClient({
	anchorGw,
	initialPlayerIds,
	mySquadPicks = [],
	marketCompareCandidates = [],
	seasonStatsAvailable
}: {
	anchorGw: number
	initialPlayerIds: { p1: number | null; p2: number | null }
	mySquadPicks?: SquadPickSeed[]
	marketCompareCandidates?: MarketCompareCandidate[]
	seasonStatsAvailable: boolean
}) {
	const t = useTranslations('PlayerStats')
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
			const firstDetail =
				await firstSelectPlayerById(initialPlayerIds.p1, {
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
		return marketCompareCandidates
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

	return (
		<PageShell>
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<StatsPageHeader
					title={t('title')}
					badge={
						<GameweekBadge
							gameweek={anchorGw}
							label={seasonStatsAvailable ? undefined : t('preseasonLabel')}
						/>
					}
				/>
				<p className="-mt-4 mb-6 max-w-2xl text-sm leading-6 text-muted-foreground">
					{t('pageIntro')}
				</p>

				<MySquadRail
					picks={mySquadPicks}
					selectedPlayerId={firstPlayer.selectedPlayer?.id}
					onSelect={handleSquadSelect}
				/>

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
					isEvidenceLoading={firstPlayer.isEvidenceLoading}
					isComparisonEvidenceLoading={secondPlayer.isEvidenceLoading}
					evidenceError={firstPlayer.evidenceError}
					comparisonEvidenceError={secondPlayer.evidenceError}
					anchorGw={anchorGw}
					seasonStatsAvailable={seasonStatsAvailable}
				/>
			</div>
		</PageShell>
	)
}
