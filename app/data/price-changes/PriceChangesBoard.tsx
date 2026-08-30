'use client'

import { PriceChangeShareCard } from '@/app/data/price-changes/PriceChangeShareCard'
import { formatPriceChangeShareText } from '@/app/data/price-changes/_lib/price-change-share'
import { PriceChangeSquadPitch } from '@/app/data/price-changes/PriceChangeSquadPitch'
import { CountdownCard } from '@/components/home/CountdownCard'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { MarketPositionBadge } from '@/components/data/MarketMarkup'
import { PriceChangeSignalBadge } from '@/components/data/PriceChangeSignalBadge'
import { ShareActions } from '@/components/share/ShareActions'
import { formatLocalSnapshotTime } from '@/components/stats/LocalSnapshotTime'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { Link } from '@/i18n/navigation'
import type {
	PriceChangeBoard,
	PriceChangePlayer
} from '@/lib/graphql/operations/price-changes'
import {
	isPriceChangeLiveEnabled,
	LIVE_DISABLED_REFRESH_MS,
	usePriceChangeLiveBoard
} from '@/lib/price-change-live-client'
import type { TimeLeft } from '@/lib/home-deadline'
import {
	DEFAULT_PRICE_CHANGE_SCOPE,
	DEFAULT_PRICE_CHANGE_SORT,
	matchesPriceChangePlayer,
	selectPriceChangePlayers,
	sortPriceChangePlayers,
	type PriceChangeMovementFilter,
	type PriceChangeSortColumn,
	type PriceChangeSortDirection,
	type PriceChangeSortState,
	type PriceChangeScope
} from '@/lib/price-change-sorting'
import { selectPriceChangeSquadPlayers } from '@/app/data/price-changes/_lib/price-change-share'
import type { SquadLoadState, SquadPickSeed } from '@/lib/squad-picks'
import { cn } from '@/lib/utils'
import { useHydrated } from '@/hooks/use-hydrated'
import { useRouter } from 'next/navigation'
import {
	ArrowDown,
	ArrowDownRight,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	ArrowUpRight,
	ArrowUpDown,
	CircleHelp,
	Minus,
	RefreshCcw,
	Search
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'

const PAGE_SIZE = 20

const LAST_VALID_BOARD_STORAGE_KEY = 'letletme:price-change-board:v2'
const LEGACY_LAST_VALID_BOARD_STORAGE_KEY = 'letletme:price-change-board:v1'
const LAST_VALID_BOARD_MAX_AGE_MS = 60 * 60 * 1_000

const statusTranslationKey = {
	VERY_LIKELY_RISE: 'statusVeryLikelyRise',
	LIKELY_RISE: 'statusLikelyRise',
	UNLIKELY: 'statusUnlikely',
	LIKELY_FALL: 'statusLikelyFall',
	VERY_LIKELY_FALL: 'statusVeryLikelyFall',
	LOCKED: 'statusLocked',
	CALIBRATING: 'statusCalibrating'
} as const

function formatPrice(value: number): string {
	return `£${(value / 10).toFixed(1)}m`
}

function formatPercent(value: number): string {
	if (Math.abs(value) < 0.05) return '0.0%'
	return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatDeadline(
	value: string | null,
	locale: string,
	hydrated: boolean
): string {
	if (!hydrated) return '—'
	if (!value) return '—'
	const timestamp = Date.parse(value)
	if (!Number.isFinite(timestamp)) return '—'
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		timeZoneName: 'short'
	}).format(new Date(timestamp))
}

function isPersistableBoard(value: unknown): value is PriceChangeBoard {
	if (value == null || typeof value !== 'object') return false
	const board = value as Partial<PriceChangeBoard>
	return (
		Array.isArray(board.players) &&
		board.players.length > 0 &&
		typeof board.revision === 'string' &&
		typeof board.observedPlayerCount === 'number' &&
		board.observedPlayerCount > 0
	)
}

