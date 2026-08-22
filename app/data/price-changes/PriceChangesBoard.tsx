'use client'

import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { MarketPositionBadge } from '@/components/data/MarketMarkup'
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
import { Link, useRouter } from '@/i18n/navigation'
import type {
	PriceChangeBoard,
	PriceChangePlayer
} from '@/lib/graphql/operations/price-changes'
import {
	calculateSellingPrice,
	type PersonalPriceState
} from '@/lib/price-change-personal'
import type { SquadLoadState } from '@/lib/squad-picks'
import { cn } from '@/lib/utils'
import { useHydrated } from '@/hooks/use-hydrated'
import {
	ArrowDownRight,
	ArrowLeft,
	ArrowRight,
	ArrowUpRight,
	CircleHelp,
	Minus,
	RefreshCcw,
	Search
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

const PAGE_SIZE = 20

type MovementFilter = 'all' | 'rise' | 'fall' | 'locked'
type ScopeFilter = 'all' | 'mine'
type SortMode = 'momentum' | 'ownership'

const LAST_VALID_BOARD_STORAGE_KEY = 'letletme:price-change-board:v1'
const LAST_VALID_BOARD_MAX_AGE_MS = 24 * 60 * 60 * 1_000

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
	hydrated: boolean,
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
			JSON.stringify({ savedAt, board }),
		)
	} catch {
		// Storage is an enhancement. The in-memory board remains authoritative.
	}
}

function personalPriceForPlayer(
	player: PriceChangePlayer,
	purchasePrices: Record<string, number>,
): { purchasePrice: number; sellingPrice: number } | null {
	const purchasePrice = purchasePrices[String(player.playerId)]
	if (!Number.isFinite(purchasePrice)) return null
	return {
		purchasePrice,
		sellingPrice: calculateSellingPrice(purchasePrice, player.currentPrice)
	}
}

function useDeadlineCountdown(deadline: string | null): string | null {
	const [now, setNow] = useState<number | null>(null)

	useEffect(() => {
		if (!deadline) return
		const update = () => setNow(Date.now())
		update()
		const timer = window.setInterval(update, 1_000)
		return () => window.clearInterval(timer)
	}, [deadline])

	if (!deadline || now == null) return null
	const remaining = Date.parse(deadline) - now
	if (!Number.isFinite(remaining) || remaining <= 0) return null
	const totalSeconds = Math.floor(remaining / 1_000)
	const hours = Math.floor(totalSeconds / 3_600)
	const minutes = Math.floor((totalSeconds % 3_600) / 60)
	const seconds = totalSeconds % 60
	return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
}

function statusClass(status: PriceChangePlayer['status']): string {
	if (status.includes('RISE'))
		return 'border-success/45 bg-success/10 text-success'
	if (status.includes('FALL'))
		return 'border-destructive/45 bg-destructive/10 text-destructive'
	if (status === 'LOCKED' || status === 'CALIBRATING') {
		return 'border-warning/45 bg-warning/10 text-warning'
	}
	return 'border-border/70 bg-muted/30 text-muted-foreground'
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
	status: PriceChangeBoard['status']
): 'info' | 'warning' | 'destructive' | null {
	if (status === 'PARTIAL') return 'info'
	if (status === 'STALE') return 'warning'
	if (status === 'UNAVAILABLE') return 'destructive'
	return null
}

