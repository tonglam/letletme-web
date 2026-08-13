'use client'

import {
	buildLeagueTrendSummary,
	leagueTrendKey,
	type InitialLeagueTrendsSelection,
	type LeagueTrendsScope
} from '@/app/data/selections/_lib/league-trends'
import {
	buildSelectionsShareUrl,
	formatCaptainShareText,
	formatOwnershipShareText,
	formatTransferShareText
} from '@/app/data/selections/_lib/selections-share'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { copyTextToClipboard } from '@/app/live/points/_lib/live-points-share'
import { ShareTextFallback } from '@/components/share/ShareTextFallback'
import {
	isKnownTournamentId,
	readLastTournamentId,
	writeLastTournamentId
} from '@/app/me/tournament/_lib/tournament-stats-preference'
import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import {
	StatsMetricTile,
	StatsPageHeader
} from '@/components/stats/StatsSurfaces'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { usePageActive } from '@/hooks/use-page-active'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY_EVENT_RESULT,
	type EntryEventPick,
	type EntryEventResultResponse
} from '@/lib/graphql/operations/entries'
import {
	GET_PUBLIC_LEAGUE_SELECTION_STATS,
	type PublicLeagueSelectionStatsResponse,
	type PublicLeagueTrend
} from '@/lib/graphql/operations/leagues'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_SELECTION_STATS,
	type EntryTournamentsResponse,
	type TournamentSelectionStatsData,
	type TournamentSelectionStatsResponse,
	type TournamentStatPlayer
} from '@/lib/graphql/operations/tournaments'
import { positionBadgeClass } from '@/lib/position-style'
import {
	areTournamentInsightsReady,
	isTournamentSetupInFlight
} from '@/lib/tournament/lifecycle'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import { cn, normalizePosition } from '@/lib/utils'
import type { Tournament } from '@/types/tournament'
import {
	ArrowRight,
	Check,
	Copy,
	Crown,
	RefreshCw,
	TrendingDown,
	TrendingUp,
	Users
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode
} from 'react'
import { toast } from 'sonner'

export interface StatsResult {
	totalEntries: number
	selection: TournamentStatPlayer[]
	captain: TournamentStatPlayer[]
	transferIn: TournamentStatPlayer[]
	transferOut: TournamentStatPlayer[]
}

interface SelectionsClientProps {
	entryId: number
	initialTournaments: Tournament[]
	publicLeagues: PublicLeagueTrend[]
	initialSelection: InitialLeagueTrendsSelection
	initialStats: StatsResult | null
	initialEntryPicks: EntryEventPick[]
	currentGameweek: number
	myLeaguesLoadFailed: boolean
	publicLeaguesLoadFailed: boolean
	initialStatsLoadFailed: boolean
}

type LoadState = 'loading' | 'ready' | 'empty' | 'unavailable' | 'error'
type PlayerRole = 'OWNED' | 'CAPTAIN' | 'VICE'
type CachedDesk = { stats: StatsResult; entryPicks: EntryEventPick[] }

const EMPTY_STATS: StatsResult = {
	totalEntries: 0,
	selection: [],
	captain: [],
	transferIn: [],
	transferOut: []
}

function toStatsResult(
	stats: TournamentSelectionStatsData | null | undefined
): StatsResult {
	return {
		totalEntries: stats?.totalEntries ?? 0,
		selection: stats?.mostSelectedPlayers ?? [],
		captain: stats?.captainSelect ?? [],
		transferIn: stats?.mostTransferIn ?? [],
		transferOut: stats?.mostTransferOut ?? []
	}
}

function isEmptyStats(stats: StatsResult): boolean {
	return (
		stats.totalEntries === 0 &&
		stats.selection.length === 0 &&
		stats.captain.length === 0 &&
		stats.transferIn.length === 0 &&
		stats.transferOut.length === 0
	)
}

function parseLeagueTrendKey(
	value: string
): { scope: LeagueTrendsScope; tournamentId: number } | null {
	const [scope, rawId, ...rest] = value.split(':')
	const tournamentId = Number(rawId)
	if (
		rest.length > 0 ||
		(scope !== 'mine' && scope !== 'public') ||
		!Number.isInteger(tournamentId) ||
		tournamentId <= 0
	) {
		return null
	}
	return { scope, tournamentId }
}

function SectionTitle({
	id,
	children,
	hint,
	action
}: {
	id: string
	children: ReactNode
	hint?: string
	action?: ReactNode
}) {
	return (
		<div className="mb-3 flex flex-col gap-2 border-b border-border/60 pb-2 sm:flex-row sm:items-end sm:justify-between">
			<div className="min-w-0">
				<h2
					id={id}
					className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
				>
					{children}
				</h2>
				{hint ? (
					<p className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</p>
				) : null}
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	)
}

