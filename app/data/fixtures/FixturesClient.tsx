'use client'

import { FdrMatrix } from '@/app/data/fixtures/_components/FdrMatrix'
import { MySquadFdrDesk } from '@/app/data/fixtures/_components/MySquadFdrDesk'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import type { MarketPulse } from '@/lib/graphql/operations/market'
import type { SquadLoadState, SquadPickSeed } from '@/lib/squad-picks'
import { buildSquadTeamExposure } from '@/lib/squad-picks'
import {
	isFixtureWindowResponse,
	type FixturePlanningFixture,
} from '@/lib/fixture-window'
import {
	buildFdrDeskModel,
	DEFAULT_FDR_HORIZON,
	FDR_HORIZONS,
	formatAvgFdr,
	formatAvgFdrOutOfFive,
	squadMatchKey,
	type FdrHorizon,
	type FdrReviewCandidate,
	type FdrTeamIdentity,
	type TeamFdrRow,
} from '@/lib/fixtures-fdr'
import { positionBadgeClass } from '@/lib/position-style'
import { cn, normalizePosition, type PositionCode } from '@/lib/utils'
import {
	TrendingDown,
	TrendingUp,
	Users,
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	startTransition,
	type ReactNode,
} from 'react'
import { toast } from 'sonner'

type PosFilter = 'ALL' | Exclude<PositionCode, 'UNK'>

/** Soft fill + ring — readable without shouting. */
const FDR_CELL: Record<number, string> = {
	1: 'border-success/40 bg-success/15 text-foreground',
	2: 'border-success/30 bg-success/10 text-foreground',
	3: 'border-border/70 bg-muted/40 text-foreground',
	4: 'border-warning/45 bg-warning/15 text-foreground',
	5: 'border-destructive/40 bg-destructive/15 text-foreground',
}

const FDR_DOT: Record<number, string> = {
	1: 'bg-success',
	2: 'bg-success/70',
	3: 'bg-muted-foreground/50',
	4: 'bg-warning',
	5: 'bg-destructive',
}

function SectionHead({
	id,
	title,
	hint,
	action,
}: {
	id: string
	title: string
	hint?: string
	action?: ReactNode
}) {
	return (
		<div className="mb-3 flex flex-col gap-2 border-b border-border/60 pb-2 sm:flex-row sm:items-end sm:justify-between">
			<div className="min-w-0">
				<h2
					id={id}
					className="eyebrow sm:text-caption"
				>
					{title}
				</h2>
				{hint ? (
					<p className="mt-0.5 text-caption text-muted-foreground">{hint}</p>
				) : null}
			</div>
			{action}
		</div>
	)
}

