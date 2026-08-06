'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import {
	StatsPageHeader,
	StatsTabsShell,
} from '@/components/stats/StatsSurfaces'
import { TournamentSelector } from '@/components/tournament/TournamentSelector'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePageActive } from '@/hooks/use-page-active'
import {
	SELECTIONS_UI_MOCK_ENABLED,
	getSelectionsUiMockStats,
} from '@/lib/dev/selections-ui-mock'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_SELECTION_STATS,
	type EntryTournamentsResponse,
	type TournamentSelectionStatsResponse,
	type TournamentStatPlayer,
} from '@/lib/graphql/operations/tournaments'
import {
	areTournamentInsightsReady,
	isTournamentSetupInFlight,
} from '@/lib/tournament/lifecycle'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import { Tournament } from '@/types/tournament'
import { Crown, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

function positionLabel(position: string): string {
	switch (position.toUpperCase()) {
		case 'GOALKEEPER':
			return 'GKP'
		case 'DEFENDER':
			return 'DEF'
		case 'MIDFIELDER':
			return 'MID'
		case 'FORWARD':
			return 'FWD'
		default:
			return position
	}
}

function StatRow({
	player,
	rank,
	leftLabel,
	leftValue,
	rightLabel,
	rightValue,
	barColor
}: {
	player: TournamentStatPlayer
	rank: number
	leftLabel: string
	leftValue: number
	rightLabel: string
	rightValue: number
	barColor: string
}) {
	const maxPercent = 100
	const barWidth = Math.min((leftValue / maxPercent) * 100, 100)
	return (
		<div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40">
			<span className="w-5 text-right font-mono text-xs font-medium tabular-nums text-muted-foreground">
				{rank}
			</span>
			<div className="min-w-0 flex-1">
				<div className="mb-0.5 flex items-center justify-between">
					<span className="mr-2 truncate text-sm font-medium">
						{player.webName}
					</span>
					<span className="shrink-0 text-[10px] text-muted-foreground">
						{player.teamShortName} · {positionLabel(player.position)}
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
						<div
							className={`h-full rounded-full transition-all duration-500 ${barColor}`}
							style={{ width: `${barWidth}%` }}
						/>
					</div>
				</div>
			</div>
			<div className="flex w-14 shrink-0 flex-col items-end">
				<span className="font-display text-xs font-semibold tabular-nums">
					{leftValue.toFixed(1)}%
				</span>
				<span className="text-[10px] tabular-nums text-muted-foreground">
					{rightValue.toFixed(1)}%
				</span>
			</div>
		</div>
	)
}

function StatList({
	data,
	leftLabel,
	leftField,
	rightLabel,
	rightField,
	barColor,
	sortBy
}: {
	data: TournamentStatPlayer[]
	leftLabel: string
	leftField: 'selectedByPercent' | 'eoByPercent' | 'captainByPercent'
	rightLabel: string
	rightField: 'selectedByPercent' | 'eoByPercent' | 'transfersEvent'
	barColor: string
	sortBy?: 'selectedByPercent' | 'eoByPercent' | 'transfersEvent' | 'captainByPercent'
}) {
	const t = useTranslations('Selections')
	const sorted = sortBy
		? [...data].sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0))
		: data
	if (data.length === 0) {
		return (
			<div className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
				{t('noData')}
			</div>
		)
	}
	return (
		<div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
			<div className="grid grid-cols-[1.5rem_1fr_3.5rem] items-center gap-x-2 border-b border-border/60 bg-muted/30 px-3 py-2">
				<span />
				<span className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					{t('player')}
				</span>
				<div className="flex flex-col items-end">
					<span className="text-[10px] font-medium text-muted-foreground">
						{leftLabel} %
					</span>
					<span className="text-[10px] font-medium text-muted-foreground">
						{rightLabel} %
					</span>
				</div>
			</div>
			{sorted.map((p, i) => (
				<StatRow
					key={p.id}
					player={p}
					rank={i + 1}
					leftLabel={leftLabel}
					leftValue={p[leftField] ?? 0}
					rightLabel={rightLabel}
					rightValue={p[rightField] ?? 0}
					barColor={barColor}
				/>
			))}
		</div>
	)
}

interface StatsResult {
	selection: TournamentStatPlayer[]
	captain: TournamentStatPlayer[]
	transferIn: TournamentStatPlayer[]
	transferOut: TournamentStatPlayer[]
}

interface SelectionsClientProps {
	entryId: number
	initialTournaments: Tournament[]
	initialSelectedTournamentId: string
	initialStats: StatsResult | null
	initialGameweek: number
}

