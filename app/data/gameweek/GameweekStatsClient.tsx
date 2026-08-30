'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { PlayerDetailModal } from '@/components/live/PlayerDetailModal'
import { useMatchPlayerDetail } from '@/components/live/match-card/useMatchPlayerDetail'
import { TeamOfTheWeekSection } from '@/components/home/TeamOfTheWeekSection'
import PageShell from '@/components/layout/PageShell'
import { ShareActions } from '@/components/share/ShareActions'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import {
	StatsPageHeader,
	StatsSectionCard
} from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
	FALLBACK_OVERALL_STATS,
	type OverallGameweekStats
} from '@/lib/gameweek-overall-stats'
import {
	GAMEWEEK_DESK_MAX_EVENT_ID,
	isGameweekDeskData,
	type GameweekDeskData
} from '@/lib/gameweek-desk'
import type { HomeGameweekPlayer } from '@/lib/graphql/operations/home'
import { markRouteReadyStart } from '@/lib/analytics/route-navigation'
import {
	type GameweekBoardPlayer,
	type GameweekDisplayState
} from '@/lib/gameweek-board'
import type { PlayerStat } from '@/types/match'
import type { PlayerListItem } from '@/components/player/PlayerList'
import { Star } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useFormatter, useTranslations } from 'next-intl'
import {
	startTransition,
	useCallback,
	useEffect,
	useRef,
	useState
} from 'react'

const PlayerList = dynamic(
	() =>
		import('@/components/player/PlayerList').then(module => module.PlayerList),
	{
		loading: () => <div className="h-32 animate-pulse rounded-lg bg-muted/20" />
	}
)

interface GameweekStatsClientProps {
	initialDesk: GameweekDeskData
}

function toDisplayState(
	lifecycle: GameweekDeskData['lifecycle']
): GameweekDisplayState {
	if (lifecycle === 'SCHEDULED') return 'scheduled'
	if (lifecycle === 'PROVISIONAL') return 'provisional'
	return 'settled'
}

function mapBoardPlayers(
	entries: GameweekDeskData['dreamTeam']
): GameweekBoardPlayer[] {
	return entries.map(entry => ({
		id: entry.id,
		name: entry.webName,
		position:
			entry.position === 'GOALKEEPER'
				? 'GKP'
				: entry.position === 'DEFENDER'
					? 'DEF'
					: entry.position === 'MIDFIELDER'
						? 'MID'
						: 'FWD',
		team: entry.teamShortName,
		points: entry.totalPoints,
		price: entry.price,
		minutes: entry.minutes,
		stats: {
			goals: entry.goalsScored,
			assists: entry.assists,
			cleanSheets: entry.cleanSheets,
			bonusPoints: entry.bonus
		}
	}))
}

function mapDreamTeamPlayers(
	entries: GameweekDeskData['dreamTeam']
): HomeGameweekPlayer[] {
	return entries.map(entry => ({
		id: entry.id,
		webName: entry.webName,
		position: entry.position,
		teamShortName: entry.teamShortName,
		totalPoints: entry.totalPoints
	}))
}

function elementTypeForPosition(
	position: GameweekBoardPlayer['position']
): number {
	if (position === 'GKP') return 1
	if (position === 'DEF') return 2
	if (position === 'FWD') return 4
	return 3
}

function boardPlayerToStat(player: GameweekBoardPlayer): PlayerStat {
	return {
		player: player.name,
		element: player.id,
		elementType: elementTypeForPosition(player.position),
		minutes: player.minutes ?? 0,
		goals: player.stats.goals ?? 0,
		assists: player.stats.assists ?? 0,
		cleanSheets: player.stats.cleanSheets ?? 0,
		bonus_points: player.stats.bonusPoints ?? 0,
		totalPoints: player.points
	}
}

function mapOverallStats(desk: GameweekDeskData): OverallGameweekStats {
	const overview = desk.overview
	return {
		averagePoints: overview?.averagePoints ?? null,
		highestPoints: overview?.highestPoints ?? null,
		mostCaptained: {
			name: overview?.mostCaptained?.webName ?? 'N/A',
			count: null
		},
		mostViceCaptained: {
			name: overview?.mostViceCaptained?.webName ?? 'N/A'
		},
		mostTransferredIn: {
			name: overview?.mostTransferredIn?.webName ?? 'N/A',
			team: overview?.mostTransferredIn?.teamShortName ?? 'N/A',
			count: null
		},
		mostSelectedPlayer: {
			name: overview?.mostSelected?.webName ?? 'N/A',
			id: overview?.mostSelected?.id ?? null
		},
		mostTransferInPlayer: {
			name: overview?.mostTransferredIn?.webName ?? 'N/A',
			id: overview?.mostTransferredIn?.id ?? null
		},
		chipsPlayed: overview?.chipsPlayed ?? FALLBACK_OVERALL_STATS.chipsPlayed
	}
}

