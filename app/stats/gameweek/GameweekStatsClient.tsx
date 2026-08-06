'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import { TransferList } from '@/components/home/TransferList'
import PageShell from '@/components/layout/PageShell'
import { PlayerList } from '@/components/player/PlayerList'
import {
	StatsMetricTile,
	StatsPageHeader,
	StatsSectionCard,
	StatsTabsShell,
} from '@/components/stats/StatsSurfaces'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	GAMEWEEK_STATS_UI_MOCK_ENABLED,
	getGameweekStatsUiMockLiveScores,
	getGameweekStatsUiMockOverall,
	getGameweekStatsUiMockTransfersIn,
	getGameweekStatsUiMockTransfersOut,
} from '@/lib/dev/gameweek-stats-ui-mock'
import {
	FALLBACK_OVERALL_STATS,
	fetchOverallGameweekStats,
	type OverallGameweekStats,
} from '@/lib/gameweek-overall-stats'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_LIVE_SCORES,
	type LiveScoresResponse,
} from '@/lib/graphql/operations/live'
import {
	GET_TOP_TRANSFERS_IN,
	GET_TOP_TRANSFERS_OUT,
	type TopTransfer,
	type TopTransfersResponse,
} from '@/lib/graphql/operations/prices'
import { normalizePosition, type PositionCode } from '@/lib/utils'
import {
	ArrowLeftCircle,
	ArrowRightCircle,
	BarChart2,
	Star,
	TrendingUp,
	Trophy,
} from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'

interface DreamTeamPlayer {
	id: number
	name: string
	position: string
	team: string | null
	points: number
	price: number | null
	minutes: number | null
	stats: {
		goals: number | null
		assists: number | null
		cleanSheets: number | null
		bonusPoints: number | null
	}
}

interface HaulPlayer {
	id: number
	name: string
	position: string
	team: string | null
	points: number
	ownedBy: number | null
	captainedBy: number | null
	stats: {
		goals: number | null
		assists: number | null
		cleanSheets: number | null
		bonusPoints: number | null
	}
}

interface TransferTrend {
	id: number
	name: string
	position: string
	team: string
	price: number | null
	priceChange: number | null
	transferCount: number
	selectedByPercent: number | null
	points: number | null
}

const POSITION_ORDER: Record<PositionCode, number> = {
	GKP: 0,
	DEF: 1,
	MID: 2,
	FWD: 3,
	UNK: 99,
}

const mapTransferTrend = (
	entry: TopTransfer,
	type: 'in' | 'out',
): TransferTrend => ({
	id: entry.player.id,
	name: entry.player.webName,
	position: normalizePosition(entry.player.position),
	team: entry.player.team?.shortName ?? entry.player.team?.name ?? 'N/A',
	price: null,
	priceChange: null,
	transferCount:
		type === 'in' ? entry.transfersInEvent : entry.transfersOutEvent,
	selectedByPercent: entry.player.selectedByPercent ?? null,
	points: entry.player.totalPoints ?? null,
})

interface GameweekStatsClientProps {
	currentGameweek: number
	initialOverallStats?: OverallGameweekStats | null
}