export default function SelectionsClient({
	entryId,
	initialTournaments,
	initialSelectedTournamentId,
	initialStats,
	initialGameweek,
}: SelectionsClientProps) {
	const t = useTranslations('Selections')
	const lifecycleT = useTranslations('TournamentLifecycle')
	const pageActive = usePageActive()
	const [tournaments, setTournaments] = useState<Tournament[]>(initialTournaments)
	const [selectedTournamentId, setSelectedTournamentId] = useState<string>(initialSelectedTournamentId)
	const [currentGameweek] = useState<number>(initialGameweek)
	const [selectedGameweek, setSelectedGameweek] = useState<number>(initialGameweek)
	const statsCache = useRef<Map<string, StatsResult>>(
		new Map(initialStats && initialSelectedTournamentId
			? [[`${initialSelectedTournamentId}:${initialGameweek}`, initialStats]]
			: [])
	)
	const statsRequestIdRef = useRef(0)
	const [isLoadingTournaments] = useState(false)
	const [isLoadingStats, setIsLoadingStats] = useState(false)
	const [selectionData, setSelectionData] = useState<TournamentStatPlayer[]>(initialStats?.selection ?? [])
	const [captainData, setCaptainData] = useState<TournamentStatPlayer[]>(initialStats?.captain ?? [])
	const [transferInData, setTransferInData] = useState<TournamentStatPlayer[]>(
		initialStats?.transferIn ?? []
	)
	const [transferOutData, setTransferOutData] = useState<
		TournamentStatPlayer[]
	>(initialStats?.transferOut ?? [])
	const selectedTournament = tournaments.find(
		tournament => tournament.id === selectedTournamentId,
	)
	const insightsReady = selectedTournament
		? areTournamentInsightsReady(selectedTournament)
		: false

	const fetchStats = useCallback(
		async (tournamentId: number, eventId: number) => {
			const requestId = statsRequestIdRef.current + 1
			statsRequestIdRef.current = requestId
			const cacheKey = `${tournamentId}:${eventId}`
			const cached = statsCache.current.get(cacheKey)
			if (cached) {
				setSelectionData(cached.selection)
				setCaptainData(cached.captain)
				setTransferInData(cached.transferIn)
				setTransferOutData(cached.transferOut)
				setIsLoadingStats(false)
				return
			}
			setIsLoadingStats(true)
			try {
				// TEMP UI mock — remove with lib/dev/selections-ui-mock.ts
				const result: StatsResult = SELECTIONS_UI_MOCK_ENABLED
					? getSelectionsUiMockStats()
					: await (async () => {
							const data =
								await executeQuery<TournamentSelectionStatsResponse>(
									GET_TOURNAMENT_SELECTION_STATS,
									{ tournamentId, eventId, limit: 10 },
								)
							const stats = data.tournamentSelectionStats
							return {
								selection: stats?.mostSelectedPlayers ?? [],
								captain: stats?.captainSelect ?? [],
								transferIn: stats?.mostTransferIn ?? [],
								transferOut: stats?.mostTransferOut ?? [],
							}
						})()
				if (requestId !== statsRequestIdRef.current) return
				statsCache.current.set(cacheKey, result)
				setSelectionData(result.selection)
				setCaptainData(result.captain)
				setTransferInData(result.transferIn)
				setTransferOutData(result.transferOut)
			} catch {
				if (requestId !== statsRequestIdRef.current) return
				setSelectionData([])
				setCaptainData([])
				setTransferInData([])
				setTransferOutData([])
			} finally {
				if (requestId === statsRequestIdRef.current) setIsLoadingStats(false)
			}
		},
		[]
	)

	useEffect(() => {
		if (
			!pageActive ||
			!selectedTournament ||
			insightsReady ||
			!isTournamentSetupInFlight(selectedTournament.setupStatus)
		) {
			return
		}

		let cancelled = false
		let timer: number | undefined
		const poll = async () => {
			try {
				const data = await executeQuery<EntryTournamentsResponse>(GET_ENTRY_TOURNAMENTS, {
					entryId,
				})
				if (!cancelled) {
					setTournaments(data.entryTournaments.map(mapEntryTournamentToLiveTournament))
				}
			} catch (pollError) {
				console.warn('Tournament setup status unavailable:', pollError)
			} finally {
				if (!cancelled) timer = window.setTimeout(poll, 5_000)
			}
		}

		timer = window.setTimeout(poll, 5_000)
		return () => {
			cancelled = true
			if (timer !== undefined) window.clearTimeout(timer)
		}
	}, [entryId, insightsReady, pageActive, selectedTournament])

	useEffect(() => {
		if (!selectedTournament || !insightsReady) {
			statsRequestIdRef.current += 1
			const resetTimer = window.setTimeout(() => {
				setIsLoadingStats(false)
				setSelectionData([])
				setCaptainData([])
				setTransferInData([])
				setTransferOutData([])
			}, 0)
			return () => window.clearTimeout(resetTimer)
		}

		const tid = Number(selectedTournament.id)
		if (tid > 0 && selectedGameweek > 0) void fetchStats(tid, selectedGameweek)
	}, [fetchStats, insightsReady, selectedGameweek, selectedTournament])

	const subtitle = selectedTournament
		? `${selectedTournament.name} · GW${selectedGameweek}`
		: `GW${selectedGameweek}`

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<StatsPageHeader
					eyebrow={t('selections')}
					title={t('title')}
					badge={
						<span className="inline-flex w-fit items-center rounded-md bg-plum px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.14em] text-electric">
							GW{selectedGameweek}
						</span>
					}
				/>
				{subtitle && selectedTournament ? (
					<p className="-mt-4 mb-6 truncate text-sm text-muted-foreground">
						{selectedTournament.name}
					</p>
				) : null}

				{/* Pickers */}
				<div className="mb-5 space-y-4 sm:mb-6">
					{isLoadingTournaments ? (
						<div className="rounded-lg border border-border/80 bg-card p-4 text-sm text-muted-foreground shadow-sm">
							{t('loadingTournaments')}
						</div>
					) : tournaments.length > 0 ? (
						<TournamentSelector
							tournaments={tournaments}
							currentTournamentId={selectedTournamentId}
							onTournamentChange={setSelectedTournamentId}
							className="border-border/80 p-4 shadow-sm"
						/>
					) : (
						<div className="rounded-lg border border-border/80 bg-card p-4 text-sm text-muted-foreground shadow-sm">
							{t('noTournaments')}
						</div>
					)}

					<GameweekSelector
						currentGameweek={currentGameweek}
						selectedGameweek={selectedGameweek}
						onGameweekChange={setSelectedGameweek}
						disabled={
							isLoadingStats ||
							Boolean(selectedTournament && !insightsReady)
						}
					/>
				</div>

				{selectedTournament && !insightsReady ? (
					<div
						className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm"
						aria-live="polite"
					>
						{selectedTournament.setupStatus === 'FAILED'
							? lifecycleT('memberFailure')
							: selectedTournament.setupHasWarnings
								? lifecycleT('warningSummary')
								: selectedTournament.standingsReadyAt
									? lifecycleT('enrichingMessage')
									: lifecycleT('leavePageMessage')}
					</div>
				) : (
					<Tabs defaultValue="selections" className="space-y-5">
						<StatsTabsShell>
							<TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
								<TabsTrigger value="selections" className="gap-1.5">
									<Users className="size-3.5 shrink-0" aria-hidden="true" />
									<span className="truncate">{t('selections')}</span>
								</TabsTrigger>
								<TabsTrigger value="captain" className="gap-1.5">
									<Crown className="size-3.5 shrink-0" aria-hidden="true" />
									<span className="truncate">{t('captain')}</span>
								</TabsTrigger>
								<TabsTrigger value="transfers-in" className="gap-1.5">
									<TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
									<span className="truncate">{t('transfersIn')}</span>
								</TabsTrigger>
								<TabsTrigger value="transfers-out" className="gap-1.5">
									<TrendingDown
										className="size-3.5 shrink-0"
										aria-hidden="true"
									/>
									<span className="truncate">{t('transfersOut')}</span>
								</TabsTrigger>
							</TabsList>
						</StatsTabsShell>

						<div className="mx-auto max-w-lg">
							<TabsContent value="selections" className="mt-0">
								{isLoadingStats ? (
									<div className="rounded-lg border border-border/80 bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
										{t('loading')}
									</div>
								) : (
									<StatList
										data={selectionData}
										leftLabel={t('selected')}
										leftField="selectedByPercent"
										rightLabel={t('effectiveOwnership')}
										rightField="eoByPercent"
										barColor="bg-primary/70"
									/>
								)}
							</TabsContent>

							<TabsContent value="captain" className="mt-0">
								{isLoadingStats ? (
									<div className="rounded-lg border border-border/80 bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
										{t('loading')}
									</div>
								) : (
									<StatList
										data={captainData}
										leftLabel={t('captainShort')}
										leftField="captainByPercent"
										rightLabel={t('effectiveOwnership')}
										rightField="eoByPercent"
										barColor="bg-muted-foreground/60"
										sortBy="captainByPercent"
									/>
								)}
							</TabsContent>

							<TabsContent value="transfers-in" className="mt-0">
								{isLoadingStats ? (
									<div className="rounded-lg border border-border/80 bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
										{t('loading')}
									</div>
								) : (
									<StatList
										data={transferInData}
										leftLabel={t('inPercent')}
										leftField="selectedByPercent"
										rightLabel={t('count')}
										rightField="transfersEvent"
										barColor="bg-success/70"
										sortBy="transfersEvent"
									/>
								)}
							</TabsContent>

							<TabsContent value="transfers-out" className="mt-0">
								{isLoadingStats ? (
									<div className="rounded-lg border border-border/80 bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
										{t('loading')}
									</div>
								) : (
									<StatList
										data={transferOutData}
										leftLabel={t('outPercent')}
										leftField="selectedByPercent"
										rightLabel={t('count')}
										rightField="transfersEvent"
										barColor="bg-destructive/70"
										sortBy="transfersEvent"
									/>
								)}
							</TabsContent>
						</div>
					</Tabs>
				)}
			</div>
		</PageShell>
	)
}