function SectionShareActions({ getText }: { getText: () => string }) {
	const t = useTranslations('Selections')
	const [copied, setCopied] = useState(false)
	const [manualShareText, setManualShareText] = useState<string | null>(null)

	const handleCopy = useCallback(async () => {
		const text = getText()
		const result = await copyTextToClipboard(text)
		if (result === 'copied') {
			setManualShareText(null)
			setCopied(true)
			toast.success(t('shareCopied'))
			window.setTimeout(() => setCopied(false), 2000)
		} else if (result === 'unsupported' || result === 'failed') {
			setManualShareText(text)
			toast.warning(
				result === 'unsupported'
					? t('shareCopyUnsupported')
					: t('shareCopyFailed')
			)
		}
	}, [getText, t])

	return (
		<div className="flex flex-col items-end gap-1.5">
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="h-8 gap-1.5 text-xs"
				onClick={() => void handleCopy()}
				aria-label={t('shareCopy')}
			>
				{copied ? (
					<Check
						className="size-3.5 text-primary-ink"
						aria-hidden="true"
					/>
				) : (
					<Copy
						className="size-3.5"
						aria-hidden="true"
					/>
				)}
				{copied ? t('shareCopiedShort') : t('shareCopy')}
			</Button>
			{manualShareText ? (
				<ShareTextFallback
					text={manualShareText}
					message={t('shareCopyUnsupported')}
					fieldLabel={t('shareCopyManualLabel')}
					closeLabel={t('shareCopyClose')}
					onClose={() => setManualShareText(null)}
				/>
			) : null}
		</div>
	)
}

function EmptyHint({ children }: { children: ReactNode }) {
	return (
		<p
			className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground"
			role="status"
		>
			{children}
		</p>
	)
}

function PositionBadge({ position }: { position: string }) {
	const code = normalizePosition(position)
	return (
		<Badge
			className={cn(
				positionBadgeClass(code),
				'shrink-0 px-1.5 py-0 text-[10px] font-bold'
			)}
		>
			{code === 'UNK' ? '—' : code}
		</Badge>
	)
}

function PlayerRoles({ roles }: { roles: PlayerRole[] }) {
	const t = useTranslations('Selections')
	if (roles.length === 0) return null
	return (
		<div className="mt-1 flex flex-wrap gap-1">
			{roles.map(role => (
				<Badge
					key={role}
					variant="outline"
					className="px-1 py-0 text-[9px]"
				>
					{role === 'CAPTAIN'
						? t('roleCaptain')
						: role === 'VICE'
							? t('roleVice')
							: t('roleOwned')}
				</Badge>
			))}
		</div>
	)
}

function formatPercent(value: number | undefined | null): string {
	if (value == null || !Number.isFinite(value)) return '—'
	return `${value.toFixed(1)}%`
}

function formatCount(value: number | undefined | null): string {
	if (value == null || !Number.isFinite(value)) return '—'
	return String(Math.round(value))
}

function formatExposure(value: number | undefined | null): string {
	if (value == null || !Number.isFinite(value)) return '—'
	return `${value > 0 ? '+' : ''}${value.toFixed(2)}x`
}

type RankMetric = {
	primary: string
	secondary?: string
	magnitude: number
	tone: 'default' | 'success' | 'destructive' | 'captain'
}

function PlayerRankRow({
	rank,
	player,
	metric,
	roles = []
}: {
	rank: number
	player: TournamentStatPlayer
	metric: RankMetric
	roles?: PlayerRole[]
}) {
	const barTone =
		metric.tone === 'success'
			? 'bg-success'
			: metric.tone === 'destructive'
				? 'bg-destructive'
				: metric.tone === 'captain'
					? 'bg-plum dark:bg-electric'
					: 'bg-primary'

	return (
		<li className="relative overflow-hidden border-b border-border/40 last:border-b-0">
			<span
				aria-hidden="true"
				className={cn('absolute inset-y-0 left-0 opacity-[0.08]', barTone)}
				style={{ width: `${Math.max(metric.magnitude * 100, 3)}%` }}
			/>
			<div className="relative flex items-center gap-2.5 px-3 py-2.5">
				<span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
					{rank}
				</span>
				<PositionBadge position={player.position} />
				<div className="min-w-0 flex-1">
					<Link
						href={playerStatsHref({ p1: String(player.id) })}
						className="block truncate text-sm font-medium leading-tight hover:underline"
					>
						{player.webName}
					</Link>
					<p className="truncate text-[11px] text-muted-foreground">
						{player.teamShortName}
					</p>
					<PlayerRoles roles={roles} />
				</div>
				<div className="shrink-0 text-right">
					<p className="font-mono text-sm font-semibold tabular-nums tracking-tight text-primary-ink">
						{metric.primary}
					</p>
					{metric.secondary ? (
						<p className="text-[11px] tabular-nums text-muted-foreground">
							{metric.secondary}
						</p>
					) : null}
				</div>
			</div>
		</li>
	)
}