export function PriceChangesBoard({
	board,
	locale,
	mySquadElementIds,
	mySquadState,
	personalPurchasePrices,
	personalPriceState
}: {
	board: PriceChangeBoard
	locale: string
	mySquadElementIds: number[]
	mySquadState: SquadLoadState
	personalPurchasePrices: Record<string, number>
	personalPriceState: PersonalPriceState
}) {
	const t = useTranslations('PriceChanges')
	const router = useRouter()
	const hydrated = useHydrated()
	const [search, setSearch] = useState('')
	const [movement, setMovement] = useState<MovementFilter>('all')
	const [scope, setScope] = useState<ScopeFilter>('all')
	const [sort, setSort] = useState<SortMode>('momentum')
	const [teamId, setTeamId] = useState('all')
	const [page, setPage] = useState(1)
	const [displayBoard, setDisplayBoard] = useState(board)
	const mySquad = useMemo(() => new Set(mySquadElementIds), [mySquadElementIds])
	const countdown = useDeadlineCountdown(displayBoard.deadline)

	useEffect(() => {
		if (isPersistableBoard(board)) {
			setDisplayBoard(board)
			persistLastValidBoard(board)
			return
		}

		const lastValidBoard = readLastValidBoard()
		setDisplayBoard(lastValidBoard ?? board)
	}, [board])

	useEffect(() => {
		const timer = window.setInterval(() => router.refresh(), 5 * 60 * 1_000)
		return () => window.clearInterval(timer)
	}, [router])

	const teamOptions = useMemo(() => {
		const teams = new Map<number, { id: number; name: string; shortName: string }>()
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
			left.name.localeCompare(right.name, locale),
		)
	}, [displayBoard.players, locale])

	const filteredPlayers = useMemo(() => {
		const query = search.trim().toLowerCase()
		return displayBoard.players
			.filter(player => {
				if (scope === 'mine' && !mySquad.has(player.playerId)) return false
				if (teamId !== 'all' && String(player.teamId) !== teamId) return false
				if (movement === 'rise' && player.progressPercent <= 0) return false
				if (movement === 'fall' && player.progressPercent >= 0) return false
				if (
					movement === 'locked' &&
					player.status !== 'LOCKED' &&
					player.status !== 'CALIBRATING'
				) {
					return false
				}
				if (!query) return true
				return `${player.webName} ${player.teamName} ${player.teamShortName}`
					.toLowerCase()
					.includes(query)
			})
			.sort((left, right) => {
				const primary =
					sort === 'ownership'
						? right.selectedByPercent - left.selectedByPercent
						: Math.abs(right.progressPercent) - Math.abs(left.progressPercent)
				if (primary !== 0) return primary
				return left.webName.localeCompare(right.webName)
			})
	}, [displayBoard.players, movement, mySquad, scope, search, sort, teamId])

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
		setMovement('all')
		setScope('all')
		setSort('momentum')
		setTeamId('all')
		setPage(1)
	}

	const hasFilters =
		search.length > 0 ||
		movement !== 'all' ||
		scope !== 'all' ||
		sort !== 'momentum' ||
		teamId !== 'all'
	const alertVariant = statusAlertVariant(displayBoard.status)
	const from = filteredPlayers.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
	const to = Math.min(safePage * PAGE_SIZE, filteredPlayers.length)

	return (
		<div className="space-y-5">
			<div className="grid gap-3 rounded-xl border border-border/80 bg-card/40 p-4 sm:grid-cols-2 sm:p-5">
				<div>
					<p className="eyebrow">{t('deadlineLabel')}</p>
					<p className="mt-1 font-display text-base font-semibold tabular-nums">
						{formatDeadline(displayBoard.deadline, locale, hydrated)}
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						{countdown ??
							(displayBoard.deadline ? t('deadlinePassed') : t('noDeadline'))}
					</p>
				</div>
				<div>
					<p className="eyebrow">{t('playersLabel')}</p>
					<p className="mt-1 font-display text-base font-semibold tabular-nums">
						{displayBoard.observedPlayerCount.toLocaleString(locale)}
						<span className="ml-1 text-sm font-normal text-muted-foreground">
							/ {displayBoard.expectedPlayerCount.toLocaleString(locale)}
						</span>
					</p>
				</div>
			</div>

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

			<div className="flex flex-col gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
				<p className="text-sm text-muted-foreground">{t('guideSummary')}</p>
				<Dialog>
					<DialogTrigger asChild>
						<Button type="button" variant="outline" size="sm" className="shrink-0">
							<CircleHelp data-icon="inline-start" aria-hidden="true" />
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

			<Card className="overflow-hidden border-border/80 shadow-sm">
				<div className="border-b border-border/70 bg-muted/10 p-4 sm:p-5">
					<div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end">
						<div className="space-y-1.5">
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
						<div className="space-y-1.5">
							<label
								className="eyebrow"
								htmlFor="price-change-scope"
							>
								{t('scopeLabel')}
							</label>
							<Select
								value={scope}
								onValueChange={value => {
									setScope(value as ScopeFilter)
									setPage(1)
								}}
							>
								<SelectTrigger id="price-change-scope">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">{t('scopeAll')}</SelectItem>
									<SelectItem value="mine">{t('scopeMine')}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<label
								className="eyebrow"
								htmlFor="price-change-team"
							>
								{t('filterByTeam')}
							</label>
							<Select
								value={teamId}
								onValueChange={value => {
									setTeamId(value)
									setPage(1)
								}}
							>
								<SelectTrigger id="price-change-team">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="max-h-72">
									<SelectItem value="all">{t('allTeams')}</SelectItem>
									{teamOptions.map(team => (
										<SelectItem key={team.id} value={String(team.id)}>
											{team.shortName} · {team.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<label
								className="eyebrow"
								htmlFor="price-change-movement"
							>
								{t('filterLabel')}
							</label>
							<Select
								value={movement}
								onValueChange={value => {
									setMovement(value as MovementFilter)
									setPage(1)
								}}
							>
								<SelectTrigger id="price-change-movement">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">{t('filterAll')}</SelectItem>
									<SelectItem value="rise">{t('filterRise')}</SelectItem>
									<SelectItem value="fall">{t('filterFall')}</SelectItem>
									<SelectItem value="locked">{t('filterLocked')}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<label
								className="eyebrow"
								htmlFor="price-change-sort"
							>
								{t('sortLabel')}
							</label>
							<Select
								value={sort}
								onValueChange={value => {
									setSort(value as SortMode)
									setPage(1)
								}}
							>
								<SelectTrigger id="price-change-sort">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="momentum">{t('sortMomentum')}</SelectItem>
									<SelectItem value="ownership">
										{t('sortOwnership')}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{hasFilters ? (
							<Button
								type="button"
								variant="ghost"
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
						<div className="space-y-1 text-right" role="status">
							{scope === 'mine' && mySquadElementIds.length === 0 ? (
								<p>
									{mySquadState === 'unavailable'
										? t('mySquadUnavailable')
										: mySquadState === 'not-published'
											? t('mySquadNotPublished')
											: t('mySquadEmpty')}
								</p>
							) : null}
							{scope === 'mine' && mySquadElementIds.length > 0 && personalPriceState !== 'READY' ? (
								<p>{t('personalPriceUnavailable')}</p>
							) : null}
						</div>
					</div>
				</div>

				{visiblePlayers.length === 0 ? (
					<div className="px-4 py-14 text-center text-sm text-muted-foreground sm:px-6">
						{t('noMatchesBoard')}
					</div>
				) : (
					<>
						<div className="hidden overflow-x-auto md:block">
							<table className="w-full min-w-[760px] text-left text-sm">
								<thead className="border-b border-border/70 bg-muted/10 text-xs uppercase tracking-[0.12em] text-muted-foreground">
									<tr>
										<th className="px-5 py-3 font-semibold">
											{t('playerLabel')}
										</th>
										<th className="px-3 py-3 font-semibold">
											{t('positionLabel')}
										</th>
										<th className="px-3 py-3 font-semibold">{t('price')}</th>
										{scope === 'mine' ? (
											<>
												<th className="px-3 py-3 font-semibold">
													{t('purchasePrice')}
												</th>
												<th className="px-3 py-3 font-semibold">
													{t('sellingPrice')}
												</th>
											</>
										) : null}
										<th className="px-3 py-3 font-semibold">{t('progress')}</th>
										<th className="px-3 py-3 font-semibold">{t('signal')}</th>
										<th className="px-5 py-3 text-right font-semibold">
											{t('movement')}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/60">
									{visiblePlayers.map(player => {
										const TrendIcon = ownershipIcon(player.ownershipTrend)
										const personalPrice =
											scope === 'mine'
												? personalPriceForPlayer(player, personalPurchasePrices)
												: null
										return (
											<tr
												key={player.playerId}
												className="align-middle hover:bg-muted/15"
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
																{player.teamShortName} · {player.teamName}
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
												{scope === 'mine' ? (
													<>
														<td className="px-3 py-3.5 font-mono tabular-nums">
															{personalPrice
																? formatPrice(personalPrice.purchasePrice)
																: '—'}
														</td>
														<td className="px-3 py-3.5 font-mono tabular-nums">
															{personalPrice
																? formatPrice(personalPrice.sellingPrice)
																: '—'}
														</td>
													</>
												) : null}
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
													<Badge
														variant="outline"
														className={cn(
															'whitespace-nowrap',
															statusClass(player.status)
														)}
													>
														{t(statusTranslationKey[player.status])}
													</Badge>
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
														<span>{player.selectedByPercent.toFixed(1)}%</span>
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
								const personalPrice =
									scope === 'mine'
										? personalPriceForPlayer(player, personalPurchasePrices)
										: null
								return (
									<div
										key={player.playerId}
										className="space-y-3 p-4"
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
														{player.teamShortName} ·{' '}
														{formatPrice(player.currentPrice)}
													</p>
												</div>
											</div>
											<Badge
												variant="outline"
												className={cn('shrink-0', statusClass(player.status))}
											>
												{t(statusTranslationKey[player.status])}
											</Badge>
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
												{t('ownership')}: {player.selectedByPercent.toFixed(1)}%
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
										{scope === 'mine' ? (
											<div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/35 px-3 py-2 text-xs">
												<div>
													<p className="text-muted-foreground">{t('purchasePrice')}</p>
													<p className="mt-0.5 font-mono font-medium tabular-nums text-foreground">
														{personalPrice
															? formatPrice(personalPrice.purchasePrice)
															: '—'}
													</p>
												</div>
												<div>
													<p className="text-muted-foreground">{t('sellingPrice')}</p>
													<p className="mt-0.5 font-mono font-medium tabular-nums text-foreground">
														{personalPrice
															? formatPrice(personalPrice.sellingPrice)
															: '—'}
													</p>
												</div>
											</div>
										) : null}
									</div>
								)
							})}
						</div>
					</>
				)}

				{visiblePlayers.length > 0 && pageCount > 1 ? (
					<div className="flex items-center justify-between border-t border-border/70 px-4 py-3 sm:px-5">
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
			</Card>
		</div>
	)
}
