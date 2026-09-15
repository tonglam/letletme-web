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
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { toPickerPlayer } from '@/components/player/PlayerDirectoryPicker'
import { PlayerStatsInitialDesk } from './PlayerStatsInitialDesk'
import { MySquadRail } from './_components/MySquadRail'
import { PlayerSelectionPanel } from './_components/PlayerSelectionPanel'
import { usePlayerStatsPersonalSeed } from './PlayerStatsPersonalSeedContext'
import { usePlayerDetailSlot } from './_hooks/usePlayerDetailSlot'
import {
	buildPlayerStatsQueryString,
	playerStatsSectionFromHash,
} from './_lib/player-stats-url'

const RECENT_PLAYERS_KEY_1 = 'player-stats-recent-1'
const RECENT_PLAYERS_KEY_2 = 'player-stats-recent-2'

const loadPlayerStatsView = () =>
	import('./_components/PlayerStatsView').then(module => module.PlayerStatsView)

const PlayerStatsView = dynamic(loadPlayerStatsView, {
	loading: () => (
		<div
			data-ssr-stream-fallback="player-stats-detail"
			data-player-stats-ssr-fallback="true"
			className="min-h-72 animate-pulse rounded-xl border border-border/70 bg-muted/20"
			role="status"
			aria-label="Loading player details"
		/>
	)
})

type NoScriptPlayer = PlayerDirectorySeed['players'][number]

function PlayerStatsNoScriptResult({
	player,
	playerId,
	noScriptHint
}: {
	player: NoScriptPlayer | null
	playerId: number
	noScriptHint: string
}) {
	const t = useTranslations('PlayerStats')
	const retryQuery = buildPlayerStatsQueryString({ p1: String(playerId) })
	const sections = [
		{ id: 'fixtures', title: t('fixturesTitle'), hint: t('fixturesHint') },
		{ id: 'recent', title: t('recentTitle'), hint: t('recentHint') },
		{ id: 'season', title: t('seasonTitle'), hint: t('seasonThrough', { gw: '—' }) },
		{ id: 'process', title: t('processTitle'), hint: t('processHint') },
		{ id: 'market', title: t('marketTitle'), hint: t('marketHint') },
		{ id: 'coverage', title: t('sectionNavCoverage'), hint: t('playerState.coverage.unavailable') }
	] as const
	const playerLabel = player?.webName ?? `${t('playerOne')} #${playerId}`
	const retryHref = retryQuery ? `?${retryQuery}` : '.'

	return (
		<noscript>
			<style>{'[data-player-stats-ssr-fallback="true"] { display: none !important; }'}</style>
			<div data-player-stats-noscript-result="true" className="space-y-4">
				<section
					id="ps-history"
					data-player-stats-noscript-section="history"
					aria-label={t('overallTitle')}
					className="scroll-mt-36 rounded-xl border bg-card px-6 py-8"
				>
					<h2 className="font-display text-lg font-bold uppercase tracking-wide">
						{playerLabel}
					</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						{noScriptHint}
					</p>
					<a
						href={retryHref}
						className="mt-3 inline-flex rounded-md border px-3 py-2 text-sm font-medium underline-offset-2 hover:underline"
					>
						{t('retry')}
					</a>
				</section>
				{sections.map(section => (
					<section
						key={section.id}
						id={`ps-${section.id}`}
						data-player-stats-noscript-section={section.id}
						className="scroll-mt-36 border-t border-border/60 pt-4"
					>
						<h2 className="eyebrow sm:text-caption">{section.title}</h2>
						<p className="mt-1 text-sm text-muted-foreground">{section.hint}</p>
					</section>
				))}
			</div>
		</noscript>
	)
}