function MetricBoard({
	players,
	emptyLabel,
	ariaLabel,
	getMetric,
	rolesByPlayerId
}: {
	players: TournamentStatPlayer[]
	emptyLabel: string
	ariaLabel: string
	getMetric: (player: TournamentStatPlayer) => RankMetric
	rolesByPlayerId?: Map<number, PlayerRole[]>
}) {
	if (players.length === 0) return <EmptyHint>{emptyLabel}</EmptyHint>
	return (
		<ul
			className="overflow-hidden rounded-lg border border-border/60 bg-muted/15 dark:bg-muted/10"
			aria-label={ariaLabel}
		>
			{players.map((player, i) => (
				<PlayerRankRow
					key={player.id}
					rank={i + 1}
					player={player}
					metric={getMetric(player)}
					roles={rolesByPlayerId?.get(player.id) ?? []}
				/>
			))}
		</ul>
	)
}

function ExpandableMetricBoard({
	players,
	expanded,
	onExpandedChange,
	...props
}: {
	players: TournamentStatPlayer[]
	expanded: boolean
	onExpandedChange: (expanded: boolean) => void
	emptyLabel: string
	ariaLabel: string
	getMetric: (player: TournamentStatPlayer) => RankMetric
	rolesByPlayerId?: Map<number, PlayerRole[]>
}) {
	const t = useTranslations('Selections')
	const visiblePlayers = expanded ? players.slice(0, 12) : players.slice(0, 5)
	return (
		<div>
			<MetricBoard
				players={visiblePlayers}
				{...props}
			/>
			{players.length > 5 ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="mt-2 w-full text-xs"
					onClick={() => onExpandedChange(!expanded)}
				>
					{expanded ? t('showTopFive') : t('showTopTwelve')}
				</Button>
			) : null}
		</div>
	)
}

function BoardSkeleton() {
	return (
		<div className="space-y-0 overflow-hidden rounded-lg border border-border/60">
			{[1, 2, 3, 4, 5].map(i => (
				<div
					key={i}
					className="flex items-center gap-2.5 border-b border-border/40 px-3 py-3 last:border-b-0"
				>
					<div className="h-3 w-4 animate-pulse rounded bg-muted" />
					<div className="h-5 w-8 animate-pulse rounded bg-muted" />
					<div className="h-4 flex-1 animate-pulse rounded bg-muted" />
					<div className="h-4 w-12 animate-pulse rounded bg-muted" />
				</div>
			))}
		</div>
	)
}

function maxOf(
	players: TournamentStatPlayer[],
	pick: (player: TournamentStatPlayer) => number | undefined | null
): number {
	let max = 0
	for (const player of players) {
		const value = pick(player)
		if (typeof value === 'number' && Number.isFinite(value) && value > max) {
			max = value
		}
	}
	return max
}