function GlanceRunCard({
	label,
	teamShort,
	avgLabel,
	run,
	easyCount,
	hardCount,
	tone,
	onClick,
	ariaLabel,
	easyHardLabel,
}: {
	label: string
	teamShort: string
	avgLabel: string
	run: TeamFdrRow['run']
	easyCount: number
	hardCount: number
	tone: 'easy' | 'hard'
	onClick: () => void
	ariaLabel: string
	easyHardLabel: string
}) {
	const isEasy = tone === 'easy'
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={ariaLabel}
			className={cn(
				'flex flex-col gap-2.5 rounded-lg border px-3 py-3 text-left transition-colors sm:px-3.5 sm:py-3.5',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				isEasy
					? 'border-success/45 bg-success/10 hover:border-success/65 hover:bg-success/15'
					: 'border-destructive/45 bg-destructive/10 hover:border-destructive/65 hover:bg-destructive/15',
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<span
					className={cn(
						'eyebrow',
						'text-foreground',
					)}
				>
					{label}
				</span>
				<span
					className={cn(
						'rounded-md border px-1.5 py-0.5 font-mono text-caption font-semibold tabular-nums',
						isEasy
							? 'border-success/35 bg-success/15 text-foreground'
							: 'border-destructive/35 bg-destructive/15 text-foreground',
					)}
				>
					{avgLabel}
				</span>
			</div>
			<div className="flex items-end justify-between gap-3">
				<span
					className={cn(
						'font-display text-2xl font-bold tracking-wide',
						isEasy ? 'text-success' : 'text-destructive',
					)}
				>
					{teamShort}
				</span>
				<div className="flex flex-wrap justify-end gap-1">
					{run.slice(0, 5).map(cell => (
						<span
							key={cell.fixtureId}
							className={cn(
								'size-2 rounded-full',
								FDR_DOT[cell.difficulty] ?? 'bg-muted-foreground',
							)}
							title={`GW${cell.eventId} · ${cell.opponentShortName} · FDR ${cell.difficulty}`}
						/>
					))}
				</div>
			</div>
			<p className="text-caption tabular-nums text-muted-foreground">
				<span className="font-medium text-success">{easyCount}</span>
				<span className="mx-1 text-border">/</span>
				<span className="font-medium text-destructive">{hardCount}</span>
				<span className="ml-1.5">{easyHardLabel}</span>
			</p>
		</button>
	)
}

function GlanceNextCard({
	label,
	teamShort,
	detail,
	fdr,
	tone,
	onClick,
	ariaLabel,
}: {
	label: string
	teamShort: string
	detail: string
	fdr: number
	tone: 'easy' | 'hard'
	onClick: () => void
	ariaLabel: string
}) {
	const isEasy = tone === 'easy'
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={ariaLabel}
			className={cn(
				'flex flex-col gap-2.5 rounded-lg border px-3 py-3 text-left transition-colors sm:px-3.5 sm:py-3.5',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				isEasy
					? 'border-success/45 bg-success/10 hover:border-success/65 hover:bg-success/15'
					: 'border-destructive/45 bg-destructive/10 hover:border-destructive/65 hover:bg-destructive/15',
			)}
		>
			<span
				className={cn(
					'eyebrow',
					'text-foreground',
				)}
			>
				{label}
			</span>
			<div className="flex items-end justify-between gap-3">
				<span
					className={cn(
						'font-display text-2xl font-bold tracking-wide',
						isEasy ? 'text-success' : 'text-destructive',
					)}
				>
					{teamShort}
				</span>
				<span
					className={cn(
						'inline-flex size-8 items-center justify-center rounded-md border font-mono text-sm font-bold tabular-nums',
						FDR_CELL[fdr],
					)}
				>
					{fdr}
				</span>
			</div>
			<p className="truncate text-caption text-muted-foreground">{detail}</p>
		</button>
	)
}

function ActionPlayerRow({
	player,
	inSquad,
}: {
	player: FdrReviewCandidate
	inSquad: boolean
}) {
	const t = useTranslations('Fixtures')
	const pos = normalizePosition(player.position)
	const next =
		player.nextOpponent != null
			? `${player.nextOpponent} ${player.nextHome ? 'H' : 'A'}`
			: '—'
	const deskLabel = t('openPlayerDesk')

	return (
		<li
			className={cn(
				'flex items-center gap-2 border-b border-border/40 px-3 py-2.5 last:border-b-0',
				inSquad && 'bg-primary/10',
			)}
		>
			<Badge
				className={cn(
					positionBadgeClass(pos),
					'shrink-0 px-1.5 py-0 text-label font-bold',
				)}
			>
				{pos === 'UNK' ? '—' : pos}
			</Badge>
			<div className="min-w-0 flex-1">
				<p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-medium leading-tight">
					{player.playerId > 0 ? (
						<Link
							prefetch={false}
							href={playerStatsHref({ p1: String(player.playerId) })}
							title={deskLabel}
							aria-label={`${player.webName} — ${deskLabel}`}
							className="truncate text-primary-ink underline decoration-primary/35 underline-offset-2 transition-colors hover:decoration-primary hover:text-primary"
						>
							{player.webName}
						</Link>
					) : (
						<span className="truncate">{player.webName}</span>
					)}
					{inSquad ? (
						<span className="shrink-0 rounded border border-primary/35 bg-primary/15 px-1 py-px text-micro font-semibold uppercase tracking-wide text-primary-ink">
							{t('badgeInSquad')}
						</span>
					) : null}
				</p>
				<p className="truncate text-caption text-muted-foreground">
					{player.teamShortNameResolved} · £{(player.price / 10).toFixed(1)}m ·{' '}
					{t('nextOpp', { opp: next })}
				</p>
			</div>
			<div className="shrink-0 text-right">
				<p className="font-mono text-sm font-semibold tabular-nums">
					{player.selectedByPercent.toFixed(1)}%
				</p>
				<p className="text-caption tabular-nums text-muted-foreground">
					FDR {formatAvgFdr(player.avgFdr)}
				</p>
			</div>
		</li>
	)
}

