'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import PageShell from '@/components/layout/PageShell'
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
import { markRouteReadyStart } from '@/lib/analytics/route-navigation'
import {
	type GameweekBoardPlayer,
	type GameweekDisplayState
} from '@/lib/gameweek-board'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { Star, Trophy } from 'lucide-react'
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
	const dreamTeam = mapBoardPlayers(committedDesk.dreamTeam)
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
	const isBoardsUnavailable = committedDesk.boardsState === 'UNAVAILABLE'
	const isBoardsPending = committedDesk.boardsState === 'PENDING'

	const formatStat = (
		value: number | null,
		fallbackTip = t('pendingOfficial')
	) => (typeof value === 'number' ? String(value) : fallbackTip)
	const formatCount = (value: number | null, fallbackTip = t('notProvided')) =>
		typeof value === 'number'
			? formatter.number(value, { notation: 'compact' })
			: fallbackTip
	const displayName = (name: string) =>
		name === 'N/A' ? t('notAvailable') : name
	const statusLabel =
		displayState === 'provisional'
			? t('status.provisional')
			: displayState === 'settled'
				? t('status.settled')
				: displayState === 'scheduled'
					? t('status.scheduled')
					: null
	const deadlineLabel = (() => {
		if (!committedDesk.deadlineTime) return null
		const deadline = new Date(committedDesk.deadlineTime)
		if (Number.isNaN(deadline.getTime())) return null
		return formatter.dateTime(deadline, {
			dateStyle: 'medium',
			timeStyle: 'short'
		})
	})()
	const updatedLabel = (() => {
		if (!committedDesk.publishedAt) return null
		const updated = new Date(committedDesk.publishedAt)
		if (Number.isNaN(updated.getTime())) return null
		return formatter.dateTime(updated, {
			dateStyle: 'medium',
			timeStyle: 'short'
		})
	})()
	const playerHref = useCallback(
		(player: { id: number }) => playerStatsHref({ p1: String(player.id) }),
		[]
	)

	return (
		<>
			<RouteReadyMarker
				name="GAMEWEEK_CONTENT_READY"
				ready={!isLoading}
				readyKey={`${committedDesk.eventId}:${committedDesk.coreRevision}:${committedDesk.liveRevision ?? ''}`}
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
					<div className="-mt-4 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
						{statusLabel ? (
							<Badge variant="secondary">{statusLabel}</Badge>
						) : null}
						{deadlineLabel ? (
							<span>{t('deadline', { value: deadlineLabel })}</span>
						) : null}
						{updatedLabel ? (
							<span>{t('updated', { value: updatedLabel })}</span>
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
						className="scoreboard-lifted mb-6 rounded-xl sm:mb-8"
						aria-labelledby="gw-overview-title"
					>
						<div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
							<h2
								id="gw-overview-title"
								className="font-display text-lg font-bold tracking-wide text-white sm:text-xl"
							>
								{t('overview', { gameweek: visibleGameweek })}
							</h2>
							{isLoading ? (
								<span className="font-mono text-[10px] uppercase tracking-wide text-white/50">
									{t('loadingOverview')}
								</span>
							) : null}
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
								<p className="font-display text-lg font-bold text-white">
									{t('preseasonTitle')}
								</p>
								<p className="mt-1 text-sm text-white/65">
									{t('preseasonDescription')}
								</p>
							</div>
						) : isScheduledSelection || isBoardsPending ? (
							<div className="px-4 py-6 sm:px-5">
								<p className="text-sm text-white/65">{t('pendingOfficial')}</p>
							</div>
						) : (
							<>
								<div className="grid grid-cols-2 divide-x divide-white/10 border-b border-white/10">
									<div className="px-4 py-4 sm:px-5 sm:py-5">
										<p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
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
										<p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
											{t('highestPoints')}
										</p>
										<p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
											{formatStat(
												isOverviewUnavailable
													? null
													: overallStats.highestPoints
											)}
										</p>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
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
											className="bg-[hsl(288_40%_20%)] px-3 py-3 sm:px-4 sm:py-3.5"
										>
											<p className="font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-white/50 sm:text-[10px]">
												{item.label}
											</p>
											<p className="mt-1 truncate font-display text-sm font-semibold tracking-tight text-white sm:text-base">
												{item.value}
											</p>
										</div>
									))}
								</div>

								<div className="border-t border-white/10 px-3 py-3 sm:px-4">
									<p className="mb-2 font-display text-[9px] font-semibold uppercase tracking-[0.16em] text-white/50">
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
												className="rounded-md border border-white/12 bg-white/8 px-2 py-2 text-center"
											>
												<p className="font-display text-[9px] font-semibold uppercase leading-tight tracking-[0.1em] text-electric sm:text-[10px]">
													{t(key)}
												</p>
												<p className="mt-1 font-display text-sm font-bold tabular-nums text-white sm:text-base">
													{formatCount(value ?? null, '—')}
												</p>
											</div>
										))}
									</div>
								</div>
							</>
						)}
					</section>

					{/* Vertical report: dream team → all hauls (no tabs) */}
					<div className="space-y-5 sm:space-y-6">
						{isLoading ? (
							<p className="text-xs text-muted-foreground">{t('refreshing')}</p>
						) : null}

						{!isPreseasonSelection ? (
							<StatsSectionCard
								icon={Trophy}
								title={t('dreamTeamTitle', { gameweek: visibleGameweek })}
							>
								{isBoardsUnavailable ? (
									<p className="text-sm text-muted-foreground">
										{t('loadFailed')}
									</p>
								) : isScheduledSelection || isBoardsPending ? (
									<p className="text-sm text-muted-foreground">
										{t('pendingOfficial')}
									</p>
								) : dreamTeam.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										{t('noDreamTeam')}
									</p>
								) : (
									<PlayerList
										players={dreamTeam}
										playerHref={playerHref}
									/>
								)}
							</StatsSectionCard>
						) : null}

						{!isPreseasonSelection ? (
							<StatsSectionCard
								icon={Star}
								title={t('doubleDigitHauls')}
								description={t('haulDescription')}
							>
								{isBoardsUnavailable ? (
									<p className="text-sm text-muted-foreground">
										{t('loadFailed')}
									</p>
								) : isScheduledSelection ? (
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
										playerHref={playerHref}
									/>
								)}
							</StatsSectionCard>
						) : null}
					</div>
				</div>
			</PageShell>
		</>
	)
}