export default function SelectionsClient({
	entryId,
	initialTournaments,
	publicLeagues,
	initialSelection,
	initialStats,
	initialEntryPicks,
	currentGameweek,
	myLeaguesLoadFailed,
	publicLeaguesLoadFailed,
	initialStatsLoadFailed
}: SelectionsClientProps) {
	const t = useTranslations('Selections')
	const lifecycleT = useTranslations('TournamentLifecycle')
	const pageActive = usePageActive()
	const pathname = usePathname()
	const router = useRouter()
	const searchParams = useSearchParams()

	const [tournaments, setTournaments] = useState(initialTournaments)
	const [selectedScope, setSelectedScope] = useState(initialSelection.scope)
	const [selectedTournamentId, setSelectedTournamentId] = useState(
		initialSelection.tournamentId
	)
	const [selectedGameweek, setSelectedGameweek] = useState(
		initialSelection.gameweek
	)
	const [stats, setStats] = useState(initialStats ?? EMPTY_STATS)
	const [entryPicks, setEntryPicks] = useState(initialEntryPicks)
	const [loadState, setLoadState] = useState<LoadState>(() => {
		if (initialStatsLoadFailed) return 'error'
		if (initialStats) return isEmptyStats(initialStats) ? 'empty' : 'ready'
		return initialSelection.key ? 'unavailable' : 'empty'
	})
	const [statsError, setStatsError] = useState(
		initialStatsLoadFailed ? t('statsError') : ''
	)
	const [ownershipExpanded, setOwnershipExpanded] = useState(false)
	const [captainExpanded, setCaptainExpanded] = useState(false)
	const [transfersExpanded, setTransfersExpanded] = useState(false)
	const restoredPreferenceRef = useRef(false)
	const statsRequestIdRef = useRef(0)
	const statsCache = useRef(
		new Map<string, CachedDesk>(
			initialStats && initialSelection.key && !initialStatsLoadFailed
				? [
						[
							`${initialSelection.key}:${initialSelection.gameweek}`,
							{ stats: initialStats, entryPicks: initialEntryPicks }
						]
					]
				: []
		)
	)

	const selectedKey =
		selectedScope && selectedTournamentId
			? leagueTrendKey(selectedScope, selectedTournamentId)
			: null
	const selectedTournament =
		selectedScope === 'mine'
			? (tournaments.find(item => Number(item.id) === selectedTournamentId) ??
				null)
			: null
	const selectedPublicLeague =
		selectedScope === 'public'
			? (publicLeagues.find(
					item => item.tournamentId === selectedTournamentId
				) ?? null)
			: null
	const selectedName =
		selectedTournament?.name ?? selectedPublicLeague?.displayName ?? null
	const insightsReady =
		selectedScope === 'public'
			? selectedPublicLeague != null
			: selectedTournament
				? areTournamentInsightsReady(selectedTournament)
				: false

	const fetchStats = useCallback(
		async (
			scope: LeagueTrendsScope,
			tournamentId: number,
			eventId: number,
			force = false
		) => {
			const requestId = ++statsRequestIdRef.current
			const cacheKey = `${leagueTrendKey(scope, tournamentId)}:${eventId}`
			if (force) statsCache.current.delete(cacheKey)
			const cached = statsCache.current.get(cacheKey)
			if (cached) {
				setStats(cached.stats)
				setEntryPicks(cached.entryPicks)
				setStatsError('')
				setLoadState(isEmptyStats(cached.stats) ? 'empty' : 'ready')
				return
			}

			setLoadState('loading')
			setStatsError('')
			setStats(EMPTY_STATS)
			setEntryPicks([])
			try {
				let next: CachedDesk
				if (scope === 'mine') {
					if (entryId <= 0) throw new Error('A verified entry is required')
					const [statsResult, entryResult] = await Promise.allSettled([
						executeQuery<TournamentSelectionStatsResponse>(
							GET_TOURNAMENT_SELECTION_STATS,
							{ tournamentId, eventId, limit: 12 }
						),
						executeQuery<EntryEventResultResponse>(GET_ENTRY_EVENT_RESULT, {
							entryId,
							eventId
						})
					])
					if (statsResult.status === 'rejected') throw statsResult.reason
					if (entryResult.status === 'rejected') throw entryResult.reason
					next = {
						stats: toStatsResult(statsResult.value.tournamentSelectionStats),
						entryPicks:
							entryResult.status === 'fulfilled'
								? (entryResult.value.entryEventResult?.eventPicks ?? [])
								: []
					}
				} else {
					const response = await executeQuery<
						PublicLeagueSelectionStatsResponse<TournamentSelectionStatsData>
					>(GET_PUBLIC_LEAGUE_SELECTION_STATS, {
						tournamentId,
						eventId,
						limit: 12
					})
					next = {
						stats: toStatsResult(response.publicLeagueSelectionStats),
						entryPicks: []
					}
				}
				if (requestId !== statsRequestIdRef.current) return
				statsCache.current.set(cacheKey, next)
				setStats(next.stats)
				setEntryPicks(next.entryPicks)
				setLoadState(isEmptyStats(next.stats) ? 'empty' : 'ready')
			} catch (error) {
				if (requestId !== statsRequestIdRef.current) return
				console.error('[league-trends] stats request failed:', error)
				setStatsError(t('statsError'))
				setLoadState('error')
			}
		},
		[entryId, t]
	)

	useEffect(() => {
		if (restoredPreferenceRef.current) return
		if (
			initialSelection.urlSelectionValid ||
			entryId <= 0 ||
			tournaments.length === 0
		) {
			restoredPreferenceRef.current = true
			return
		}
		const lastId = readLastTournamentId(entryId)
		let cancelled = false
		if (lastId && isKnownTournamentId(lastId, tournaments)) {
			queueMicrotask(() => {
				if (cancelled) return
				setSelectedScope('mine')
				setSelectedTournamentId(Number(lastId))
			})
		}
		restoredPreferenceRef.current = true
		return () => {
			cancelled = true
		}
	}, [entryId, initialSelection.urlSelectionValid, tournaments])

	useEffect(() => {
		if (
			selectedScope !== 'mine' ||
			selectedTournamentId == null ||
			entryId <= 0 ||
			!isKnownTournamentId(String(selectedTournamentId), tournaments)
		) {
			return
		}
		writeLastTournamentId(entryId, String(selectedTournamentId))
	}, [entryId, selectedScope, selectedTournamentId, tournaments])

	const handleLeagueChange = useCallback((value: string) => {
		const parsed = parseLeagueTrendKey(value)
		if (!parsed) return
		setOwnershipExpanded(false)
		setCaptainExpanded(false)
		setTransfersExpanded(false)
		setSelectedScope(parsed.scope)
		setSelectedTournamentId(parsed.tournamentId)
	}, [])
	const handleGameweekChange = useCallback((gameweek: number) => {
		setOwnershipExpanded(false)
		setCaptainExpanded(false)
		setTransfersExpanded(false)
		setSelectedGameweek(gameweek)
	}, [])

	useEffect(() => {
		if (!selectedScope || !selectedTournamentId || selectedGameweek <= 0) return
		const next = new URLSearchParams(searchParams.toString())
		next.set('scope', selectedScope)
		next.set('tournament', String(selectedTournamentId))
		next.set('gw', String(selectedGameweek))
		if (next.toString() === searchParams.toString()) return
		const href = `${pathname}?${next.toString()}`
		router.replace(href, { scroll: false })
	}, [
		pathname,
		router,
		searchParams,
		selectedGameweek,
		selectedScope,
		selectedTournamentId
	])

	useEffect(() => {
		if (
			!pageActive ||
			selectedScope !== 'mine' ||
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
				const data = await executeQuery<EntryTournamentsResponse>(
					GET_ENTRY_TOURNAMENTS,
					{ entryId }
				)
				if (!cancelled) {
					setTournaments(
						data.entryTournaments.map(mapEntryTournamentToLiveTournament)
					)
				}
			} catch (error) {
				console.warn('[league-trends] setup status unavailable:', error)
			} finally {
				if (!cancelled) timer = window.setTimeout(poll, 5_000)
			}
		}
		timer = window.setTimeout(poll, 5_000)
		return () => {
			cancelled = true
			if (timer !== undefined) window.clearTimeout(timer)
		}
	}, [entryId, insightsReady, pageActive, selectedScope, selectedTournament])

	useEffect(() => {
		let cancelled = false
		if (!selectedScope || !selectedTournamentId) {
			statsRequestIdRef.current += 1
			queueMicrotask(() => {
				if (cancelled) return
				setStats(EMPTY_STATS)
				setEntryPicks([])
				setLoadState('empty')
			})
			return () => {
				cancelled = true
			}
		}
		if (!insightsReady) {
			statsRequestIdRef.current += 1
			queueMicrotask(() => {
				if (cancelled) return
				setStats(EMPTY_STATS)
				setEntryPicks([])
				setLoadState('unavailable')
			})
			return () => {
				cancelled = true
			}
		}
		void fetchStats(selectedScope, selectedTournamentId, selectedGameweek)
		return () => {
			cancelled = true
		}
	}, [
		fetchStats,
		insightsReady,
		selectedGameweek,
		selectedScope,
		selectedTournamentId
	])

	const sortedSelection = useMemo(
		() =>
			[...stats.selection].sort(
				(a, b) => (b.selectedByPercent ?? 0) - (a.selectedByPercent ?? 0)
			),
		[stats.selection]
	)
	const sortedCaptain = useMemo(
		() =>
			[...stats.captain].sort(
				(a, b) => (b.captainByPercent ?? 0) - (a.captainByPercent ?? 0)
			),
		[stats.captain]
	)
	const sortedTransferIn = useMemo(
		() =>
			[...stats.transferIn].sort(
				(a, b) => (b.transfersEvent ?? 0) - (a.transfersEvent ?? 0)
			),
		[stats.transferIn]
	)
	const sortedTransferOut = useMemo(
		() =>
			[...stats.transferOut].sort(
				(a, b) => (b.transfersEvent ?? 0) - (a.transfersEvent ?? 0)
			),
		[stats.transferOut]
	)
	const summary = useMemo(
		() => buildLeagueTrendSummary(sortedSelection, sortedCaptain, entryPicks),
		[entryPicks, sortedCaptain, sortedSelection]
	)

	const maxOwned = maxOf(sortedSelection, player => player.selectedByPercent)
	const maxCaptain = maxOf(sortedCaptain, player => player.captainByPercent)
	const maxTin = maxOf(sortedTransferIn, player => player.transfersEvent)
	const maxTout = maxOf(sortedTransferOut, player => player.transfersEvent)
	const topCaptain = sortedCaptain[0]
	const isLoadingStats = loadState === 'loading'
	const showDesk = Boolean(
		selectedKey && insightsReady && loadState !== 'error'
	)
	const isMine = selectedScope === 'mine'

	const shareScope = useMemo(
		() => ({
			tournamentName: selectedName ?? '—',
			gameweek: selectedGameweek,
			totalEntries: stats.totalEntries
		}),
		[selectedGameweek, selectedName, stats.totalEntries]
	)
	const shareFooter = useCallback(() => {
		const origin =
			typeof window === 'undefined'
				? 'https://letletme.top'
				: window.location.origin
		const prefix =
			typeof window !== 'undefined' &&
			window.location.pathname.startsWith('/zh-CN')
				? '/zh-CN'
				: ''
		const url = buildSelectionsShareUrl(origin, prefix, {
			scope: selectedScope,
			tournamentId: selectedTournamentId,
			gameweek: selectedGameweek
		})
		return isMine ? `${url}\n${t('shareMyMembershipNote')}` : url
	}, [isMine, selectedGameweek, selectedScope, selectedTournamentId, t])
	const fieldLine =
		stats.totalEntries > 0
			? t('fieldLine', { count: stats.totalEntries })
			: undefined
	const ownershipShareText = useCallback(
		() =>
			formatOwnershipShareText(sortedSelection, shareScope, {
				title: t('ownershipTitle'),
				none: t('shareNone'),
				fieldLine,
				footer: shareFooter()
			}),
		[fieldLine, shareFooter, shareScope, sortedSelection, t]
	)
	const captainShareText = useCallback(
		() =>
			formatCaptainShareText(sortedCaptain, shareScope, {
				title: t('captainTitle'),
				none: t('shareNone'),
				fieldLine,
				footer: shareFooter()
			}),
		[fieldLine, shareFooter, shareScope, sortedCaptain, t]
	)
	const transferShareText = useCallback(
		() =>
			formatTransferShareText(sortedTransferIn, sortedTransferOut, shareScope, {
				title: t('transferTitle'),
				none: t('shareNone'),
				fieldLine,
				transfersIn: t('transfersIn'),
				transfersOut: t('transfersOut'),
				footer: shareFooter()
			}),
		[fieldLine, shareFooter, shareScope, sortedTransferIn, sortedTransferOut, t]
	)

	const captainPickName = summary.userCaptain?.webName ?? '—'
	const exposureDetail = (player: TournamentStatPlayer | undefined) =>
		player ? (
			<Link
				href={playerStatsHref({ p1: String(player.id) })}
				className="hover:underline"
			>
				{t('exposureIfReturn', { player: player.webName })}
			</Link>
		) : undefined

	return (
		<PageShell>
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<StatsPageHeader
					title={t('title')}
					badge={<GameweekBadge gameweek={selectedGameweek} />}
				/>
				<p className="-mt-4 mb-6 max-w-2xl text-sm leading-6 text-muted-foreground">
					{t('pageIntro')}
				</p>

				<section
					aria-label={t('scopeLabel')}
					className="mb-8 rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
				>
					<div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-border/50 pb-2">
						<p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
							{t('scopeLabel')}
						</p>
						{selectedName ? (
							<p className="truncate text-xs text-muted-foreground">
								{t('scopeMeta', {
									tournament: selectedName,
									gw: selectedGameweek
								})}
							</p>
						) : null}
					</div>

					<div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
						<div className="space-y-2">
							{tournaments.length > 0 || publicLeagues.length > 0 ? (
								<Select
									value={selectedKey ?? undefined}
									onValueChange={handleLeagueChange}
								>
									<SelectTrigger aria-label={t('leagueSelectorLabel')}>
										<SelectValue placeholder={t('leagueSelectorPlaceholder')} />
									</SelectTrigger>
									<SelectContent>
										{tournaments.length > 0 ? (
											<SelectGroup>
												<SelectLabel>{t('myLeagues')}</SelectLabel>
												{tournaments.map(tournament => (
													<SelectItem
														key={leagueTrendKey('mine', Number(tournament.id))}
														value={leagueTrendKey(
															'mine',
															Number(tournament.id)
														)}
													>
														{tournament.name}
													</SelectItem>
												))}
											</SelectGroup>
										) : null}
										{publicLeagues.length > 0 ? (
											<SelectGroup>
												<SelectLabel>{t('publicLeagues')}</SelectLabel>
												{publicLeagues.map(league => (
													<SelectItem
														key={leagueTrendKey('public', league.tournamentId)}
														value={leagueTrendKey(
															'public',
															league.tournamentId
														)}
													>
														{league.displayName}
													</SelectItem>
												))}
											</SelectGroup>
										) : null}
									</SelectContent>
								</Select>
							) : (
								<EmptyHint>{t('noLeagueOptions')}</EmptyHint>
							)}
							{entryId <= 0 ? (
								<p className="text-xs text-muted-foreground">
									{t('needEntry')}{' '}
									<Link
										href="/onboarding/bind-entry"
										className="font-medium text-primary-ink hover:underline"
									>
										{t('bindEntryCta')}
									</Link>
								</p>
							) : tournaments.length === 0 && !myLeaguesLoadFailed ? (
								<p className="text-xs text-muted-foreground">
									{t('noCompetitions')}{' '}
									<Link
										href="/competitions/browse"
										className="font-medium text-primary-ink hover:underline"
									>
										{t('browseCompetitions')}
									</Link>
								</p>
							) : null}
							{myLeaguesLoadFailed ? (
								<p className="text-xs text-destructive">
									{t('myLeaguesError')}
								</p>
							) : null}
							{publicLeaguesLoadFailed ? (
								<p className="text-xs text-destructive">
									{t('publicLeaguesError')}
								</p>
							) : null}
						</div>
						<GameweekSelector
							currentGameweek={currentGameweek}
							selectedGameweek={selectedGameweek}
							onGameweekChange={handleGameweekChange}
							disabled={
								isLoadingStats || Boolean(selectedKey && !insightsReady)
							}
							className="border-0 bg-transparent p-0 shadow-none"
						/>
					</div>
				</section>

				{selectedTournament && !insightsReady ? (
					<div
						className="rounded-xl border border-border/80 bg-card px-5 py-8 text-center shadow-sm"
						aria-live="polite"
					>
						<p className="font-display text-sm font-semibold uppercase tracking-wide">
							{selectedTournament.name}
						</p>
						<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
							{selectedTournament.setupStatus === 'FAILED'
								? lifecycleT('memberFailure')
								: selectedTournament.setupHasWarnings
									? lifecycleT('warningSummary')
									: selectedTournament.standingsReadyAt
										? lifecycleT('enrichingMessage')
										: lifecycleT('leavePageMessage')}
						</p>
					</div>
				) : null}

				{loadState === 'error' && selectedScope && selectedTournamentId ? (
					<div
						className="rounded-xl border border-destructive/40 bg-card px-5 py-6"
						role="alert"
					>
						<p className="text-sm font-medium">{statsError}</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="mt-3 gap-1.5"
							onClick={() =>
								void fetchStats(
									selectedScope,
									selectedTournamentId,
									selectedGameweek,
									true
								)
							}
						>
							<RefreshCw
								className="size-3.5"
								aria-hidden="true"
							/>
							{t('retry')}
						</Button>
					</div>
				) : null}

				{showDesk ? (
					<div className="space-y-8 sm:space-y-10">
						<section
							aria-label={t('glanceLabel')}
							className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3"
						>
							<StatsMetricTile
								icon={
									<Users
										className="size-3.5"
										aria-hidden="true"
									/>
								}
								label={t('glanceField')}
								value={
									isLoadingStats
										? '…'
										: stats.totalEntries > 0
											? String(stats.totalEntries)
											: '—'
								}
								detail={t('glanceFieldDetail')}
							/>
							<StatsMetricTile
								icon={
									<Users
										className="size-3.5"
										aria-hidden="true"
									/>
								}
								label={t('templateCore')}
								value={
									isLoadingStats
										? '…'
										: isMine
											? `${summary.templateOwnedCount}/5`
											: summary.templateCore.length > 0
												? t('topFive')
												: '—'
								}
								detail={
									summary.templateCore.length > 0
										? summary.templateCore
												.map(player => player.webName)
												.join(', ')
										: undefined
								}
							/>
							<StatsMetricTile
								icon={
									<Crown
										className="size-3.5"
										aria-hidden="true"
									/>
								}
								label={t('captainExposure')}
								value={
									isLoadingStats
										? '…'
										: isMine
											? captainPickName
											: (topCaptain?.webName ?? '—')
								}
								detail={
									isMine
										? t('leagueCaptainRate', {
												value: formatPercent(summary.captainRate)
											})
										: topCaptain
											? formatPercent(topCaptain.captainByPercent)
											: undefined
								}
							/>
							<StatsMetricTile
								icon={
									<TrendingDown
										className="size-3.5"
										aria-hidden="true"
									/>
								}
								label={t('negativeExposure')}
								value={
									isLoadingStats
										? '…'
										: isMine
											? formatExposure(summary.biggestNegative?.gap)
											: '—'
								}
								detail={
									isMine
										? exposureDetail(summary.biggestNegative?.player)
										: t('myLeagueOnly')
								}
							/>
							<StatsMetricTile
								icon={
									<TrendingUp
										className="size-3.5"
										aria-hidden="true"
									/>
								}
								label={t('positiveExposure')}
								value={
									isLoadingStats
										? '…'
										: isMine
											? formatExposure(summary.biggestPositive?.gap)
											: '—'
								}
								detail={
									isMine
										? exposureDetail(summary.biggestPositive?.player)
										: t('myLeagueOnly')
								}
							/>
						</section>
						{isMine ? (
							<p className="-mt-6 text-xs text-muted-foreground">
								{t('exposureCoverage')}
							</p>
						) : null}

						<section
							aria-labelledby="sel-ownership"
							className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
						>
							<SectionTitle
								id="sel-ownership"
								hint={t('ownershipHint')}
								action={
									!isLoadingStats ? (
										<SectionShareActions getText={ownershipShareText} />
									) : null
								}
							>
								{t('ownershipTitle')}
							</SectionTitle>
							{isLoadingStats ? (
								<BoardSkeleton />
							) : (
								<ExpandableMetricBoard
									players={sortedSelection}
									expanded={ownershipExpanded}
									onExpandedChange={setOwnershipExpanded}
									emptyLabel={t('noData')}
									ariaLabel={t('ownershipTitle')}
									rolesByPlayerId={summary.rolesByPlayerId}
									getMetric={player => ({
										primary: formatPercent(player.selectedByPercent),
										secondary: t('eoValue', {
											value: formatPercent(player.eoByPercent)
										}),
										magnitude:
											maxOwned > 0
												? (player.selectedByPercent ?? 0) / maxOwned
												: 0,
										tone: 'default'
									})}
								/>
							)}
						</section>

						<section
							aria-labelledby="sel-captain"
							className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
						>
							<SectionTitle
								id="sel-captain"
								hint={t('captainHint')}
								action={
									!isLoadingStats ? (
										<SectionShareActions getText={captainShareText} />
									) : null
								}
							>
								{t('captainTitle')}
							</SectionTitle>
							{isLoadingStats ? (
								<BoardSkeleton />
							) : (
								<ExpandableMetricBoard
									players={sortedCaptain}
									expanded={captainExpanded}
									onExpandedChange={setCaptainExpanded}
									emptyLabel={t('noData')}
									ariaLabel={t('captainTitle')}
									rolesByPlayerId={summary.rolesByPlayerId}
									getMetric={player => ({
										primary: formatPercent(player.captainByPercent),
										secondary: t('eoValue', {
											value: formatPercent(player.eoByPercent)
										}),
										magnitude:
											maxCaptain > 0
												? (player.captainByPercent ?? 0) / maxCaptain
												: 0,
										tone: 'captain'
									})}
								/>
							)}
						</section>

						<section
							aria-labelledby="sel-transfers"
							className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
						>
							<SectionTitle
								id="sel-transfers"
								hint={t('transferHint')}
								action={
									!isLoadingStats ? (
										<SectionShareActions getText={transferShareText} />
									) : null
								}
							>
								{t('transferTitle')}
							</SectionTitle>
							<div className="grid gap-4 md:grid-cols-2">
								<div className="min-w-0">
									<p className="mb-2 flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-success">
										<TrendingUp
											className="size-3.5"
											aria-hidden="true"
										/>
										{t('topTransferIn')}
									</p>
									{isLoadingStats ? (
										<BoardSkeleton />
									) : (
										<MetricBoard
											players={
												transfersExpanded
													? sortedTransferIn.slice(0, 12)
													: sortedTransferIn.slice(0, 5)
											}
											emptyLabel={t('noTransfersIn')}
											ariaLabel={t('transfersIn')}
											rolesByPlayerId={summary.rolesByPlayerId}
											getMetric={player => ({
												primary: t('transferCount', {
													count: formatCount(player.transfersEvent)
												}),
												secondary: t('ownedValue', {
													value: formatPercent(player.selectedByPercent)
												}),
												magnitude:
													maxTin > 0
														? (player.transfersEvent ?? 0) / maxTin
														: 0,
												tone: 'success'
											})}
										/>
									)}
								</div>
								<div className="min-w-0">
									<p className="mb-2 flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-destructive">
										<TrendingDown
											className="size-3.5"
											aria-hidden="true"
										/>
										{t('topTransferOut')}
									</p>
									{isLoadingStats ? (
										<BoardSkeleton />
									) : (
										<MetricBoard
											players={
												transfersExpanded
													? sortedTransferOut.slice(0, 12)
													: sortedTransferOut.slice(0, 5)
											}
											emptyLabel={t('noTransfersOut')}
											ariaLabel={t('transfersOut')}
											rolesByPlayerId={summary.rolesByPlayerId}
											getMetric={player => ({
												primary: t('transferCount', {
													count: formatCount(player.transfersEvent)
												}),
												secondary: t('ownedValue', {
													value: formatPercent(player.selectedByPercent)
												}),
												magnitude:
													maxTout > 0
														? (player.transfersEvent ?? 0) / maxTout
														: 0,
												tone: 'destructive'
											})}
										/>
									)}
								</div>
							</div>
							{Math.max(sortedTransferIn.length, sortedTransferOut.length) >
							5 ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="mt-2 w-full text-xs"
									onClick={() => setTransfersExpanded(value => !value)}
								>
									{transfersExpanded ? t('showTopFive') : t('showTopTwelve')}
								</Button>
							) : null}
						</section>
					</div>
				) : null}
			</div>
		</PageShell>
	)
}