function ActionColumn({
	title,
	hint,
	icon,
	players,
	empty,
	tone,
	squadKeys,
}: {
	title: string
	hint: string
	icon: ReactNode
	players: FdrReviewCandidate[]
	empty: string
	tone: 'success' | 'default' | 'destructive' | 'warning'
	squadKeys: Set<string>
}) {
	const toneClass =
		tone === 'success'
			? 'text-success'
			: tone === 'destructive'
				? 'text-destructive'
				: tone === 'warning'
					? 'text-warning'
					: 'text-muted-foreground'

	return (
		<div className="min-w-0 rounded-lg border border-border/60 bg-muted/10">
			<div className="border-b border-border/50 px-3 py-2.5">
				<p
					className={cn(
						'mb-0.5 flex items-center gap-1.5 eyebrow sm:text-caption',
						toneClass,
					)}
				>
					{icon}
					{title}
					<span className="font-mono font-normal text-muted-foreground">
						({players.length})
					</span>
				</p>
				<p className="text-caption text-muted-foreground">{hint}</p>
			</div>
			{players.length === 0 ? (
				<p className="px-3 py-5 text-center text-xs text-muted-foreground">
					{empty}
				</p>
			) : (
				<ul>
					{players.map(p => {
						const inSquad = squadKeys.has(
							squadMatchKey(p.webName, p.teamShortNameResolved),
						)
						return (
							<ActionPlayerRow
								key={p.playerId}
								player={p}
								inSquad={inSquad}
							/>
						)
					})}
				</ul>
			)}
		</div>
	)
}

