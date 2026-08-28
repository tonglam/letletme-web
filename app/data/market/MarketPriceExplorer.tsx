'use client'

import { MarketPositionBadge } from '@/components/data/MarketMarkup'
import { MarketLocalUpdated } from '@/components/data/MarketLocalUpdated'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import type {
	MarketPlayer,
	MarketPriceChange
} from '@/lib/graphql/operations/market'
import type {
	PriceChangeBoard,
	PriceChangeObservedEvent,
	PriceChangeLiveState
} from '@/lib/graphql/operations/price-changes'
import type { PlayerDirectoryItem } from '@/lib/graphql/operations/players'
import { markRouteReadyStart } from '@/lib/analytics/route-navigation'
import {
	buildMarketShareUrl,
	formatPriceMovementShareText
} from '@/app/data/market/_lib/market-price-share'
import { marketRevisionParam } from '@/lib/market-client'
import { mapLatestPriceChangeEvent } from '@/lib/price-change-observed'
import {
	type PriceChangeLiveSeed,
	usePriceChangeLiveUpdates
} from '@/lib/price-change-live-client'
import { ShareActions } from '@/components/share/ShareActions'
import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ComponentProps,
	type ReactNode,
	type RefObject
} from 'react'
import { cn } from '@/lib/utils'

const LazyMarketPlayerLookup = lazy(() =>
	import('@/components/data/MarketPlayerLookup').then(module => ({
		default: module.MarketPlayerLookup
	}))
)

function formatCalendarDate(value: string | null, locale: string): string {
	if (!value) return '—'
	const parsed = parseCalendarDate(value)
	if (!parsed) return value
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: CALENDAR_DATE_TIME_ZONE
	}).format(parsed)
}

function marketPlayerToDirectory(player: MarketPlayer): PlayerDirectoryItem {
	return {
		id: player.playerId,
		webName: player.webName,
		position: player.position,
		price: player.price,
		selectedByPercent: player.selectedByPercent,
		team: {
			id: player.teamId,
			name: player.teamName,
			shortName: player.teamShortName
		}
	}
}

function observedEventOrder(
	event: PriceChangeObservedEvent | null | undefined
): readonly [number, number] | null {
	if (!event) return null
	const deadline = Date.parse(event.deadline)
	const observedAt = Date.parse(event.observedAt)
	if (!Number.isFinite(deadline) || !Number.isFinite(observedAt)) return null
	return [deadline, observedAt]
}

function isObservedEventAtLeastAsNew(
	next: PriceChangeObservedEvent | null | undefined,
	current: PriceChangeObservedEvent | null
): boolean {
	const nextOrder = observedEventOrder(next)
	if (!nextOrder) return false
	if (!current) return true
	const currentOrder = observedEventOrder(current)
	if (!currentOrder) return true
	return (
		nextOrder[0] > currentOrder[0] ||
		(nextOrder[0] === currentOrder[0] && nextOrder[1] >= currentOrder[1])
	)
}

function PositionBadge({ player }: { player: MarketPlayer }) {
	return <MarketPositionBadge position={player.position} />
}

function SectionTitle({
	id,
	children,
	action
}: {
	id: string
	children: ReactNode
	action?: ReactNode
}) {
	return (
		<div className="mb-3 flex flex-col gap-2 border-b border-border/60 pb-2 sm:flex-row sm:items-start sm:justify-between">
			<div className="min-w-0">
				<h2
					id={id}
					className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
				>
					{children}
				</h2>
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	)
}

function EmptyHint({ children }: { children: ReactNode }) {
	return (
		<p
			className="rounded-md border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground"
			role="status"
		>
			{children}
		</p>
	)
}

function LazyMarketPlayerLookupBoundary(
	props: ComponentProps<typeof LazyMarketPlayerLookup>
) {
	return (
		<Suspense
			fallback={
				<div
					className="min-h-32"
					aria-hidden="true"
				/>
			}
		>
			<LazyMarketPlayerLookup {...props} />
		</Suspense>
	)
}