function readLastValidBoard(): PriceChangeBoard | null {
	if (typeof window === 'undefined') return null
	try {
		const raw = window.localStorage.getItem(LAST_VALID_BOARD_STORAGE_KEY)
		if (!raw) return null
		const value = JSON.parse(raw) as {
			savedAt?: unknown
			board?: unknown
		}
		if (typeof value.savedAt !== 'number') return null
		if (Date.now() - value.savedAt > LAST_VALID_BOARD_MAX_AGE_MS) {
			window.localStorage.removeItem(LAST_VALID_BOARD_STORAGE_KEY)
			return null
		}
		if (!isPersistableBoard(value.board)) return null
		return { ...value.board, status: 'STALE' }
	} catch {
		return null
	}
}

function persistLastValidBoard(board: PriceChangeBoard): void {
	if (typeof window === 'undefined' || !isPersistableBoard(board)) return
	try {
		const fetchedAt = board.fetchedAt ? Date.parse(board.fetchedAt) : NaN
		const savedAt = Number.isFinite(fetchedAt) ? fetchedAt : Date.now()
		window.localStorage.setItem(
			LAST_VALID_BOARD_STORAGE_KEY,
			JSON.stringify({ savedAt, board })
		)
	} catch {
		// Storage is an enhancement. The in-memory board remains authoritative.
	}
}

function changeHighlightClass(
	status: PriceChangePlayer['status'],
	card = false
): string {
	if (status.includes('RISE')) {
		return card
			? 'border-success/45 bg-success/10 hover:border-success/65 hover:bg-success/15'
			: 'bg-success/10 hover:bg-success/15'
	}
	if (status.includes('FALL')) {
		return card
			? 'border-destructive/45 bg-destructive/10 hover:border-destructive/65 hover:bg-destructive/15'
			: 'bg-destructive/10 hover:bg-destructive/15'
	}
	return card
		? 'border-border/70 bg-card hover:border-border'
		: 'hover:bg-muted/15'
}

function progressClass(value: number): string {
	if (value > 0) return 'bg-success'
	if (value < 0) return 'bg-destructive'
	return 'bg-muted-foreground/50'
}

function ownershipIcon(trend: PriceChangePlayer['ownershipTrend']) {
	if (trend === 'UP') return ArrowUpRight
	if (trend === 'DOWN') return ArrowDownRight
	return Minus
}

function ownershipClass(trend: PriceChangePlayer['ownershipTrend']): string {
	if (trend === 'UP') return 'text-success'
	if (trend === 'DOWN') return 'text-destructive'
	return 'text-muted-foreground'
}

function statusAlertVariant(
	status: PriceChangeBoard['status'],
	officialUpdating = false
): 'info' | 'warning' | 'destructive' | null {
	if (officialUpdating) return null
	if (status === 'PARTIAL') return 'info'
	if (status === 'STALE') return 'warning'
	if (status === 'UNAVAILABLE') return 'destructive'
	return null
}

function SortableHeader({
	column,
	label,
	sort,
	onSort,
	align = 'left'
}: {
	column: PriceChangeSortColumn
	label: string
	sort: PriceChangeSortState
	onSort: (column: PriceChangeSortColumn) => void
	align?: 'left' | 'right'
}) {
	const active = sort.column === column
	const SortIcon = active
		? sort.direction === 'asc'
			? ArrowUp
			: ArrowDown
		: ArrowUpDown

	return (
		<th
			className={cn(
				'px-3 py-3 font-semibold',
				align === 'right' && 'text-right'
			)}
			aria-sort={
				active
					? sort.direction === 'asc'
						? 'ascending'
						: 'descending'
					: 'none'
			}
		>
			<button
				type="button"
				className={cn(
					'inline-flex items-center gap-1.5 rounded-sm text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
					align === 'right' && 'ml-auto text-right',
					active && 'text-foreground'
				)}
				onClick={() => onSort(column)}
				aria-label={label}
			>
				<span>{label}</span>
				<SortIcon
					className="size-3.5"
					aria-hidden="true"
				/>
			</button>
		</th>
	)
}

