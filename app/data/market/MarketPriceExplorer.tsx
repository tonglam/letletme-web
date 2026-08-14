'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '@/lib/calendar-date'
import type {
	MarketPlayer,
	MarketPriceChange
} from '@/lib/graphql/operations/market'
import type { PlayerDirectoryItem } from '@/lib/graphql/operations/players'
import { markRouteReadyStart } from '@/lib/analytics/route-navigation'
import { copyTextToClipboard } from '@/app/live/points/_lib/live-points-share'
import { ShareTextFallback } from '@/components/share/ShareTextFallback'
import {
	buildMarketShareUrl,
	formatPriceMovementShareText
} from '@/app/data/market/_lib/market-price-share'
import { marketRevisionParam } from '@/lib/market-client'
import { Check, Copy, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
	lazy,
	Suspense,
	useCallback,
	useMemo,
	useState,
	type ComponentProps,
	type ReactNode
} from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { positionBadgeClass } from '@/lib/position-style'
import { shortMarketPosition } from '@/lib/market'

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

function PositionBadge({ player }: { player: MarketPlayer }) {
	const position = shortMarketPosition(player.position)
	return (
		<Badge className={cn(positionBadgeClass(position), 'shrink-0 text-[10px]')}>
			{position}
		</Badge>
	)
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
		<Suspense fallback={<div className="min-h-32" aria-hidden="true" />}>
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
				<label htmlFor="market-player-search" className="mb-2 block text-sm font-semibold">
					{t('searchPlayers')}
				</label>
				<Input
					id="market-player-search"
					role="combobox"
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
					aria-controls="market-player-results"
					aria-autocomplete="list"
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
				<Search className="size-3.5" aria-hidden="true" />
				{t('lookupAnotherPlayer')}
			</Button>
		</div>
	)
}

function PriceShareActions({
	changes,
	changeDate
}: {
	changes: MarketPriceChange[]
	changeDate: string | null
}) {
	const t = useTranslations('Market')
	const [copied, setCopied] = useState(false)
	const [manualShareText, setManualShareText] = useState<string | null>(null)

	const handleCopyShare = useCallback(async () => {
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
		const text = formatPriceMovementShareText({
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
	}, [changeDate, changes, t])

	return (
		<div className="flex shrink-0 flex-col items-end gap-1.5">
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="h-8 gap-1.5 text-xs"
				onClick={() => void handleCopyShare()}
				aria-label={t('shareCopy')}
			>
				{copied ? (
					<Check className="size-3.5 text-primary-ink" aria-hidden="true" />
				) : (
					<Copy className="size-3.5" aria-hidden="true" />
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
				<span className="ml-1.5 font-mono text-muted-foreground">({items.length})</span>
			</p>
			{items.length === 0 ? (
				<EmptyHint>{t('noData')}</EmptyHint>
			) : (
				<ul className="w-full">
					{items.map((change, index) => {
						const selected = change.player.playerId === selectedPlayerId
						return (
							<li key={`${change.player.playerId}-${change.changeDate}-${index}`}>
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
										aria-label={t('openPriceHistory', { name: change.player.webName })}
									/>
									<div className="pointer-events-none relative z-[1] flex w-full items-center gap-2.5 group-hover:bg-background/60">
										<PositionBadge player={change.player} />
										<span className="min-w-0 flex-1">
											<a
												href={playerStatsHref({
													p1: String(change.player.playerId),
													localePathPrefix: locale === 'en' ? '' : `/${locale}`
												})}
												className="pointer-events-auto block truncate text-sm font-medium leading-tight text-primary-ink underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
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
												{rising ? '+' : '−'}£{(Math.abs(change.change) / 10).toFixed(1)}m
											</span>
											<span className="block text-[10px] tabular-nums text-muted-foreground">
												£{(change.oldPrice / 10).toFixed(1)}m → £{(change.newPrice / 10).toFixed(1)}m
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
	locale,
	revision,
	initialOpen = false
}: {
	changes: MarketPriceChange[]
	changeDate: string | null
	locale: string
	revision: string | null
	initialOpen?: boolean
}) {
	const t = useTranslations('Market')
	const [seedPlayer, setSeedPlayer] = useState<PlayerDirectoryItem | null>(null)
	const latestPriceChanges = useMemo(() => changes, [changes])
	const handleSelectPricePlayer = useCallback(
		(player: MarketPlayer) => {
			markRouteReadyStart(
				window.location.pathname,
				performance.now(),
				`${player.playerId}:${marketRevisionParam(revision)}`
			)
			setSeedPlayer(marketPlayerToDirectory(player))
		},
		[revision]
	)

	return (
		<section
			aria-labelledby="market-prices"
			className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm sm:p-5"
		>
			<SectionTitle
				id="market-prices"
				action={
					latestPriceChanges.length > 0 ? (
						<PriceShareActions
							changes={latestPriceChanges}
							changeDate={changeDate}
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
					date: formatCalendarDate(changeDate, locale) || '—'
				})}
			</p>
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
					revision={revision}
				/>
			</div>
		</section>
	)
}