export default function PlayerStatsClient({
	initialPlayerIds,
	directorySeed,
	initialDeskSeedPromise,
	navigationId,
	noScriptHint
}: {
	initialPlayerIds: { p1: number | null; p2: number | null }
	directorySeed: PlayerDirectorySeed
	initialDeskSeedPromise: Promise<PlayerStatsDeskResponse | null>
	navigationId: string
	noScriptHint: string
}) {
	const t = useTranslations('PlayerStats')
	const [initialDeskSettled, setInitialDeskSettled] = useState(false)
	const { seed: personalSeed, resolved: personalSeedResolved } =
		usePlayerStatsPersonalSeed()
	const { anchorGw, seasonStatsAvailable, seasonStatsStatus } = directorySeed
	const mySquadPicks = personalSeed?.mySquadPicks ?? []
	const marketCompareCandidates = personalSeed?.marketCompareCandidates
	const firstPlayer = usePlayerDetailSlot({
		storageKey: RECENT_PLAYERS_KEY_1,
		eventId: anchorGw,
		initialPlayer: directorySeed.players.find(player => player.id === initialPlayerIds.p1) ? toPickerPlayer(directorySeed.players.find(player => player.id === initialPlayerIds.p1)!) : null,
		navigationId
	})
	const secondPlayer = usePlayerDetailSlot({
		storageKey: RECENT_PLAYERS_KEY_2,
		eventId: anchorGw,
		initialPlayer: directorySeed.players.find(player => player.id === initialPlayerIds.p2) ? toPickerPlayer(directorySeed.players.find(player => player.id === initialPlayerIds.p2)!) : null,
		navigationId
	})
	const firstSelectPlayer = firstPlayer.selectPlayer
	const firstSelectPlayerById = firstPlayer.selectPlayerById
	const secondSelectPlayer = secondPlayer.selectPlayer
	const secondSelectPlayerById = secondPlayer.selectPlayerById
	const secondClearSelection = secondPlayer.clearSelection
	const firstSelectedPlayerId = firstPlayer.selectedPlayer?.id
	const secondSelectedPlayerId = secondPlayer.selectedPlayer?.id
	const [compareOpen, setCompareOpen] = useState(initialPlayerIds.p2 != null)
	const [deepLinkReady, setDeepLinkReady] = useState(false)
	const [directoryReady, setDirectoryReady] = useState(
		directorySeed.playersState === 'ready'
	)
	const handleDirectoryReady = useCallback(() => setDirectoryReady(true), [])
	const deepLinkKey = `${initialPlayerIds.p1 ?? ''}:${initialPlayerIds.p2 ?? ''}`
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


	const syncUrl = useCallback(() => {
		if (typeof window === 'undefined') return
		const params = buildPlayerStatsQueryString({
			p1: firstPlayer.selectedPlayer?.id ?? (firstPlayer.selectionVersion === 0 && initialPlayerIds.p1 != null ? String(initialPlayerIds.p1) : null),
			p2: secondPlayer.selectedPlayer?.id ?? (secondPlayer.selectionVersion === 0 && initialPlayerIds.p2 != null ? String(initialPlayerIds.p2) : null)
		})
		const hash = window.location.hash
		const path = window.location.pathname
		const next = params ? `${path}?${params}${hash}` : `${path}${hash}`
		window.history.replaceState(null, '', next)
	}, [firstPlayer.selectedPlayer?.id, secondPlayer.selectedPlayer?.id, firstPlayer.selectionVersion, secondPlayer.selectionVersion, initialPlayerIds.p1, initialPlayerIds.p2])

	useEffect(() => {
		if (!deepLinkReady) return
		syncUrl()
	}, [deepLinkReady, syncUrl])

	useEffect(() => { setDeepLinkReady(true) }, [deepLinkKey])

	useEffect(() => {
		if (!deepLinkReady || (initialPlayerIds.p1 != null && !initialDeskSettled)) return
		let cancelled = false
		let generation = 0
		const scheduleHashScroll = () => {
			const currentGeneration = ++generation
			const section = playerStatsSectionFromHash(window.location.hash)
			if (!section) return
			let attempts = 0
			const scrollToHashTarget = () => {
				if (cancelled || currentGeneration !== generation) return
				const element = document.getElementById(`ps-${section}`)
				if (element) {
					window.requestAnimationFrame(() => {
						if (!cancelled && currentGeneration === generation) {
							element.scrollIntoView({ behavior: 'smooth', block: 'start' })
						}
					})
					return
				}
				if (attempts >= 20) return
				attempts += 1
				window.setTimeout(scrollToHashTarget, 50)
			}
			scrollToHashTarget()
		}
		scheduleHashScroll()
		window.addEventListener('hashchange', scheduleHashScroll)
		window.addEventListener('popstate', scheduleHashScroll)
		return () => {
			cancelled = true
			window.removeEventListener('hashchange', scheduleHashScroll)
			window.removeEventListener('popstate', scheduleHashScroll)
		}
	}, [deepLinkReady, initialDeskSettled, initialPlayerIds.p1, deepLinkKey])

	const admitFirstSeed = firstPlayer.admitInitialSeed
	const admitSecondSeed = secondPlayer.admitInitialSeed
	const admitDeskSeed = useCallback((seed: PlayerStatsDeskResponse | null) => {
		const matching = seed?.eventId === anchorGw ? seed : null
		if (initialPlayerIds.p1 != null) {
			admitFirstSeed(
				matching?.entries.find(entry => entry.playerId === initialPlayerIds.p1) ?? null,
				{ navigationId, eventId: anchorGw, playerId: initialPlayerIds.p1 }
			)
		}
		if (initialPlayerIds.p2 != null) {
			admitSecondSeed(
				matching?.entries.find(entry => entry.playerId === initialPlayerIds.p2) ?? null,
				{ navigationId, eventId: anchorGw, playerId: initialPlayerIds.p2 }
			)
		}
		if (matching?.section === 'overview') {
			primePlayerStatsDeskCache(
				{
					playerIds: matching.entries.map(entry => entry.playerId),
					eventId: matching.eventId,
					horizon: matching.horizon,
					section: 'overview'
				},
				matching
			)
		}
		setInitialDeskSettled(true)
	}, [admitFirstSeed, admitSecondSeed, anchorGw, initialPlayerIds.p1, initialPlayerIds.p2, navigationId])

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
		firstPlayer.playerDetail?.statsContext.status === 'STALE' ||
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

	const initialPlayerId = initialPlayerIds.p1
	const initialDirectoryPlayer =
		initialPlayerId == null
			? null
			: directorySeed.players.find(player => player.id === initialPlayerId) ?? null
	const showInitialDesk = initialPlayerId != null && !initialDeskSettled && firstPlayer.selectionVersion === 0 && secondPlayer.selectionVersion === 0
	const comparisonRequested = Boolean(
		secondPlayer.selectedPlayer ||
		(secondPlayer.selectionVersion === 0 && initialPlayerIds.p2 != null)
	)
	const detailView = (initialPlayerIds.p1 != null ||
			firstPlayer.selectedPlayer ||
			firstPlayer.isLoading ||
			firstPlayer.error ? (
				<PlayerStatsView
					selectedPlayer={firstPlayer.selectedPlayer}
					selectedComparison={secondPlayer.selectedPlayer}
					comparisonRequested={comparisonRequested}
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
						const retryBatchPlayerIds = [
							firstSelectedPlayerId,
							secondSelectedPlayerId,
							initialPlayerIds.p1,
							initialPlayerIds.p2
						]
							.map(Number)
							.filter(value => Number.isInteger(value) && value > 0)
						if (!firstPlayer.selectedPlayer) {
							if (initialPlayerIds.p1 != null) {
								void firstSelectPlayerById(initialPlayerIds.p1, {
									batchPlayerIds: retryBatchPlayerIds
								})
							}
						} else {
							firstPlayer.selectPlayer(
								firstPlayer.selectedPlayer,
								retryBatchPlayerIds,
								{
									bypassCache: true
								}
							)
						}
						if (secondPlayer.selectedPlayer) {
							secondPlayer.selectPlayer(
								secondPlayer.selectedPlayer,
								retryBatchPlayerIds
							)
						} else if (comparisonRequested && initialPlayerIds.p2 != null) {
							void secondSelectPlayerById(initialPlayerIds.p2, {
								batchPlayerIds: retryBatchPlayerIds
							})
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
			) : null)

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
			{initialPlayerId != null && !initialDeskSettled ? (
				<PlayerStatsNoScriptResult
					player={initialDirectoryPlayer}
					playerId={initialPlayerId}
					noScriptHint={noScriptHint}
				/>
			) : null}
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
				canCompare={Boolean(firstPlayer.selectedPlayer || (initialPlayerIds.p1 != null && firstPlayer.selectionVersion === 0))}
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

			{initialPlayerId != null && !initialDeskSettled ? (
				<div data-player-stats-ssr-boundary="true">
					<Suspense fallback={showInitialDesk ? <div data-ssr-stream-fallback="player-stats-detail" data-player-stats-ssr-fallback="true" className="min-h-72 animate-pulse rounded-xl border bg-muted/20" role="status">{t('loadingStats')}</div> : null}>
						<PlayerStatsInitialDesk promise={initialDeskSeedPromise} playerIds={initialPlayerIds} eventId={anchorGw} onSeed={admitDeskSeed}>
							{showInitialDesk ? detailView : null}
						</PlayerStatsInitialDesk>
					</Suspense>
				</div>
			) : null}
			{showInitialDesk ? null : detailView}
		</>
	)
}