export function MarketPlayerLookupLauncher({
	revision,
	seedPlayer,
	compact = true,
	initialOpen = false,
	onClearSeed
}: {
	revision?: string | null
	seedPlayer?: PlayerDirectoryItem | null
	compact?: boolean
	initialOpen?: boolean
	onClearSeed?: () => void
}) {
	const t = useTranslations('Market')
	const [open, setOpen] = useState(initialOpen || seedPlayer != null)
	const [searchTerm, setSearchTerm] = useState('')
	const [searchStartedAt, setSearchStartedAt] = useState<number | null>(null)
	const [openedByUser, setOpenedByUser] = useState(false)
	const shouldOpen = open || seedPlayer != null

	if (shouldOpen) {
		return (
			<LazyMarketPlayerLookupBoundary
				initialSearchTerm={searchTerm}
				initialSearchStartedAt={searchStartedAt}
				compact={compact && seedPlayer != null}
				autoFocus={openedByUser || searchTerm.trim().length >= 2}
				seedPlayer={seedPlayer}
				onClearSeed={onClearSeed}
				revision={revision}
			/>
		)
	}
	if (!compact) {
		return (
			<>
				<label
					htmlFor="market-player-search"
					className="mb-2 block text-sm font-semibold"
				>
					{t('searchPlayers')}
				</label>
				<Input
					id="market-player-search"
					type="search"
					value={searchTerm}
					onChange={event => {
						const value = event.target.value
						setSearchTerm(value)
						if (value.trim().length >= 2) {
							setSearchStartedAt(performance.now())
							setOpenedByUser(true)
							setOpen(true)
						}
					}}
					placeholder={t('searchPlaceholder')}
					maxLength={50}
					className="h-11"
				/>
			</>
		)
	}

	return (
		<div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
			<p className="min-w-0 flex-1 text-xs text-muted-foreground">
				{t('historyClickHint')}
			</p>
			<Button
				type="button"
				data-testid="market-open-player-search"
				variant="ghost"
				size="sm"
				className="h-7 shrink-0 px-2 text-xs"
				onClick={() => {
					setOpenedByUser(true)
					setOpen(true)
				}}
			>
				<Search
					className="size-3.5"
					aria-hidden="true"
				/>
				{t('lookupAnotherPlayer')}
			</Button>
		</div>
	)
}

function PriceShareActions({
	changes,
	changeDate,
	imageRef
}: {
	changes: MarketPriceChange[]
	changeDate: string | null
	imageRef: RefObject<HTMLElement | null>
}) {
	const t = useTranslations('Market')
	const shareText = useCallback(() => {
		const origin =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://letletme.top'
		const pathPrefix =
			typeof window !== 'undefined'
				? window.location.pathname.startsWith('/zh-CN')
					? '/zh-CN'
					: ''
				: ''
		const shareUrl = buildMarketShareUrl(origin, pathPrefix)
		return formatPriceMovementShareText({
			changes,
			changeDate,
			labels: {
				title: t('priceTitle'),
				rises: t('priceRises'),
				falls: t('priceFalls'),
				none: t('shareNone'),
				footer: t('shareFooter', { url: shareUrl })
			}
		})
	}, [changeDate, changes, t])

	return (
		<ShareActions
			text={shareText}
			imageRef={imageRef}
			title={t('priceTitle')}
		/>
	)
}