export default function FixturesClient({
	fromGw,
	initialHorizon = DEFAULT_FDR_HORIZON,
	initialFixturesByEvent,
	initialUnknownEventIds = [],
	marketPulse,
	knownTeams,
	mySquadKeys = [],
	mySquadPicks = [],
	hasLinkedEntry = false,
	squadState = hasLinkedEntry ? 'not-published' : 'unbound',
}: {
	fromGw: number
	initialHorizon?: FdrHorizon
	initialFixturesByEvent: Record<number, FixturePlanningFixture[]>
	initialUnknownEventIds?: number[]
	marketPulse: MarketPulse | null
	knownTeams: FdrTeamIdentity[]
	mySquadKeys?: string[]
	mySquadPicks?: SquadPickSeed[]
	hasLinkedEntry?: boolean
	squadState?: SquadLoadState
}) {
	const t = useTranslations('Fixtures')

	const [horizon, setHorizon] = useState<FdrHorizon>(initialHorizon)
	const [pendingHorizon, setPendingHorizon] = useState<FdrHorizon | null>(null)
	const [sort, setSort] = useState<'easiest' | 'hardest'>('easiest')
	const [posFilter, setPosFilter] = useState<PosFilter>('ALL')
	const [loading, setLoading] = useState(false)
	const [focusedTeamId, setFocusedTeamId] = useState<number | null>(null)

	const squadKeySet = useMemo(() => new Set(mySquadKeys), [mySquadKeys])
	const mySquadExposure = useMemo(
		() => buildSquadTeamExposure(mySquadPicks),
		[mySquadPicks],
	)

	const cacheRef = useRef(
		new Map<number, FixturePlanningFixture[]>(
			Object.entries(initialFixturesByEvent).map(([k, v]) => [Number(k), v]),
		),
	)
	const [fixturesByEvent, setFixturesByEvent] = useState(
		() =>
			new Map<number, FixturePlanningFixture[]>(
				Object.entries(initialFixturesByEvent).map(([k, v]) => [Number(k), v]),
		),
	)
	const [unknownEventIds, setUnknownEventIds] = useState(initialUnknownEventIds)
	const unknownEvents = useMemo(() => new Set(unknownEventIds), [unknownEventIds])
	const requestRef = useRef<AbortController | null>(null)
	const requestGenerationRef = useRef(0)

	const selectHorizon = useCallback(
		(next: FdrHorizon) => {
			if (next === horizon || next === pendingHorizon) return
			requestGenerationRef.current += 1
			requestRef.current?.abort()
			if (next < horizon) {
				setPendingHorizon(null)
				setLoading(false)
				startTransition(() => setHorizon(next))
				return
			}
			const targetEnd = Math.min(38, fromGw + next - 1)
			const missing = Array.from({ length: targetEnd - fromGw + 1 }, (_, index) => fromGw + index)
				.filter(eventId => !cacheRef.current.has(eventId) && !unknownEventIds.includes(eventId))
			if (missing.length === 0) {
				setPendingHorizon(null)
				startTransition(() => setHorizon(next))
				return
			}
			const first = missing[0]!
			const count = Math.min(5, missing.length)
			const generation = requestGenerationRef.current
			const controller = new AbortController()
			requestRef.current = controller
			setPendingHorizon(next)
			setLoading(true)
			void fetch(`/api/fixtures/window?fromGw=${first}&count=${count}`, {
				signal: controller.signal,
				headers: { accept: 'application/json' },
			})
				.then(async response => {
					const payload: unknown = await response.json().catch(() => null)
					if (!response.ok || !isFixtureWindowResponse(payload)) throw new Error('fixture window unavailable')
					if (generation !== requestGenerationRef.current) return
					for (const [rawEventId, fixtures] of Object.entries(payload.fixturesByEvent)) {
						cacheRef.current.set(Number(rawEventId), fixtures)
					}
					setUnknownEventIds(previous => Array.from(new Set([
						...previous.filter(id => !payload.unknownEventIds.includes(id)),
						...payload.unknownEventIds,
					])))
					setFixturesByEvent(new Map(cacheRef.current))
					setPendingHorizon(null)
					startTransition(() => setHorizon(next))
				})
				.catch(error => {
					if (controller.signal.aborted || generation !== requestGenerationRef.current) return
					console.error('[fixtures] horizon fetch failed:', error)
					setPendingHorizon(null)
					toast.error(t('loadFailed'))
				})
				.finally(() => {
					if (generation === requestGenerationRef.current) {
						setLoading(false)
						requestRef.current = null
					}
				})
		},
		[fromGw, horizon, pendingHorizon, t, unknownEventIds],
	)

	const model = useMemo(
		() =>
			buildFdrDeskModel(fixturesByEvent, {
				fromGw,
				horizon,
				marketPulse,
				knownTeams,
				unknownEvents,
			}),
		[fixturesByEvent, fromGw, horizon, knownTeams, marketPulse, unknownEvents],
	)

	const filterByPos = useCallback(
		(list: FdrReviewCandidate[]) => {
			if (posFilter === 'ALL') return list
			return list.filter(p => normalizePosition(p.position) === posFilter)
		},
		[posFilter],
	)

	const filteredCandidates = useMemo(
		() => ({
			differentialFavourable: filterByPos(
				model.candidates.differentialFavourable,
			),
			popularFavourable: filterByPos(
				model.candidates.popularFavourable,
			),
			popularDifficult: filterByPos(model.candidates.popularDifficult),
		}),
		[filterByPos, model.candidates],
	)

	const bucketEmpty = (rawLen: number, filteredLen: number) =>
		rawLen > 0 && filteredLen === 0
			? t('bucketEmptyFiltered')
			: t('bucketEmpty')

	const best = model.easiest[0]
	const worst = model.hardest[0]
	const softestNext = useMemo(() => {
		const withNext = model.teams.filter(row => row.nextFdr != null && row.run[0])
		if (withNext.length === 0) return null
		return withNext.toSorted((a, b) => {
			const d = (a.nextFdr ?? 99) - (b.nextFdr ?? 99)
			if (d !== 0) return d
			return a.teamShortName.localeCompare(b.teamShortName)
		})[0]
	}, [model.teams])

	const hardestNext = useMemo(() => {
		const withNext = model.teams.filter(row => row.nextFdr != null && row.run[0])
		if (withNext.length === 0) return null
		return withNext.toSorted((a, b) => {
			const d = (b.nextFdr ?? 0) - (a.nextFdr ?? 0)
			if (d !== 0) return d
			return a.teamShortName.localeCompare(b.teamShortName)
		})[0]
	}, [model.teams])

	const jumpToTeam = useCallback((teamId: number | undefined, nextSort: 'easiest' | 'hardest') => {
		if (teamId == null) return
		setSort(nextSort)
		setFocusedTeamId(teamId)
	}, [])

	useEffect(() => {
		if (focusedTeamId == null) return
		const el = document.getElementById(`fdr-team-${focusedTeamId}`)
		el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		const clearId = window.setTimeout(() => setFocusedTeamId(null), 2200)
		return () => window.clearTimeout(clearId)
	}, [focusedTeamId, sort])

	return (
		<>
			<RouteReadyMarker
				name="FIXTURES_WINDOW_READY"
				ready={!loading && pendingHorizon == null}
				readyKey={String(horizon)}
				audienceHint="public"
				goodMs={1_000}
				poorMs={1_500}
			/>
			<PageShell>
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<StatsPageHeader title={t('title')} />
				<p className="-mt-4 mb-6 max-w-2xl text-sm leading-6 text-muted-foreground">
					{t('pageIntro')}
				</p>

				{/* Controls */}
				<Card
					role="region"
					aria-label={t('controlsLabel')}
					className="mb-8 p-4 sm:p-5"
				>
					<div className="mb-3 border-b border-border/50 pb-2">
						<p className="eyebrow sm:text-caption">
							{t('controlsLabel')}
						</p>
						<p className="mt-0.5 text-caption text-muted-foreground">
							{t('controlsHint', {
								from: fromGw,
								to: Math.min(38, fromGw + horizon - 1),
							})}
						</p>
					</div>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="mb-1.5 text-caption font-medium text-muted-foreground">
								{t('horizonLabel')}
							</p>
							<div className="flex flex-wrap gap-1.5">
								{FDR_HORIZONS.map(h => (
									<button
									key={h}
									type="button"
									onClick={() => selectHorizon(h)}
										className={cn(
											'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
											horizon === h
												? 'border-success bg-success text-success-foreground'
												: 'border-border/70 bg-background text-muted-foreground hover:text-foreground',
										)}
									aria-pressed={horizon === h}
									aria-busy={pendingHorizon === h}
									>
										{t('horizonN', { n: h })}
									</button>
								))}
							</div>
						</div>
						<div>
										<p className="mb-1.5 text-caption font-medium text-muted-foreground">
								{t('sortLabel')}
							</p>
							<div className="flex flex-wrap gap-1.5">
								{(
									[
										['easiest', t('sortEasiest')],
										['hardest', t('sortHardest')],
									] as const
								).map(([id, label]) => (
									<button
										key={id}
										type="button"
										onClick={() => setSort(id)}
										className={cn(
											'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
											sort === id
												? 'border-success bg-success text-success-foreground'
												: 'border-border/70 bg-background text-muted-foreground hover:text-foreground',
										)}
										aria-pressed={sort === id}
									>
										{label}
									</button>
								))}
							</div>
						</div>
					</div>
					{loading ? (
						<p className="mt-3 text-xs text-muted-foreground">{t('loading')}</p>
					) : null}
				</Card>

				{/* Glance */}
				<section
					aria-label={t('glanceLabel')}
					className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5"
				>
					{best ? (
						<GlanceRunCard
							label={t('glanceBest')}
							teamShort={best.teamShortName}
							avgLabel={formatAvgFdrOutOfFive(best.avgFdr)}
							run={best.run}
							easyCount={best.easyCount}
							hardCount={best.hardCount}
							tone="easy"
							onClick={() => jumpToTeam(best.teamId, 'easiest')}
							ariaLabel={t('glanceJumpToTeam', {
								team: best.teamShortName,
							})}
							easyHardLabel={t('glanceEasyHard')}
						/>
					) : (
						<div className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
							—
						</div>
					)}
					{worst ? (
						<GlanceRunCard
							label={t('glanceWorst')}
							teamShort={worst.teamShortName}
							avgLabel={formatAvgFdrOutOfFive(worst.avgFdr)}
							run={worst.run}
							easyCount={worst.easyCount}
							hardCount={worst.hardCount}
							tone="hard"
							onClick={() => jumpToTeam(worst.teamId, 'hardest')}
							ariaLabel={t('glanceJumpToTeam', {
								team: worst.teamShortName,
							})}
							easyHardLabel={t('glanceEasyHard')}
						/>
					) : (
						<div className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
							—
						</div>
					)}
					{softestNext?.run[0] ? (
						<GlanceNextCard
							label={t('glanceSoftestNext')}
							teamShort={softestNext.teamShortName}
							fdr={softestNext.run[0].difficulty}
							detail={t('glanceNextDetail', {
								opp: `${softestNext.run[0].opponentShortName} (${softestNext.run[0].wasHome ? 'H' : 'A'})`,
							})}
							tone="easy"
							onClick={() =>
								jumpToTeam(softestNext.teamId, 'easiest')
							}
							ariaLabel={t('glanceJumpToTeam', {
								team: softestNext.teamShortName,
							})}
						/>
					) : (
						<div className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
							—
						</div>
					)}
					{hardestNext?.run[0] ? (
						<GlanceNextCard
							label={t('glanceHardestNext')}
							teamShort={hardestNext.teamShortName}
							fdr={hardestNext.run[0].difficulty}
							detail={t('glanceNextDetail', {
								opp: `${hardestNext.run[0].opponentShortName} (${hardestNext.run[0].wasHome ? 'H' : 'A'})`,
							})}
							tone="hard"
							onClick={() =>
								jumpToTeam(hardestNext.teamId, 'hardest')
							}
							ariaLabel={t('glanceJumpToTeam', {
								team: hardestNext.teamShortName,
							})}
						/>
					) : (
						<div className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
							—
						</div>
					)}
				</section>

				{/* My squad FDR */}
				<Card
					id="my-squad"
					role="region"
					aria-labelledby="my-squad-heading"
					className="mb-8 scroll-mt-36 p-4 sm:p-5"
				>
					<SectionHead
						id="my-squad-heading"
						title={t('mySquadTitle')}
					/>
					<MySquadFdrDesk
						picks={mySquadPicks}
						teams={model.teams}
						fromGw={fromGw}
						horizon={horizon}
						hasLinkedEntry={hasLinkedEntry}
						squadState={squadState}
					/>
				</Card>

				{/* FDR legend */}
				<p className="mb-4 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
					<span className="font-display font-semibold uppercase tracking-caps">
						{t('fdrLegend')}
					</span>
					{[1, 2, 3, 4, 5].map(d => (
						<span
							key={d}
							className={cn(
								'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-label font-semibold',
								FDR_CELL[d],
							)}
						>
							<span
								className={cn('size-1.5 rounded-full', FDR_DOT[d])}
								aria-hidden="true"
							/>
							{d}
						</span>
					))}
				</p>

				{/* Team FDR matrix */}
				<Card
					role="region"
					aria-labelledby="fdr-teams"
					className="mb-8 p-4 sm:p-5"
				>
					<SectionHead
						id="fdr-teams"
						title={t('teamsTitle')}
					/>
					<FdrMatrix
						teams={model.teams}
						sort={sort}
						fromGw={fromGw}
						horizon={horizon}
						mySquadExposure={mySquadExposure}
						focusedTeamId={focusedTeamId}
					/>
				</Card>

				{/* Neutral fixture review candidates */}
				<Card
					role="region"
					aria-labelledby="fdr-actions"
					className="mb-8 p-4 sm:p-5"
				>
					<SectionHead
						id="fdr-actions"
						title={t('actionsTitle')}
								hint={t('actionsHint')}
							/>

							<div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div>
									<p className="mb-1.5 text-caption font-medium text-muted-foreground">
								{t('actionsPosLabel')}
							</p>
							<div className="flex flex-wrap gap-1.5">
								{(
									[
										['ALL', t('actionsPosAll')],
										['GKP', 'GKP'],
										['DEF', 'DEF'],
										['MID', 'MID'],
										['FWD', 'FWD'],
									] as const
								).map(([id, label]) => (
									<button
										key={id}
										type="button"
										onClick={() => setPosFilter(id)}
										className={cn(
											'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
											posFilter === id
												? 'border-success bg-success text-success-foreground'
												: 'border-border/70 bg-background text-muted-foreground hover:text-foreground',
										)}
										aria-pressed={posFilter === id}
									>
										{label}
									</button>
								))}
							</div>
						</div>
						<p className="max-w-sm text-caption leading-4 text-muted-foreground">
							{squadKeySet.size > 0 ? (
								t('actionsMySquadNote', { gw: fromGw })
							) : squadState === 'unavailable' ? (
								t('actionsMySquadLoadFailed')
							) : squadState === 'not-published' ? (
								t('mySquadNotPublished')
							) : (
								<>
									{t('actionsMySquadEmpty')}{' '}
									<Link
										href="/onboarding/bind-entry"
										className="font-medium text-primary-ink underline-offset-2 hover:underline"
									>
										{t('actionsBindCta')}
									</Link>
								</>
							)}
						</p>
					</div>

					<div className="grid gap-3 lg:grid-cols-3">
						<ActionColumn
							title={t('bucketDifferentialFavourable')}
							hint={t('bucketDifferentialFavourableHint')}
							icon={<TrendingUp className="size-3.5" aria-hidden="true" />}
							players={filteredCandidates.differentialFavourable}
							empty={bucketEmpty(
								model.candidates.differentialFavourable.length,
								filteredCandidates.differentialFavourable.length,
							)}
							tone="success"
							squadKeys={squadKeySet}
						/>
						<ActionColumn
							title={t('bucketPopularFavourable')}
							hint={t('bucketPopularFavourableHint')}
							icon={<Users className="size-3.5" aria-hidden="true" />}
							players={filteredCandidates.popularFavourable}
							empty={bucketEmpty(
								model.candidates.popularFavourable.length,
								filteredCandidates.popularFavourable.length,
							)}
							tone="default"
							squadKeys={squadKeySet}
						/>
						<ActionColumn
							title={t('bucketPopularDifficult')}
							hint={t('bucketPopularDifficultHint')}
							icon={<TrendingDown className="size-3.5" aria-hidden="true" />}
							players={filteredCandidates.popularDifficult}
							empty={bucketEmpty(
								model.candidates.popularDifficult.length,
								filteredCandidates.popularDifficult.length,
							)}
							tone="destructive"
							squadKeys={squadKeySet}
						/>
					</div>
				</Card>
			</div>
			</PageShell>
		</>
	)
}