export function PriceChangesBoard({
	board,
	locale,
	initialTimeLeft,
	mySquadElementIds,
	mySquadPicks,
	mySquadState,
	initialScope = DEFAULT_PRICE_CHANGE_SCOPE,
	initialMovement = 'all',
	isOfficialUpdating = false
}: {
	board: PriceChangeBoard
	locale: string
	initialTimeLeft: TimeLeft
	mySquadElementIds: number[]
	mySquadPicks: SquadPickSeed[]
	mySquadState: SquadLoadState
	initialScope?: PriceChangeScope
	initialMovement?: PriceChangeMovementFilter
	isOfficialUpdating?: boolean
}) {
	const t = useTranslations('PriceChanges')
	const router = useRouter()
	const hydrated = useHydrated()
	const [search, setSearch] = useState('')
	const [scope, setScope] = useState<PriceChangeScope>(
		initialMovement === 'locked' ? 'all' : initialScope
	)
	const [movement, setMovement] =
		useState<PriceChangeMovementFilter>(initialMovement)
	const [sort, setSort] = useState<PriceChangeSortState>(
		DEFAULT_PRICE_CHANGE_SORT
	)
	const [teamId, setTeamId] = useState('all')
	const [page, setPage] = useState(1)
	const [displayBoard, setDisplayBoard] = useState(board)
	const [liveState, setLiveState] = useState<
		'PROVISIONAL' | 'DURABLE' | 'UNAVAILABLE'
	>('DURABLE')
	const isUpdatingNotice = isOfficialUpdating && displayBoard.status !== 'READY'
	const mySquad = useMemo(() => new Set(mySquadElementIds), [mySquadElementIds])
	const shareRef = useRef<HTMLDivElement | null>(null)
	const mySquadShareRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		try {
			window.localStorage.removeItem(LEGACY_LAST_VALID_BOARD_STORAGE_KEY)
		} catch {
			// Storage cleanup is best effort; the new v2 key remains authoritative.
		}
	}, [])

	useEffect(() => {
		if (isPersistableBoard(board)) {
			setDisplayBoard(board)
			setLiveState('DURABLE')
			persistLastValidBoard(board)
			return
		}

		setDisplayBoard(current => {
			const lastValidBoard = readLastValidBoard()
			if (lastValidBoard) return lastValidBoard
			if (isPersistableBoard(current)) return { ...current, status: 'STALE' }
			return board
		})
	}, [board])

	useEffect(() => {
		if (isPriceChangeLiveEnabled()) return
		const timer = window.setInterval(
			() => router.refresh(),
			LIVE_DISABLED_REFRESH_MS
		)
		return () => window.clearInterval(timer)
	}, [router])

	useEffect(() => {
		setScope(initialMovement === 'locked' ? 'all' : initialScope)
		setMovement(initialMovement)
		setPage(1)
	}, [initialMovement, initialScope])

	usePriceChangeLiveBoard({
		board,
		onUpdate: (nextBoard, state) => {
			setDisplayBoard(nextBoard)
			setLiveState(state)
			if (state === 'DURABLE') persistLastValidBoard(nextBoard)
		}
	})

	const teamOptions = useMemo(() => {
		const teams = new Map<
			number,
			{ id: number; name: string; shortName: string }
		>()
		for (const player of displayBoard.players) {
			if (!teams.has(player.teamId)) {
				teams.set(player.teamId, {
					id: player.teamId,
					name: player.teamName,
					shortName: player.teamShortName
				})
			}
		}
		return Array.from(teams.values()).sort((left, right) =>
			left.name.localeCompare(right.name, locale)
		)
	}, [displayBoard.players, locale])

	const filteredPlayers = useMemo(() => {
		const query = search.trim().toLowerCase()
		const matchingPlayers = displayBoard.players.filter(player => {
			if (!matchesPriceChangePlayer(player, { scope, movement })) {
				return false
			}
			if (teamId !== 'all' && String(player.teamId) !== teamId) return false
			if (!query) return true
			return `${player.webName} ${player.teamName} ${player.teamShortName}`
				.toLowerCase()
				.includes(query)
		})
		return sortPriceChangePlayers(matchingPlayers, {
			sort,
			squadElementIds: scope === 'likely' ? new Set<number>() : mySquad,
			locale
		})
	}, [
		displayBoard.players,
		locale,
		movement,
		mySquad,
		scope,
		search,
		sort,
		teamId
	])

	const pageCount = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE))
	const safePage = Math.min(page, pageCount)
	const visiblePlayers = filteredPlayers.slice(
		(safePage - 1) * PAGE_SIZE,
		safePage * PAGE_SIZE
	)

	useEffect(() => {
		if (page > pageCount) setPage(pageCount)
	}, [page, pageCount])

	const resetFilters = () => {
		setSearch('')
		setScope(DEFAULT_PRICE_CHANGE_SCOPE)
		setMovement('all')
		setSort(DEFAULT_PRICE_CHANGE_SORT)
		setTeamId('all')
		setPage(1)
	}

	const hasFilters =
		search.length > 0 ||
		scope !== DEFAULT_PRICE_CHANGE_SCOPE ||
		movement !== 'all' ||
		sort.column !== DEFAULT_PRICE_CHANGE_SORT.column ||
		sort.direction !== DEFAULT_PRICE_CHANGE_SORT.direction ||
		teamId !== 'all'
	const setSortColumn = (column: PriceChangeSortColumn) => {
		setSort(current =>
			current.column === column
				? {
						column,
						direction: current.direction === 'desc' ? 'asc' : 'desc'
					}
				: { column, direction: 'desc' }
		)
		setPage(1)
	}
	const setSortValue = (value: string) => {
		const [column, direction] = value.split(':') as [
			PriceChangeSortColumn,
			PriceChangeSortDirection
		]
		if (!column || !direction) return
		setSort({ column, direction })
		setPage(1)
	}
	const alertVariant = statusAlertVariant(displayBoard.status, isUpdatingNotice)
	const from = filteredPlayers.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
	const to = Math.min(safePage * PAGE_SIZE, filteredPlayers.length)
	const shareScopePlayers = useMemo(() => {
		return selectPriceChangePlayers(displayBoard.players, {
			scope,
			movement,
			sort,
			squadElementIds: scope === 'likely' ? new Set<number>() : mySquad,
			locale
		})
	}, [displayBoard.players, locale, movement, mySquad, scope, sort])
	const mySquadBoardPlayers = useMemo(
		() => selectPriceChangeSquadPlayers(displayBoard.players, mySquadPicks),
		[displayBoard.players, mySquadPicks]
	)
	const snapshotUpdatedAtLabel = useMemo(
		() =>
			hydrated ? formatLocalSnapshotTime(displayBoard.fetchedAt, locale) : null,
		[displayBoard.fetchedAt, hydrated, locale]
	)
	const shareLabels = useMemo(
		() => ({
			title: t('title'),
			scope: scope === 'likely' ? t('scopeLikely') : t('scopeAll'),
			updated: t('snapshotUpdatedAt'),
			deadline: t('deadlineLabel'),
			progress: t('progress'),
			signal: t('signal'),
			movement: t('netTransfers'),
			none: t('shareNoPredictions'),
			status: {
				VERY_LIKELY_RISE: t('statusVeryLikelyRise'),
				LIKELY_RISE: t('statusLikelyRise'),
				UNLIKELY: t('statusUnlikely'),
				LIKELY_FALL: t('statusLikelyFall'),
				VERY_LIKELY_FALL: t('statusVeryLikelyFall'),
				LOCKED: t('statusLocked'),
				CALIBRATING: t('statusCalibrating')
			}
		}),
		[scope, t]
	)

	const shareText = useMemo(() => {
		const shareUrl =
			typeof window !== 'undefined'
				? window.location.href
				: `https://letletme.top/${locale}/explore/price-predictions`
		return formatPriceChangeShareText({
			players: shareScopePlayers,
			updatedAtLabel: snapshotUpdatedAtLabel,
			deadlineLabel: formatDeadline(displayBoard.deadline, locale, hydrated),
			labels: {
				...shareLabels,
				footer: shareUrl
			}
		})
	}, [
		displayBoard.deadline,
		hydrated,
		locale,
		shareLabels,
		shareScopePlayers,
		snapshotUpdatedAtLabel
	])
	const squadShareText = useMemo(() => {
		const shareUrl =
			typeof window !== 'undefined'
				? window.location.href
				: `https://letletme.top/${locale}/explore/price-predictions`
		return formatPriceChangeShareText({
			players: mySquadBoardPlayers,
			updatedAtLabel: snapshotUpdatedAtLabel,
			deadlineLabel: formatDeadline(displayBoard.deadline, locale, hydrated),
			labels: {
				...shareLabels,
				scope: t('mySquadTab'),
				footer: shareUrl
			}
		})
	}, [
		displayBoard.deadline,
		hydrated,
		locale,
		mySquadBoardPlayers,
		shareLabels,
		snapshotUpdatedAtLabel,
		t
	])

	return (
		<div className="space-y-5">
			<CountdownCard
				eyebrow={t('countdownEyebrow')}
				title={t('countdownTitle')}
				deadlineTime={displayBoard.deadline}
				initialTimeLeft={initialTimeLeft}
				deadlinePrefix={t('deadlinePrefix')}
				noDeadlineLabel={t('countdownNoDeadline')}
				unitLabels={{
					days: t('days'),
					hours: t('hours'),
					minutes: t('minutes'),
					seconds: t('seconds')
				}}
				expiredBadge={
					isUpdatingNotice ? t('updatingLabel') : t('deadlinePassed')
				}
				expiredLabel={
					isUpdatingNotice ? t('countdownUpdating') : t('countdownExpired')
				}
				expiredTone={isUpdatingNotice ? 'info' : 'warning'}
				variant="light"
			/>

			{liveState === 'PROVISIONAL' ? (
				<div
					className="flex items-center gap-2 text-xs text-muted-foreground"
					role="status"
				>
					<Badge
						variant="outline"
						className="border-primary/40 bg-primary/10 text-primary"
					>
						{t('instantUpdate')}
					</Badge>
					<span>{t('instantUpdateDescription')}</span>
				</div>
			) : null}
			{isUpdatingNotice ? (
				<div
					className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.045] px-4 py-3 text-sm text-muted-foreground"
					role="status"
				>
					<RefreshCcw
						className="mt-0.5 size-4 shrink-0 text-primary"
						aria-hidden="true"
					/>
					<div className="min-w-0 space-y-0.5">
						<p className="font-semibold text-foreground">
							{t('updatingLabel')}
						</p>
						<p>{t('statusUpdating')}</p>
					</div>
				</div>
			) : null}
			{alertVariant ? (
				<Alert variant={alertVariant}>
					<RefreshCcw
						className="size-4"
						aria-hidden="true"
					/>
					<AlertTitle>
						{displayBoard.status === 'PARTIAL'
							? t('partial')
							: displayBoard.status === 'STALE'
								? t('stale')
								: t('unavailable')}
					</AlertTitle>
					<AlertDescription>
						{displayBoard.status === 'PARTIAL'
							? t('statusPartial')
							: displayBoard.status === 'STALE'
								? t('statusStale')
								: t('statusUnavailable')}
					</AlertDescription>
				</Alert>
			) : null}

			<div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] px-4 py-3 sm:px-5">
				<div className="flex flex-wrap items-center justify-end gap-2">
					<ShareActions
						text={shareText}
						imageRef={shareRef}
						title={t('title')}
					/>
					<Dialog>
						<DialogTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="shrink-0"
							>
								<CircleHelp
									data-icon="inline-start"
									aria-hidden="true"
								/>
								{t('understandingPriceChanges')}
							</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
							<DialogHeader>
								<DialogTitle>{t('understandingTitle')}</DialogTitle>
								<DialogDescription>
									{t('understandingDescription')}
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4 text-sm leading-6 text-muted-foreground">
								<p>{t('understandingProgress')}</p>
								<p>{t('understandingStatus')}</p>
								<p>{t('understandingDeadline')}</p>
								<p className="rounded-lg bg-muted/50 px-3 py-2 text-foreground">
									{t('understandingCaveat')}
								</p>
							</div>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{mySquadPicks.length > 0 ? (
				<div className="flex justify-end">
					<ShareActions
						text={squadShareText}
						imageRef={mySquadShareRef}
						title={`${t('title')} · ${t('mySquadTab')}`}
					/>
				</div>
			) : null}
			<PriceChangeSquadPitch
				picks={mySquadPicks}
				players={displayBoard.players}
				squadState={mySquadState}
				shareRef={mySquadShareRef}
			/>

			<Card className="overflow-hidden border-border/80 shadow-sm">
				<div className="border-b border-border/70 bg-muted/10 p-4 sm:p-5">
					<h2 className="mb-4 font-display text-lg font-semibold tracking-tight">
						{scope === 'likely' ? t('scopeLikely') : t('scopeAll')}
					</h2>
					<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
						<div className="w-full max-w-xl space-y-1.5">
							<label
								className="eyebrow"
								htmlFor="price-change-search"
							>
								{t('searchLabel')}
							</label>
							<div className="relative">
								<Search
									className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
									aria-hidden="true"
								/>
								<Input
									id="price-change-search"
									value={search}
									onChange={event => {
										setSearch(event.target.value)
										setPage(1)
									}}
									placeholder={t('searchPlaceholderBoard')}
									aria-label={t('searchLabel')}
									className="pl-9"
								/>
							</div>
						</div>
						<div
							className="flex flex-wrap items-center gap-2"
							data-share-exclude="true"
						>
							<span className="eyebrow mr-1">{t('filtersLabel')}</span>
							<Select
								value={scope}
								onValueChange={value => {
									setScope(value as PriceChangeScope)
									setPage(1)
								}}
							>
								<SelectTrigger
									id="price-change-scope"
									aria-label={t('scopeLabel')}
									className={cn(
										'h-9 w-auto min-w-[9rem] rounded-full px-3 text-xs font-medium',
										scope !== DEFAULT_PRICE_CHANGE_SCOPE &&
											'border-primary/50 bg-primary/10 text-foreground'
									)}
								>
									<span className="mr-1 text-muted-foreground">
										{t('scopeLabel')}:
									</span>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="likely">{t('scopeLikely')}</SelectItem>
									<SelectItem value="all">{t('scopeAll')}</SelectItem>
								</SelectContent>
							</Select>
							<Select
								value={movement}
								onValueChange={value => {
									const nextMovement = value as PriceChangeMovementFilter
									setMovement(nextMovement)
									if (nextMovement === 'locked') setScope('all')
									setPage(1)
								}}
							>
								<SelectTrigger
									id="price-change-movement"
									aria-label={t('filterLabel')}
									className={cn(
										'h-9 w-auto min-w-[8.5rem] rounded-full px-3 text-xs font-medium',
										movement !== 'all' &&
											'border-primary/50 bg-primary/10 text-foreground'
									)}
								>
									<span className="mr-1 text-muted-foreground">
										{t('filterLabel')}:
									</span>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">{t('filterAll')}</SelectItem>
									<SelectItem value="rise">{t('filterRise')}</SelectItem>
									<SelectItem value="fall">{t('filterFall')}</SelectItem>
									<SelectItem value="locked">{t('filterLocked')}</SelectItem>
								</SelectContent>
							</Select>
							<Select
								value={teamId}
								onValueChange={value => {
									setTeamId(value)
									setPage(1)
								}}
							>
								<SelectTrigger
									id="price-change-team"
									aria-label={t('filterByTeam')}
									className={cn(
										'h-9 w-auto min-w-[9.5rem] max-w-full rounded-full px-3 text-xs font-medium',
										teamId !== 'all' &&
											'border-primary/50 bg-primary/10 text-foreground'
									)}
								>
									<span className="mr-1 text-muted-foreground">
										{t('teamFilterLabel')}:
									</span>
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="max-h-72">
									<SelectItem value="all">{t('allTeams')}</SelectItem>
									{teamOptions.map(team => (
										<SelectItem
											key={team.id}
											value={String(team.id)}
										>
											{team.shortName} · {team.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{hasFilters ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={resetFilters}
							>
								{t('resetFilters')}
							</Button>
						) : null}
					</div>

					<div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
						<p>
							{t('resultCountBoard', {
								from,
								to,
								total: filteredPlayers.length
							})}
						</p>
					</div>
				</div>

				<div>
					{visiblePlayers.length === 0 ? (
						<div className="px-4 py-14 text-center text-sm text-muted-foreground sm:px-6">
							{t('noMatchesBoard')}
						</div>
					) : (
						<>
							<div
								className="flex items-center gap-2 px-4 pt-4 md:hidden"
								data-share-exclude="true"
							>
								<span className="text-xs font-medium text-muted-foreground">
									{t('sortLabel')}:
								</span>
								<Select
									value={`${sort.column}:${sort.direction}`}
									onValueChange={setSortValue}
								>
									<SelectTrigger
										id="price-change-mobile-sort"
										className="h-8 w-auto min-w-[9rem] rounded-full px-3 text-xs"
										aria-label={t('sortLabel')}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="progress:desc">
											{t('progress')} ↓
										</SelectItem>
										<SelectItem value="progress:asc">
											{t('progress')} ↑
										</SelectItem>
										<SelectItem value="price:desc">{t('price')} ↓</SelectItem>
										<SelectItem value="price:asc">{t('price')} ↑</SelectItem>
										<SelectItem value="signal:desc">{t('signal')} ↓</SelectItem>
										<SelectItem value="signal:asc">{t('signal')} ↑</SelectItem>
										<SelectItem value="movement:desc">
											{t('movement')} ↓
										</SelectItem>
										<SelectItem value="movement:asc">
											{t('movement')} ↑
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="hidden overflow-x-auto md:block">
								<table className="min-w-[760px] w-full text-left text-sm">
									<thead className="border-b border-border/70 bg-muted/10 text-xs uppercase tracking-[0.12em] text-muted-foreground">
										<tr>
											<th className="px-5 py-3 font-semibold">
												{t('playerLabel')}
											</th>
											<th className="px-3 py-3 font-semibold">
												{t('positionLabel')}
											</th>
											<SortableHeader
												column="price"
												label={t('price')}
												sort={sort}
												onSort={setSortColumn}
											/>
											<SortableHeader
												column="progress"
												label={t('progress')}
												sort={sort}
												onSort={setSortColumn}
											/>
											<SortableHeader
												column="signal"
												label={t('signal')}
												sort={sort}
												onSort={setSortColumn}
											/>
											<SortableHeader
												column="movement"
												label={t('movement')}
												sort={sort}
												onSort={setSortColumn}
												align="right"
											/>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{visiblePlayers.map(player => {
											const TrendIcon = ownershipIcon(player.ownershipTrend)
											return (
												<tr
													key={player.playerId}
													className={cn(
														'align-middle transition-colors',
														changeHighlightClass(player.status)
													)}
												>
													<td className="px-5 py-3.5">
														<div className="flex items-center gap-3">
															<MarketPositionBadge position={player.position} />
															<div className="min-w-0">
																<Link
																	prefetch={false}
																	href={playerStatsHref({
																		p1: String(player.playerId)
																	})}
																	className="block truncate font-semibold text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
																>
																	{player.webName}
																</Link>
																<span className="block truncate text-xs text-muted-foreground">
																	{player.teamName}
																</span>
															</div>
														</div>
													</td>
													<td className="px-3 py-3.5 text-xs font-semibold text-muted-foreground">
														{player.position}
													</td>
													<td className="px-3 py-3.5 font-mono tabular-nums">
														{formatPrice(player.currentPrice)}
													</td>
													<td className="px-3 py-3.5">
														<div className="flex min-w-[130px] items-center gap-2">
															<div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
																<div
																	className={cn(
																		'h-full rounded-full',
																		progressClass(player.progressPercent)
																	)}
																	style={{
																		width: `${Math.min(100, Math.abs(player.progressPercent))}%`
																	}}
																/>
															</div>
															<span className="font-mono text-xs tabular-nums">
																{formatPercent(player.progressPercent)}
															</span>
														</div>
													</td>
													<td className="px-3 py-3.5">
														<PriceChangeSignalBadge
															status={player.status}
															lockedUntil={player.lockedUntil}
															hydrated={hydrated}
															statusLabel={t(
																statusTranslationKey[player.status]
															)}
															unlocksInDaysLabel={days =>
																t('statusUnlocksInDays', { days })
															}
														/>
													</td>
													<td className="px-5 py-3.5 text-right">
														<div
															className={cn(
																'flex items-center justify-end gap-1.5 font-medium',
																ownershipClass(player.ownershipTrend)
															)}
														>
															<TrendIcon
																className="size-4"
																aria-hidden="true"
															/>
															<span>
																{player.selectedByPercent.toFixed(1)}%
															</span>
														</div>
														<p className="mt-0.5 text-xs text-muted-foreground">
															{player.transfersInEvent.toLocaleString(locale)}{' '}
															{t('transfersIn')}·{' '}
															{player.transfersOutEvent.toLocaleString(locale)}{' '}
															{t('transfersOut')}
														</p>
													</td>
												</tr>
											)
										})}
									</tbody>
								</table>
							</div>

							<div className="divide-y divide-border/60 md:hidden">
								{visiblePlayers.map(player => {
									const TrendIcon = ownershipIcon(player.ownershipTrend)
									return (
										<div
											key={player.playerId}
											className={cn(
												'space-y-3 border p-4 transition-colors',
												changeHighlightClass(player.status, true)
											)}
										>
											<div className="flex items-start justify-between gap-3">
												<div className="flex min-w-0 items-center gap-2.5">
													<MarketPositionBadge position={player.position} />
													<div className="min-w-0">
														<Link
															prefetch={false}
															href={playerStatsHref({
																p1: String(player.playerId)
															})}
															className="block truncate font-semibold text-primary-ink underline decoration-primary/35 underline-offset-2"
														>
															{player.webName}
														</Link>
														<p className="truncate text-xs text-muted-foreground">
															{player.teamName} ·{' '}
															{formatPrice(player.currentPrice)}
														</p>
													</div>
												</div>
												<PriceChangeSignalBadge
													status={player.status}
													lockedUntil={player.lockedUntil}
													hydrated={hydrated}
													statusLabel={t(statusTranslationKey[player.status])}
													unlocksInDaysLabel={days =>
														t('statusUnlocksInDays', { days })
													}
													className="shrink-0"
												/>
											</div>
											<div className="flex items-center gap-3">
												<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
													<div
														className={cn(
															'h-full rounded-full',
															progressClass(player.progressPercent)
														)}
														style={{
															width: `${Math.min(100, Math.abs(player.progressPercent))}%`
														}}
													/>
												</div>
												<span className="w-14 text-right font-mono text-xs tabular-nums">
													{formatPercent(player.progressPercent)}
												</span>
											</div>
											<div className="flex items-center justify-between text-xs text-muted-foreground">
												<span>
													{t('ownership')}:{' '}
													{player.selectedByPercent.toFixed(1)}%
												</span>
												<span
													className={cn(
														'inline-flex items-center gap-1 font-medium',
														ownershipClass(player.ownershipTrend)
													)}
												>
													<TrendIcon
														className="size-3.5"
														aria-hidden="true"
													/>
													{player.transfersInEvent.toLocaleString(locale)} /{' '}
													{player.transfersOutEvent.toLocaleString(locale)}
												</span>
											</div>
										</div>
									)
								})}
							</div>
						</>
					)}

					{visiblePlayers.length > 0 && pageCount > 1 ? (
						<div
							className="flex items-center justify-between border-t border-border/70 px-4 py-3 sm:px-5"
							data-share-exclude="true"
						>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={safePage <= 1}
								onClick={() => setPage(current => Math.max(1, current - 1))}
							>
								<ArrowLeft aria-hidden="true" />
								<span className="hidden sm:inline">{t('previousPage')}</span>
							</Button>
							<span className="text-xs text-muted-foreground">
								{t('pageOf', { page: safePage, pages: pageCount })}
							</span>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={safePage >= pageCount}
								onClick={() =>
									setPage(current => Math.min(pageCount, current + 1))
								}
							>
								<span className="hidden sm:inline">{t('nextPage')}</span>
								<ArrowRight aria-hidden="true" />
							</Button>
						</div>
					) : null}
				</div>
			</Card>

			<PriceChangeShareCard
				players={shareScopePlayers}
				labels={shareLabels}
				updatedAtLabel={snapshotUpdatedAtLabel}
				deadlineLabel={formatDeadline(displayBoard.deadline, locale, hydrated)}
				shareRef={shareRef}
			/>
		</div>
	)
}