function createDeskCache(initialDesk: GameweekDeskData) {
	const cache = new Map<number, GameweekDeskData>()
	if (
		initialDesk.overviewState === 'AVAILABLE' &&
		initialDesk.boardsState === 'AVAILABLE'
	) {
		cache.set(initialDesk.eventId, initialDesk)
	}
	return cache
}

export default function GameweekStatsClient({
	initialDesk
}: GameweekStatsClientProps) {
	const t = useTranslations('GameweekStats')
	const formatter = useFormatter()
	const [selectedGameweek, setSelectedGameweek] = useState(initialDesk.eventId)
	const [committedDesk, setCommittedDesk] = useState(initialDesk)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const deskCacheRef = useRef<Map<number, GameweekDeskData>>(
		createDeskCache(initialDesk)
	)
	const requestRef = useRef<{
		generation: number
		controller: AbortController | null
	}>({
		generation: 0,
		controller: null
	})
	const selectedGameweekRef = useRef(selectedGameweek)
	const selectGameweek = useCallback((gameweek: number) => {
		if (gameweek === selectedGameweekRef.current) return
		markRouteReadyStart(window.location.pathname)
		selectedGameweekRef.current = gameweek
		setSelectedGameweek(gameweek)
	}, [])

	useEffect(() => {
		requestRef.current.controller?.abort()
		const generation = requestRef.current.generation + 1
		requestRef.current = { generation, controller: null }

		if (selectedGameweek === committedDesk.eventId) {
			setIsLoading(false)
			return
		}
		const cached = deskCacheRef.current.get(selectedGameweek)
		if (cached) {
			setError(null)
			setIsLoading(false)
			startTransition(() => setCommittedDesk(cached))
			return
		}

		const controller = new AbortController()
		requestRef.current = { generation, controller }
		setError(null)
		setIsLoading(true)

		void fetch(`/api/gameweek/desk?eventId=${selectedGameweek}`, {
			signal: controller.signal,
			headers: { Accept: 'application/json' }
		})
			.then(async response => {
				if (!response.ok)
					throw new Error(`Gameweek desk request failed (${response.status})`)
				const value: unknown = await response.json()
				if (!isGameweekDeskData(value))
					throw new Error('Gameweek desk response was invalid')
				return value
			})
			.then(data => {
				if (
					requestRef.current.generation !== generation ||
					selectedGameweekRef.current !== data.eventId ||
					selectedGameweek !== data.eventId
				) {
					return
				}
				if (
					data.overviewState === 'AVAILABLE' &&
					data.boardsState === 'AVAILABLE'
				) {
					deskCacheRef.current.set(data.eventId, data)
				}
				setError(null)
				startTransition(() => setCommittedDesk(data))
			})
			.catch(reason => {
				if (
					requestRef.current.generation !== generation ||
					selectedGameweekRef.current !== selectedGameweek ||
					(reason instanceof DOMException && reason.name === 'AbortError')
				) {
					return
				}
				console.error('Failed to load selected gameweek desk:', reason)
				selectGameweek(committedDesk.eventId)
				setError(t('loadFailed'))
			})
			.finally(() => {
				if (requestRef.current.generation === generation) {
					setIsLoading(false)
					requestRef.current.controller = null
				}
			})

		return () => {
			requestRef.current.controller?.abort()
		}
	}, [committedDesk.eventId, selectedGameweek, selectGameweek, t])

	const overallStats = mapOverallStats(committedDesk)
	const dreamTeam = mapDreamTeamPlayers(committedDesk.dreamTeam)
	const haulPlayers = mapBoardPlayers(committedDesk.hauls)
	const displayState = toDisplayState(committedDesk.lifecycle)
	const isPreseasonSelection = committedDesk.isPreseason
	const isScheduledSelection = committedDesk.lifecycle === 'SCHEDULED'
	const visibleGameweek = committedDesk.eventId
	const maxGameweek = Math.min(
		GAMEWEEK_DESK_MAX_EVENT_ID,
		Math.max(
			committedDesk.anchorEventId,
			committedDesk.currentEventId ?? 0,
			committedDesk.eventId
		)
	)
	const currentGameweek = committedDesk.currentEventId
	const isOverviewUnavailable = committedDesk.overviewState === 'UNAVAILABLE'
	const isOverviewPending = committedDesk.overviewState === 'PENDING'
	const isBoardsUnavailable = committedDesk.boardsState === 'UNAVAILABLE'
	const isBoardsPending = committedDesk.boardsState === 'PENDING'
	const overviewShareRef = useRef<HTMLElement | null>(null)
	const haulShareRef = useRef<HTMLDivElement | null>(null)
	const {
		closePlayerDetail,
		isLoading: isPlayerDetailLoading,
		isOpen: isPlayerDetailOpen,
		openPlayerDetail,
		selectedPlayer
	} = useMatchPlayerDetail(visibleGameweek)

	const formatStat = useCallback(
		(value: number | null, fallbackTip = t('pendingOfficial')) =>
			typeof value === 'number' ? String(value) : fallbackTip,
		[t]
	)
	const formatCount = (value: number | null, fallbackTip = t('notProvided')) =>
		typeof value === 'number'
			? formatter.number(value, { notation: 'compact' })
			: fallbackTip
	const displayName = useCallback(
		(name: string) => (name === 'N/A' ? t('notAvailable') : name),
		[t]
	)
	const statusLabel =
		displayState === 'provisional'
			? t('status.provisional')
			: displayState === 'settled'
				? t('status.settled')
				: displayState === 'scheduled'
					? t('status.scheduled')
					: null
	const [updatedLabel, setUpdatedLabel] = useState<string | null>(null)
	useEffect(() => {
		if (!committedDesk.publishedAt) {
			setUpdatedLabel(null)
			return
		}
		const updated = new Date(committedDesk.publishedAt)
		if (Number.isNaN(updated.getTime())) {
			setUpdatedLabel(null)
			return
		}
		const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		setUpdatedLabel(
			formatter.dateTime(updated, {
				dateStyle: 'medium',
				timeStyle: 'medium',
				timeZone: browserTimeZone
			})
		)
	}, [committedDesk.publishedAt, formatter])
	const handleHaulPlayerClick = useCallback(
		(player: PlayerListItem) => {
			const boardPlayer = haulPlayers.find(
				candidate => candidate.id === player.id
			)
			if (!boardPlayer) return
			const team = boardPlayer.team ?? '—'
			void openPlayerDetail(boardPlayerToStat(boardPlayer), team, team)
		},
		[haulPlayers, openPlayerDetail]
	)
	const canShareHauls =
		!isLoading &&
		!isScheduledSelection &&
		!isBoardsPending &&
		!isBoardsUnavailable &&
		haulPlayers.length > 0
	const overviewShareTitle = t('overview', { gameweek: visibleGameweek })
	const canShareOverview =
		!isLoading && committedDesk.overviewState === 'AVAILABLE'

	return (
		<>
			<RouteReadyMarker
				name="GAMEWEEK_CONTENT_READY"
				ready={!isLoading}
			readyKey={`${committedDesk.eventId}:${committedDesk.coreRevision}:${committedDesk.scoreCoreRevision ?? ''}`}
				audienceHint="public"
				goodMs={1_000}
				poorMs={1_500}
			/>
			<PageShell>
				<div className="container mx-auto max-w-4xl px-4 py-8">
					<StatsPageHeader
						title={t('title')}
						badge={<GameweekBadge gameweek={visibleGameweek} />}
					/>
					<div>
						<div className="-mt-4 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
							{statusLabel ? (
								<Badge variant="secondary">{statusLabel}</Badge>
							) : null}
							{updatedLabel && committedDesk.publishedAt ? (
								<time
									dateTime={committedDesk.publishedAt}
									className="whitespace-nowrap"
								>
									{t('updated', { value: updatedLabel })}
								</time>
							) : null}
						</div>

						<div className="mb-6">
							<GameweekSelector
								onGameweekChange={selectGameweek}
								currentGameweek={currentGameweek}
								maxGameweek={maxGameweek}
								selectedGameweek={selectedGameweek}
								ariaBusy={isLoading}
							/>
						</div>

						{error ? (
							<Alert
								variant="destructive"
								className="mb-6"
							>
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						) : null}

						{/* Overview — same scoreboard structure, lighter mid-plum bg */}
						<section
							ref={overviewShareRef}
							className="scoreboard-lifted mb-6 rounded-xl sm:mb-8"
							aria-labelledby="gw-overview-title"
							data-gameweek-overview="true"
							data-share-fit-content="true"
							data-share-preserve-width="true"
							data-share-reserve-brand-space="true"
						>
							<div className="flex flex-wrap items-center justify-between gap-2 border-b border-fascia-foreground/10 px-4 py-3 sm:px-5">
								<h2
									id="gw-overview-title"
									data-share-title="true"
									className="font-display text-lg font-bold tracking-wide text-fascia-foreground sm:text-xl"
								>
									{overviewShareTitle}
								</h2>
								<div
									className="flex shrink-0 items-center gap-3"
									data-share-exclude="true"
								>
									{isLoading ? (
										<span className="font-mono text-label uppercase tracking-wide text-fascia-foreground/60">
											{t('loadingOverview')}
										</span>
									) : null}
									{canShareOverview ? (
										<ShareActions
											actions={['image']}
											text={overviewShareTitle}
											imageRef={overviewShareRef}
											title={overviewShareTitle}
											buttonClassName="border-fascia-foreground/25 bg-fascia-foreground/10 text-fascia-foreground hover:border-electric hover:bg-electric/10 hover:text-electric"
										/>
									) : null}
								</div>
							</div>
							{isOverviewUnavailable ? (
								<Alert
									variant="destructive"
									className="mx-4 mt-4 sm:mx-5"
								>
									<AlertDescription>{t('loadFailed')}</AlertDescription>
								</Alert>
							) : null}

							{isPreseasonSelection ? (
								<div className="px-4 py-6 sm:px-5">
									<p className="font-display text-lg font-bold text-fascia-foreground">
										{t('preseasonTitle')}
									</p>
									<p className="mt-1 text-sm text-fascia-foreground/65">
										{t('preseasonDescription')}
									</p>
								</div>
							) : isScheduledSelection || isOverviewPending ? (
								<div className="px-4 py-6 sm:px-5">
									<p className="text-sm text-fascia-foreground/65">
										{t('pendingOfficial')}
									</p>
								</div>
							) : (
								<>
									<div className="grid grid-cols-2 divide-x divide-fascia-foreground/10 border-b border-fascia-foreground/10">
										<div className="px-4 py-4 sm:px-5 sm:py-5">
											<p className="eyebrow text-fascia-foreground/55">
												{t('averagePoints')}
											</p>
											<p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-electric sm:text-4xl">
												{formatStat(
													isOverviewUnavailable
														? null
														: overallStats.averagePoints,
													t('awaitingAggregation')
												)}
											</p>
										</div>
										<div className="px-4 py-4 sm:px-5 sm:py-5">
											<p className="eyebrow text-fascia-foreground/55">
												{t('highestPoints')}
											</p>
											<p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-fascia-foreground sm:text-4xl">
												{formatStat(
													isOverviewUnavailable
														? null
														: overallStats.highestPoints
												)}
											</p>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-px bg-fascia-foreground/10 sm:grid-cols-4">
										{(
											[
												{
													label: t('mostCaptained'),
													value: displayName(
														isOverviewUnavailable
															? 'N/A'
															: overallStats.mostCaptained.name
													)
												},
												{
													label: t('mostViceCaptained'),
													value: displayName(
														isOverviewUnavailable
															? 'N/A'
															: overallStats.mostViceCaptained.name
													)
												},
												{
													label: t('mostSelected'),
													value: displayName(
														isOverviewUnavailable
															? 'N/A'
															: overallStats.mostSelectedPlayer.name
													)
												},
												{
													label: t('mostTransferredIn'),
													value: displayName(
														isOverviewUnavailable
															? 'N/A'
															: overallStats.mostTransferInPlayer.name
													)
												}
											] as const
										).map(item => (
											<div
												key={item.label}
												className="bg-scoreboard-cell px-3 py-3 sm:px-4 sm:py-3.5"
											>
												<p className="eyebrow text-fascia-foreground/60">
													{item.label}
												</p>
												<p className="mt-1 truncate font-display text-sm font-semibold tracking-tight text-fascia-foreground sm:text-base">
													{item.value}
												</p>
											</div>
										))}
									</div>

									<div className="border-t border-fascia-foreground/10 px-3 py-3 sm:px-4">
										<p className="eyebrow mb-2 text-fascia-foreground/60">
											{t('chipsPlayed')}
										</p>
										<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
											{(
												[
													[
														'benchBoost',
														isOverviewUnavailable
															? null
															: overallStats.chipsPlayed?.benchBoost
													],
													[
														'tripleCaptain',
														isOverviewUnavailable
															? null
															: overallStats.chipsPlayed?.tripleCaptain
													],
													[
														'wildcard',
														isOverviewUnavailable
															? null
															: overallStats.chipsPlayed?.wildcard
													],
													[
														'freeHit',
														isOverviewUnavailable
															? null
															: overallStats.chipsPlayed?.freeHit
													]
												] as const
											).map(([key, value]) => (
												<div
													key={key}
													className="rounded-md border border-fascia-foreground/12 bg-fascia-foreground/8 px-2 py-2 text-center"
												>
													<p className="eyebrow leading-tight text-electric">
														{t(key)}
													</p>
													<p className="mt-1 font-display text-sm font-bold tabular-nums text-fascia-foreground sm:text-base">
														{formatCount(value ?? null, '—')}
													</p>
												</div>
											))}
										</div>
									</div>
								</>
							)}
						</section>

						{/* Vertical report: dream team pitch → all hauls (no tabs) */}
						<div className="space-y-5 sm:space-y-6">
							{isLoading ? (
								<p className="text-xs text-muted-foreground">
									{t('refreshing')}
								</p>
							) : null}

							{!isPreseasonSelection ? (
								isBoardsUnavailable ? (
									<StatsSectionCard
										title={t('dreamTeamTitle', { gameweek: visibleGameweek })}
									>
										<p className="text-sm text-muted-foreground">
											{t('loadFailed')}
										</p>
									</StatsSectionCard>
								) : isScheduledSelection || isBoardsPending ? (
									<StatsSectionCard
										title={t('dreamTeamTitle', { gameweek: visibleGameweek })}
									>
										<p className="text-sm text-muted-foreground">
											{t('pendingOfficial')}
										</p>
									</StatsSectionCard>
								) : dreamTeam.length === 0 ? (
									<StatsSectionCard
										title={t('dreamTeamTitle', { gameweek: visibleGameweek })}
									>
										<p className="text-sm text-muted-foreground">
											{t('noDreamTeam')}
										</p>
									</StatsSectionCard>
								) : (
									<TeamOfTheWeekSection
										currentEventId={visibleGameweek}
										dreamTeam={dreamTeam}
										showShareActions
									/>
								)
							) : null}

							{!isPreseasonSelection ? (
								<div
									ref={haulShareRef}
									data-share-fit-content="true"
									data-share-preserve-width="true"
									data-share-reserve-brand-space="true"
									className="min-w-0"
								>
									<StatsSectionCard
										icon={Star}
										title={t('doubleDigitHauls')}
										description={t('haulDescription')}
										action={
											canShareHauls ? (
												<ShareActions
													text={t('doubleDigitHauls')}
													imageRef={haulShareRef}
													title={t('doubleDigitHauls')}
													actions={['image']}
												/>
											) : null
										}
									>
										{isBoardsUnavailable ? (
											<p className="text-sm text-muted-foreground">
												{t('loadFailed')}
											</p>
										) : isScheduledSelection || isBoardsPending ? (
											<p className="text-sm text-muted-foreground">
												{t('pendingOfficial')}
											</p>
										) : haulPlayers.length === 0 ? (
											<p className="text-sm text-muted-foreground">
												{t('noHauls')}
											</p>
										) : (
											<PlayerList
												players={haulPlayers}
												onPlayerClick={handleHaulPlayerClick}
											/>
										)}
									</StatsSectionCard>
								</div>
							) : null}
						</div>
					</div>
				</div>
			</PageShell>
			<PlayerDetailModal
				player={selectedPlayer}
				isOpen={isPlayerDetailOpen}
				onClose={closePlayerDetail}
				isLoading={isPlayerDetailLoading}
			/>
		</>
	)
}