export default function GameweekStatsClient({
	currentGameweek: initialCurrentGameweek,
	initialOverallStats = null,
}: GameweekStatsClientProps) {
	const t = useTranslations('GameweekStats')
	const formatter = useFormatter()
	const [currentGameweek] = useState<number>(initialCurrentGameweek)
	const [selectedGameweek, setSelectedGameweek] = useState<number>(
		initialCurrentGameweek,
	)
	const [activeTab, setActiveTab] = useState<
		'overall' | 'dreamteam' | 'haul' | 'transfers'
	>('overall')
	const [overallStats, setOverallStats] = useState<OverallGameweekStats>(
		initialOverallStats ?? FALLBACK_OVERALL_STATS,
	)
	const [dreamTeam, setDreamTeam] = useState<DreamTeamPlayer[]>([])
	const [transferTrends, setTransferTrends] = useState<{
		in: TransferTrend[]
		out: TransferTrend[]
	}>({ in: [], out: [] })
	const [isLoadingDetails, setIsLoadingDetails] = useState(false)
	const [isLoadingOverall, setIsLoadingOverall] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const overallCacheRef = useRef<Map<number, OverallGameweekStats>>(
		new Map(
			initialOverallStats && initialCurrentGameweek
				? [[initialCurrentGameweek, initialOverallStats]]
				: [],
		),
	)
	const dreamCacheRef = useRef<Map<number, DreamTeamPlayer[]>>(new Map())
	const transfersCacheRef = useRef<
		Map<number, { in: TransferTrend[]; out: TransferTrend[] }>
	>(new Map())

	useEffect(() => {
		let cancelled = false

		const loadGameweekData = async () => {
			try {
				setError(null)

				const shouldLoadDream =
					activeTab === 'dreamteam' || activeTab === 'haul'
				const shouldLoadTransfers = activeTab === 'transfers'
				const needsDreamFetch =
					shouldLoadDream && !dreamCacheRef.current.has(selectedGameweek)
				const needsTransfersFetch =
					shouldLoadTransfers &&
					!transfersCacheRef.current.has(selectedGameweek)
				setIsLoadingDetails(needsDreamFetch || needsTransfersFetch)

				const cachedOverall = overallCacheRef.current.get(selectedGameweek)
				if (cachedOverall) {
					setIsLoadingOverall(false)
					if (!cancelled) setOverallStats(cachedOverall)
				} else {
					setIsLoadingOverall(true)
					// TEMP UI mock — GraphQL-shaped overall snapshot
					const overallSnapshot = GAMEWEEK_STATS_UI_MOCK_ENABLED
						? getGameweekStatsUiMockOverall(selectedGameweek)
						: await fetchOverallGameweekStats(selectedGameweek)
					overallCacheRef.current.set(selectedGameweek, overallSnapshot)
					if (!cancelled) setOverallStats(overallSnapshot)
					setIsLoadingOverall(false)
				}

				if (shouldLoadDream) {
					const cachedDream = dreamCacheRef.current.get(selectedGameweek)
					if (cachedDream) {
						if (!cancelled) setDreamTeam(cachedDream)
					} else {
						const liveScoresData: LiveScoresResponse =
							GAMEWEEK_STATS_UI_MOCK_ENABLED
								? getGameweekStatsUiMockLiveScores(selectedGameweek)
								: await executeQuery<LiveScoresResponse>(GET_LIVE_SCORES, {
										eventId: selectedGameweek,
									})
						const mappedDreamTeam: DreamTeamPlayer[] = liveScoresData.liveScores
							.filter(entry => entry.inDreamTeam)
							.map(entry => ({
								id: entry.player.id,
								name: entry.player.webName,
								position: normalizePosition(entry.player.position),
								team:
									entry.player.team?.shortName ??
									entry.player.team?.name ??
									null,
								points: entry.totalPoints,
								price: entry.player.price ?? null,
								minutes: entry.minutes ?? null,
								stats: {
									goals: entry.goalsScored ?? null,
									assists: entry.assists ?? null,
									cleanSheets: entry.cleanSheets ?? null,
									bonusPoints: entry.bonus ?? null,
								},
							}))
							.sort((a, b) => {
								const positionDiff =
									POSITION_ORDER[a.position as PositionCode] -
									POSITION_ORDER[b.position as PositionCode]
								return positionDiff !== 0
									? positionDiff
									: b.points - a.points
							})
						dreamCacheRef.current.set(selectedGameweek, mappedDreamTeam)
						if (!cancelled) setDreamTeam(mappedDreamTeam)
					}
				}

				if (shouldLoadTransfers) {
					const cachedTransfers =
						transfersCacheRef.current.get(selectedGameweek)
					if (cachedTransfers) {
						if (!cancelled) setTransferTrends(cachedTransfers)
					} else {
						const [inData, outData] = GAMEWEEK_STATS_UI_MOCK_ENABLED
							? [
									getGameweekStatsUiMockTransfersIn(selectedGameweek),
									getGameweekStatsUiMockTransfersOut(selectedGameweek),
								]
							: await Promise.all([
									executeQuery<TopTransfersResponse>(GET_TOP_TRANSFERS_IN, {
										eventId: selectedGameweek,
										limit: 5,
									}),
									executeQuery<TopTransfersResponse>(GET_TOP_TRANSFERS_OUT, {
										eventId: selectedGameweek,
										limit: 5,
									}),
								])
						const transferSnapshot = {
							in: (inData.topTransfersIn ?? []).map(entry =>
								mapTransferTrend(entry, 'in'),
							),
							out: ((outData as TopTransfersResponse).topTransfersOut ?? []).map(
								entry => mapTransferTrend(entry, 'out'),
							),
						}
						transfersCacheRef.current.set(selectedGameweek, transferSnapshot)
						if (!cancelled) setTransferTrends(transferSnapshot)
					}
				}
			} catch (err) {
				console.error('Failed to load selected gameweek stats:', err)
				if (!cancelled) {
					setError(t('loadFailed'))
					if (activeTab === 'dreamteam' || activeTab === 'haul') setDreamTeam([])
					if (activeTab === 'transfers')
						setTransferTrends({ in: [], out: [] })
					setOverallStats(FALLBACK_OVERALL_STATS)
					setIsLoadingOverall(false)
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
	}, [activeTab, initialCurrentGameweek, selectedGameweek, t])

	const haulPlayers = useMemo<HaulPlayer[]>(
		() =>
			dreamTeam
				.filter(player => player.points >= 10)
				.map(player => ({
					id: player.id,
					name: player.name,
					position: player.position,
					team: player.team,
					points: player.points,
					ownedBy: null,
					captainedBy: null,
					stats: player.stats,
				}))
				.sort((a, b) => b.points - a.points),
		[dreamTeam],
	)

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

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<StatsPageHeader
					eyebrow={t('overall')}
					title={t('title')}
					badge={
						<span className="inline-flex w-fit items-center rounded-md bg-plum px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.14em] text-electric">
							GW{selectedGameweek}
						</span>
					}
				/>

				{error ? (
					<Alert variant="destructive" className="mb-6">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}

				<div className="mb-5 sm:mb-6">
					<GameweekSelector
						onGameweekChange={setSelectedGameweek}
						currentGameweek={currentGameweek}
						selectedGameweek={selectedGameweek}
					/>
				</div>

				<Tabs
					value={activeTab}
					onValueChange={value => setActiveTab(value as typeof activeTab)}
					className="space-y-5"
				>
					<StatsTabsShell>
						<TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
							<TabsTrigger value="overall" className="gap-1.5">
								<BarChart2 className="size-3.5 shrink-0" aria-hidden="true" />
								<span className="truncate">{t('overall')}</span>
							</TabsTrigger>
							<TabsTrigger value="dreamteam" className="gap-1.5">
								<Trophy className="size-3.5 shrink-0" aria-hidden="true" />
								<span className="truncate">{t('dreamTeam')}</span>
							</TabsTrigger>
							<TabsTrigger value="haul" className="gap-1.5">
								<Star className="size-3.5 shrink-0" aria-hidden="true" />
								<span className="truncate">{t('haul')}</span>
							</TabsTrigger>
							<TabsTrigger value="transfers" className="gap-1.5">
								<TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
								<span className="truncate">{t('transfers')}</span>
							</TabsTrigger>
						</TabsList>
					</StatsTabsShell>

					<TabsContent value="overall" className="mt-0 space-y-5">
						<StatsSectionCard
							icon={BarChart2}
							title={t('overview', { gameweek: selectedGameweek })}
						>
							{isLoadingOverall ? (
								<p className="mb-3 text-xs text-muted-foreground">
									{t('loadingOverview')}
								</p>
							) : null}

							<div className="mb-4 grid grid-cols-2 gap-3 sm:mb-5 sm:gap-4">
								<StatsMetricTile
									label={t('averagePoints')}
									value={formatStat(
										overallStats.averagePoints,
										t('awaitingAggregation'),
									)}
								/>
								<StatsMetricTile
									label={t('highestPoints')}
									value={formatStat(overallStats.highestPoints)}
								/>
								<StatsMetricTile
									label={t('mostCaptained')}
									value={displayName(overallStats.mostCaptained.name)}
								/>
								<StatsMetricTile
									label={t('mostViceCaptained')}
									value={displayName(overallStats.mostViceCaptained.name)}
								/>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
								<StatsMetricTile
									icon={
										<ArrowRightCircle
											className="size-4"
											aria-hidden="true"
										/>
									}
									label={t('mostSelected')}
									value={displayName(overallStats.mostSelectedPlayer.name)}
								/>
								<StatsMetricTile
									icon={
										<ArrowLeftCircle
											className="size-4"
											aria-hidden="true"
										/>
									}
									label={t('mostTransferredIn')}
									value={displayName(overallStats.mostTransferInPlayer.name)}
								/>
							</div>
						</StatsSectionCard>

						<StatsSectionCard icon={Star} title={t('chipsPlayed')}>
							<div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
								{(
									[
										['benchBoost', overallStats.chipsPlayed?.benchBoost],
										[
											'tripleCaptain',
											overallStats.chipsPlayed?.tripleCaptain,
										],
										['wildcard', overallStats.chipsPlayed?.wildcard],
										['freeHit', overallStats.chipsPlayed?.freeHit],
									] as const
								).map(([key, value]) => (
									<StatsMetricTile
										key={key}
										label={t(key)}
										value={formatCount(value ?? null, t('noChipUsage'))}
									/>
								))}
							</div>
						</StatsSectionCard>
					</TabsContent>

					<TabsContent value="dreamteam" className="mt-0">
						<StatsSectionCard
							icon={Trophy}
							title={t('dreamTeamTitle', { gameweek: selectedGameweek })}
						>
							{isLoadingDetails ? (
								<p className="text-sm text-muted-foreground">
									{t('loadingDreamTeam')}
								</p>
							) : dreamTeam.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									{t('noDreamTeam')}
								</p>
							) : (
								<PlayerList players={dreamTeam} />
							)}
						</StatsSectionCard>
					</TabsContent>

					<TabsContent value="haul" className="mt-0">
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
								<PlayerList players={haulPlayers} />
							)}
						</StatsSectionCard>
					</TabsContent>

					<TabsContent value="transfers" className="mt-0">
						{isLoadingDetails ? (
							<Card className="border-border/80 p-6 shadow-sm">
								<p className="text-sm text-muted-foreground">
									{t('loadingTransfers')}
								</p>
							</Card>
						) : (
							<Card className="space-y-8 border-border/80 p-4 shadow-sm sm:p-6">
								<TransferList
									title={t('topTransfersIn')}
									type="in"
									transfers={transferTrends.in.map(trend => ({
										position: trend.position,
										player: trend.name,
										club: trend.team,
										transfers: trend.transferCount,
										selectedByPercent: trend.selectedByPercent,
										points: trend.points,
									}))}
								/>
								<TransferList
									title={t('topTransfersOut')}
									type="out"
									transfers={transferTrends.out.map(trend => ({
										position: trend.position,
										player: trend.name,
										club: trend.team,
										transfers: trend.transferCount,
										selectedByPercent: trend.selectedByPercent,
										points: trend.points,
									}))}
								/>
							</Card>
						)}
					</TabsContent>
				</Tabs>

				{isLoadingDetails ? (
					<p className="mt-4 text-xs text-muted-foreground">{t('refreshing')}</p>
				) : null}
			</div>
		</PageShell>
	)
}