function PriceColumns({
	changes,
	locale,
	selectedPlayerId,
	onSelectPlayer
}: {
	changes: MarketPriceChange[]
	locale: string
	selectedPlayerId: number | null
	onSelectPlayer: (player: MarketPlayer) => void
}) {
	const t = useTranslations('Market')
	const rises = changes.filter(c => c.direction === 'RISE')
	const falls = changes.filter(c => c.direction === 'FALL')

	if (changes.length === 0) {
		return (
			<div className="rounded-md border border-dashed border-border/70 px-3 py-5">
				<p className="text-sm font-medium">{t('pricesLockedTitle')}</p>
				<p className="mt-1 text-xs text-muted-foreground">
					{t('pricesLockedDescription')}
				</p>
			</div>
		)
	}

	const col = (items: MarketPriceChange[], rising: boolean) => (
		<div className="min-w-0 rounded-lg border border-border/60 bg-muted/15 px-3 py-3 dark:bg-muted/10">
			<p
				className={cn(
					'mb-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.12em]',
					rising ? 'text-success' : 'text-destructive'
				)}
			>
				{rising ? t('priceRises') : t('priceFalls')}
				<span className="ml-1.5 font-mono text-muted-foreground">
					({items.length})
				</span>
			</p>
			{items.length === 0 ? (
				<EmptyHint>{t('noData')}</EmptyHint>
			) : (
				<ul className="w-full">
					{items.map((change, index) => {
						const selected = change.player.playerId === selectedPlayerId
						return (
							<li
								key={`${change.player.playerId}-${change.changeDate}-${index}`}
							>
								<div
									className={cn(
										'group relative border-b border-border/40 py-2.5 last:border-b-0',
										selected && 'bg-primary/5'
									)}
								>
									<button
										type="button"
										onClick={() => onSelectPlayer(change.player)}
										className="absolute inset-0 z-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										aria-pressed={selected}
										aria-label={t('openPriceHistory', {
											name: change.player.webName
										})}
									/>
									<div className="pointer-events-none relative z-[1] flex w-full items-center gap-2.5 group-hover:bg-background/60">
										<PositionBadge player={change.player} />
										<span className="min-w-0 flex-1">
											<a
												href={playerStatsHref({
													p1: String(change.player.playerId),
													localePathPrefix: locale === 'en' ? '' : `/${locale}`
												})}
												className="pointer-events-auto market-player-link"
											>
												{change.player.webName}
											</a>
											<span className="block truncate text-[11px] text-muted-foreground">
												{change.player.teamShortName}
											</span>
										</span>
										<span className="shrink-0 text-right">
											<span
												className={cn(
													'block font-display text-sm font-semibold tabular-nums leading-tight',
													rising ? 'text-success' : 'text-destructive'
												)}
											>
												{rising ? '+' : '−'}£
												{(Math.abs(change.change) / 10).toFixed(1)}m
											</span>
											<span className="block text-[10px] tabular-nums text-muted-foreground">
												£{(change.oldPrice / 10).toFixed(1)}m → £
												{(change.newPrice / 10).toFixed(1)}m
											</span>
										</span>
									</div>
								</div>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)

	return (
		<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
			{col(rises, true)}
			{col(falls, false)}
		</div>
	)
}

export function MarketPriceExplorer({
	changes,
	changeDate,
	observedAt,
	locale,
	marketRevision,
	priceRevision,
	priceBoard,
	initialOpen = false
}: {
	changes: MarketPriceChange[]
	changeDate: string | null
	observedAt: string | null
	locale: string
	marketRevision: string | null
	priceRevision: string | null
	priceBoard?: PriceChangeBoard | null
	initialOpen?: boolean
}) {
	const t = useTranslations('Market')
	const [seedPlayer, setSeedPlayer] = useState<PlayerDirectoryItem | null>(null)
	const shareRef = useRef<HTMLElement | null>(null)
	const initialObserved = priceBoard
		? mapLatestPriceChangeEvent(priceBoard)
		: null
	const [latestPriceChanges, setLatestPriceChanges] = useState(changes)
	const [currentChangeDate, setCurrentChangeDate] = useState(changeDate)
	const [currentObservedAt, setCurrentObservedAt] = useState(observedAt)
	const [currentPriceRevision, setCurrentPriceRevision] =
		useState(priceRevision)
	const [liveState, setLiveState] = useState<PriceChangeLiveState>(
		priceBoard?.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'DURABLE'
	)
	const lastObservedEventRef = useRef<PriceChangeObservedEvent | null>(
		priceBoard?.latestEvent ?? null
	)
	const lastEventRevisionRef = useRef<string | null>(
		initialObserved?.eventRevision ?? null
	)
	const liveSeed: PriceChangeLiveSeed = useMemo(
		() => ({
			revision: priceBoard?.revision ?? priceRevision ?? 'unavailable',
			deadline: priceBoard?.deadline ?? null,
			nextDeadlines: priceBoard?.nextDeadlines ?? []
		}),
		[priceBoard, priceRevision]
	)
	const applyObservedBoard = useCallback(
		(nextBoard: PriceChangeBoard): boolean => {
			const nextEvent = nextBoard.latestEvent ?? null
			const nextObserved = mapLatestPriceChangeEvent(nextBoard)
			if (
				!nextObserved ||
				!nextEvent ||
				!isObservedEventAtLeastAsNew(nextEvent, lastObservedEventRef.current)
			) {
				return false
			}
			setLatestPriceChanges([...nextObserved.rises, ...nextObserved.falls])
			setCurrentChangeDate(nextObserved.changeDate)
			setCurrentObservedAt(nextObserved.observedAt)
			setCurrentPriceRevision(nextObserved.eventRevision)
			lastObservedEventRef.current = nextEvent
			lastEventRevisionRef.current = nextObserved.eventRevision
			return true
		},
		[]
	)

	useEffect(() => {
		if (priceBoard && applyObservedBoard(priceBoard)) return
		// A daily market snapshot or a temporary cursor failure must not erase
		// an already observed 07:00 event. Only use the old snapshot fallback
		// while no immutable event has ever been received in this mount.
		if (!lastEventRevisionRef.current) {
			setLatestPriceChanges(changes)
			setCurrentChangeDate(changeDate)
			setCurrentObservedAt(observedAt)
			setCurrentPriceRevision(priceRevision)
		}
	}, [
		applyObservedBoard,
		changeDate,
		changes,
		observedAt,
		priceBoard,
		priceRevision
	])

	usePriceChangeLiveUpdates({
		seed: liveSeed,
		durableBoard: priceBoard ?? undefined,
		onUpdate: (nextBoard, state) => {
			applyObservedBoard(nextBoard)
			setLiveState(state)
		},
		onReset: state => {
			// Keep the last event visible while the cursor is temporarily
			// unavailable. The daily snapshot is only a pre-event fallback.
			if (!lastEventRevisionRef.current) {
				setLatestPriceChanges(changes)
				setCurrentChangeDate(changeDate)
				setCurrentObservedAt(observedAt)
				setCurrentPriceRevision(priceRevision)
			}
			setLiveState(state)
		}
	})

	const handleSelectPricePlayer = useCallback(
		(player: MarketPlayer) => {
			markRouteReadyStart(
				window.location.pathname,
				performance.now(),
				`${player.playerId}:${marketRevisionParam(marketRevision)}`
			)
			setSeedPlayer(marketPlayerToDirectory(player))
		},
		[marketRevision]
	)

	return (
		<section
			aria-labelledby="market-prices"
			className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
			ref={shareRef}
			data-share-preserve-width="true"
			data-price-change-live-state={liveState}
			data-price-change-revision={currentPriceRevision ?? 'fallback'}
		>
			<SectionTitle
				id="market-prices"
				action={
					latestPriceChanges.length > 0 ? (
						<PriceShareActions
							changes={latestPriceChanges}
							changeDate={currentChangeDate}
							imageRef={shareRef}
						/>
					) : null
				}
			>
				{t('priceTitle')}
			</SectionTitle>
			<p className="mb-4 text-[11px] text-muted-foreground">
				{t('priceBoardMeta', {
					rises: latestPriceChanges.filter(c => c.direction === 'RISE').length,
					falls: latestPriceChanges.filter(c => c.direction === 'FALL').length,
					date: formatCalendarDate(currentChangeDate, locale) || '—'
				})}
			</p>
			{currentObservedAt ? (
				<p className="mb-4 text-[11px] text-muted-foreground">
					<MarketLocalUpdated capturedAt={currentObservedAt} />
				</p>
			) : null}
			<PriceColumns
				changes={latestPriceChanges}
				locale={locale}
				selectedPlayerId={seedPlayer?.id ?? null}
				onSelectPlayer={handleSelectPricePlayer}
			/>
			<div className="mt-4 border-t border-border/60 pt-3">
				<MarketPlayerLookupLauncher
					key={`${seedPlayer?.id ?? 'none'}:${latestPriceChanges.length > 0 ? 'compact' : 'open'}`}
					compact={latestPriceChanges.length > 0}
					initialOpen={initialOpen}
					seedPlayer={seedPlayer}
					onClearSeed={() => setSeedPlayer(null)}
					revision={marketRevision}
				/>
			</div>
		</section>
	)
}
