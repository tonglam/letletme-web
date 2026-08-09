'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import { PlayerList } from '@/components/player/PlayerList'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import {
	StatsPageHeader,
	StatsSectionCard,
} from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
	FALLBACK_OVERALL_STATS,
	fetchOverallGameweekStats,
	type OverallGameweekStats,
} from '@/lib/gameweek-overall-stats'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_GAMEWEEK_BOARDS,
	type GameweekBoardEvent,
	type GameweekBoardsResponse,
} from '@/lib/graphql/operations/live'
import {
	mapGameweekBoardPlayers,
	resolveGameweekDisplayState,
	type GameweekBoardPlayer,
	type GameweekDisplayState,
} from '@/lib/gameweek-board'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { Star, Trophy } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

type GameweekBoardSnapshot = {
	dreamTeam: GameweekBoardPlayer[]
	hauls: GameweekBoardPlayer[]
	event: GameweekBoardEvent | null
	state: GameweekDisplayState
	publishedAt: string | null
}

interface GameweekStatsClientProps {
	anchorGameweek: number
	maxGameweek?: number
	currentGameweek: number | null
	preseason: boolean
	initialOverallStats?: OverallGameweekStats | null
}

export default function GameweekStatsClient({
	anchorGameweek,
	maxGameweek = anchorGameweek,
	currentGameweek,
	preseason,
	initialOverallStats = null,
}: GameweekStatsClientProps) {
	const t = useTranslations('GameweekStats')
	const formatter = useFormatter()
	const [selectedGameweek, setSelectedGameweek] = useState(anchorGameweek)
	const [overallStats, setOverallStats] = useState<OverallGameweekStats>(
		initialOverallStats ?? FALLBACK_OVERALL_STATS,
	)
	const [dreamTeam, setDreamTeam] = useState<GameweekBoardPlayer[]>([])
	const [haulPlayers, setHaulPlayers] = useState<GameweekBoardPlayer[]>([])
	const [eventMeta, setEventMeta] = useState<GameweekBoardEvent | null>(null)
	const [displayState, setDisplayState] =
		useState<GameweekDisplayState>(preseason ? 'scheduled' : null)
	const [publishedAt, setPublishedAt] = useState<string | null>(null)
	const [isLoadingDetails, setIsLoadingDetails] = useState(false)
	const [isLoadingOverall, setIsLoadingOverall] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const overallCacheRef = useRef<Map<number, OverallGameweekStats>>(
		new Map(
			initialOverallStats
				? [[anchorGameweek, initialOverallStats]]
				: [],
		),
	)
	const boardCacheRef = useRef<Map<number, GameweekBoardSnapshot>>(new Map())

	// Load overview + detail payloads together when GW changes (segment switch is UI-only).
	useEffect(() => {
		let cancelled = false

		const loadGameweekData = async () => {
			try {
				setError(null)

				const isPreseasonSelection = preseason && selectedGameweek === 1
				const needsOverall =
					!isPreseasonSelection &&
					!overallCacheRef.current.has(selectedGameweek)
				const needsBoards = !boardCacheRef.current.has(selectedGameweek)

				setIsLoadingOverall(needsOverall)
				setIsLoadingDetails(needsBoards)

				const cachedOverall = overallCacheRef.current.get(selectedGameweek)
				if (cachedOverall && !cancelled) setOverallStats(cachedOverall)
				const cachedBoards = boardCacheRef.current.get(selectedGameweek)
				if (cachedBoards && !cancelled) {
					setDreamTeam(cachedBoards.dreamTeam)
					setHaulPlayers(cachedBoards.hauls)
					setEventMeta(cachedBoards.event)
					setDisplayState(cachedBoards.state)
					setPublishedAt(cachedBoards.publishedAt)
				}
				if (isPreseasonSelection && !cancelled) {
					setOverallStats(FALLBACK_OVERALL_STATS)
				}

				const overallPromise = needsOverall
					? (async () => {
							const overallSnapshot =
								await fetchOverallGameweekStats(selectedGameweek)
							overallCacheRef.current.set(selectedGameweek, overallSnapshot)
							return overallSnapshot
						})()
					: Promise.resolve(null)

				const boardsPromise = needsBoards
					? (async () => {
							const data = await executeQuery<GameweekBoardsResponse>(
								GET_GAMEWEEK_BOARDS,
								{ eventId: selectedGameweek },
							)
							const snapshot: GameweekBoardSnapshot = {
								dreamTeam: mapGameweekBoardPlayers(
									data.dreamTeam ?? [],
									'position',
								),
								hauls: mapGameweekBoardPlayers(data.hauls ?? [], 'points'),
								event: data.event ?? null,
								state: resolveGameweekDisplayState(
									data.liveSnapshot?.state,
									data.event,
								),
								publishedAt: data.liveSnapshot?.publishedAt ?? null,
							}
							boardCacheRef.current.set(selectedGameweek, snapshot)
							return snapshot
						})()
					: Promise.resolve(null)

				const [overallResult, boardsResult] = await Promise.allSettled([
					overallPromise,
					boardsPromise,
				])

				if (cancelled) return
				if (overallResult.status === 'fulfilled' && overallResult.value) {
					setOverallStats(overallResult.value)
				} else if (overallResult.status === 'rejected') {
					console.error('Failed to load selected gameweek overview:', overallResult.reason)
				}
				if (boardsResult.status === 'fulfilled' && boardsResult.value) {
					setDreamTeam(boardsResult.value.dreamTeam)
					setHaulPlayers(boardsResult.value.hauls)
					setEventMeta(boardsResult.value.event)
					setDisplayState(boardsResult.value.state)
					setPublishedAt(boardsResult.value.publishedAt)
				} else if (boardsResult.status === 'rejected') {
					console.error('Failed to load selected gameweek boards:', boardsResult.reason)
				}
				if (overallResult.status === 'rejected' || boardsResult.status === 'rejected') {
					setError(t('loadFailed'))
				}
			} catch (err) {
				console.error('Failed to load selected gameweek stats:', err)
				if (!cancelled) {
					setError(t('loadFailed'))
					setDreamTeam([])
					setHaulPlayers([])
					setOverallStats(FALLBACK_OVERALL_STATS)
				}
			} finally {
				if (!cancelled) {
					setIsLoadingDetails(false)
					setIsLoadingOverall(false)
				}
			}
		}

		void loadGameweekData()
		return () => {
			cancelled = true
		}
	}, [preseason, selectedGameweek, t])

	const formatStat = (
		value: number | null,
		fallbackTip = t('pendingOfficial'),
	) => (typeof value === 'number' ? String(value) : fallbackTip)
	const formatCount = (
		value: number | null,
		fallbackTip = t('notProvided'),
	) =>
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
		if (!eventMeta?.deadlineTime) return null
		const deadline = new Date(eventMeta.deadlineTime)
		if (Number.isNaN(deadline.getTime())) return null
		return formatter.dateTime(deadline, {
			dateStyle: 'medium',
			timeStyle: 'short',
		})
	})()
	const updatedLabel = (() => {
		if (!publishedAt) return null
		const updated = new Date(publishedAt)
		if (Number.isNaN(updated.getTime())) return null
		return formatter.dateTime(updated, {
			dateStyle: 'medium',
			timeStyle: 'short',
		})
	})()
	const isPreseasonSelection = preseason && selectedGameweek === 1
	const playerHref = useCallback(
		(player: { id: number }) => playerStatsHref({ p1: String(player.id) }),
		[],
	)

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<StatsPageHeader
					title={t('title')}
					badge={<GameweekBadge gameweek={selectedGameweek} />}
				/>
				<div className="-mt-4 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
					{statusLabel ? <Badge variant="secondary">{statusLabel}</Badge> : null}
					{deadlineLabel ? <span>{t('deadline', { value: deadlineLabel })}</span> : null}
					{updatedLabel ? <span>{t('updated', { value: updatedLabel })}</span> : null}
				</div>

				<div className="mb-6">
					<GameweekSelector
						onGameweekChange={setSelectedGameweek}
						currentGameweek={currentGameweek ?? 0}
						maxGameweek={maxGameweek}
						selectedGameweek={selectedGameweek}
					/>
				</div>

				{error ? (
					<Alert variant="destructive" className="mb-6">
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
							{t('overview', { gameweek: selectedGameweek })}
						</h2>
						{isLoadingOverall ? (
							<span className="font-mono text-[10px] uppercase tracking-wide text-white/50">
								{t('loadingOverview')}
							</span>
						) : null}
					</div>

					{isPreseasonSelection ? (
						<div className="px-4 py-6 sm:px-5">
							<p className="font-display text-lg font-bold text-white">
								{t('preseasonTitle')}
							</p>
							<p className="mt-1 text-sm text-white/65">
								{t('preseasonDescription')}
							</p>
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
									overallStats.averagePoints,
									t('awaitingAggregation'),
								)}
							</p>
						</div>
						<div className="px-4 py-4 sm:px-5 sm:py-5">
							<p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
								{t('highestPoints')}
							</p>
							<p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
								{formatStat(overallStats.highestPoints)}
							</p>
						</div>
							</div>

							<div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
						{(
							[
								{
									label: t('mostCaptained'),
									value: displayName(overallStats.mostCaptained.name),
								},
								{
									label: t('mostViceCaptained'),
									value: displayName(overallStats.mostViceCaptained.name),
								},
								{
									label: t('mostSelected'),
									value: displayName(overallStats.mostSelectedPlayer.name),
								},
								{
									label: t('mostTransferredIn'),
									value: displayName(overallStats.mostTransferInPlayer.name),
								},
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
									['benchBoost', overallStats.chipsPlayed?.benchBoost],
									['tripleCaptain', overallStats.chipsPlayed?.tripleCaptain],
									['wildcard', overallStats.chipsPlayed?.wildcard],
									['freeHit', overallStats.chipsPlayed?.freeHit],
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
					{isLoadingDetails ? (
						<p className="text-xs text-muted-foreground">{t('refreshing')}</p>
					) : null}

					{!isPreseasonSelection ? (
						<StatsSectionCard
							icon={Trophy}
							title={t('dreamTeamTitle', { gameweek: selectedGameweek })}
						>
						{isLoadingDetails ? (
							<p className="text-sm text-muted-foreground">
								{t('loadingDreamTeam')}
							</p>
						) : dreamTeam.length === 0 ? (
							<p className="text-sm text-muted-foreground">{t('noDreamTeam')}</p>
						) : (
							<PlayerList players={dreamTeam} playerHref={playerHref} />
						)}
						</StatsSectionCard>
					) : null}

					{!isPreseasonSelection ? (
						<StatsSectionCard
							icon={Star}
							title={t('doubleDigitHauls')}
							description={t('haulDescription')}
						>
						{isLoadingDetails ? (
							<p className="text-sm text-muted-foreground">
								{t('loadingHauls')}
							</p>
						) : haulPlayers.length === 0 ? (
							<p className="text-sm text-muted-foreground">{t('noHauls')}</p>
						) : (
							<PlayerList players={haulPlayers} playerHref={playerHref} />
						)}
						</StatsSectionCard>
					) : null}
				</div>

			</div>
		</PageShell>
	)
}
