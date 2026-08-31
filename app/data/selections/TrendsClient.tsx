'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowRight, RefreshCw, Sparkles } from 'lucide-react'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import PageShell from '@/components/layout/PageShell'
import { ShareActions } from '@/components/share/ShareActions'
import {
	SquadPitch,
	type SquadPitchPlayer
} from '@/components/squad-pitch/SquadPitch'
import {
	StatsPageHeader,
	StatsTabsShell
} from '@/components/stats/StatsSurfaces'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	reportBrowserPerformanceMetric,
	resolveAudienceHint
} from '@/lib/analytics/client-vitals'
import { markRouteReadyStart } from '@/lib/analytics/route-navigation'
import {
	isTrendCohortReady,
	mergeVisibleTrendCohorts
} from './_lib/trend-cohorts'
import { buildTrendUrl } from './_lib/trend-url'
import { buildTrendTemplate } from './_lib/trend-template'
import {
	resolveTrendAvailabilityState,
	trendAvailabilityLabelKey,
	trendAvailabilityMessageKey
} from './_lib/trend-availability'
import type {
	TrendAccess,
	TrendCohort,
	TrendDesk,
	TrendDeskRow,
	TrendDeskSection,
	TrendCatalogState
} from '@/lib/graphql/operations/trends'
import { playerStatsHref } from '@/app/data/player-stats/_lib/player-stats-url'
import { resolveSquadTeamCode } from '@/lib/squad-pitch-team-codes'
import { cn } from '@/lib/utils'

type Props = {
	publicCohorts: TrendCohort[]
	publicCatalogState: TrendCatalogState
	myCohorts: TrendCohort[]
	canLoadMine: boolean
	myCohortsLoadFailed: boolean
	publicCohortsLoadFailed: boolean
	initialDesk: TrendDesk | null
	initialAccess: TrendAccess
	initialCohortId: string | null
	initialEventId: number
	initialDeskError?: boolean
}

const TOP_RANK_LIMIT = 12
const PERSONAL_SQUAD_SIZE = 15

type TrendView =
	'template' | 'ownership' | 'captaincy' | 'transfers' | 'squad' | 'other'

type TrendViewDefinition = {
	id: TrendView
	label: string
	capabilities: readonly string[]
}

type LabelKey =
	| 'ownershipLabel'
	| 'effectiveOwnershipLabel'
	| 'captaincyLabel'
	| 'viceCaptaincyLabel'
	| 'transfersLabel'
	| 'personalExposureLabel'
	| 'templateLabel'
	| 'unknownCapability'

function sectionDenominator(
	section: TrendDesk['sections'][number]
): number | null {
	const denominator = section.evidenceContext.denominator
	return denominator != null && Number.isFinite(denominator) && denominator > 0
		? denominator
		: null
}

function denominatorSummary(sections: TrendDesk['sections']) {
	const denominators = sections
		.map(sectionDenominator)
		.filter((value): value is number => value !== null)
	const uniqueDenominators = Array.from(new Set(denominators))
	const everySectionHasDenominator =
		sections.length > 0 && denominators.length === sections.length
	const shared =
		everySectionHasDenominator && uniqueDenominators.length === 1
			? denominators[0]
			: null
	return {
		shared,
		mismatch: uniqueDenominators.length > 1,
		missing: sections.length > 0 && !everySectionHasDenominator
	}
}

const labelKeys: Record<string, LabelKey> = {
	OWNERSHIP: 'ownershipLabel',
	EFFECTIVE_OWNERSHIP: 'effectiveOwnershipLabel',
	CAPTAINCY: 'captaincyLabel',
	VICE_CAPTAINCY: 'viceCaptaincyLabel',
	TRANSFERS: 'transfersLabel',
	PERSONAL_EXPOSURE: 'personalExposureLabel',
	TEMPLATE: 'templateLabel'
}

function formatNumber(
	value: number | null | undefined,
	locale: string
): string {
	if (value == null || !Number.isFinite(value)) return '—'
	return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
		value
	)
}

function formatMetric(
	value: number | null | undefined,
	locale: string
): string {
	if (value == null || !Number.isFinite(value)) return '—'
	return `${new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1
	}).format(value)}%`
}

function readPerformanceNow(): number {
	return performance.now()
}

function TrendStatusPill({ label, state }: { label: string; state: string }) {
	const tone =
		state === 'AVAILABLE'
			? 'border-primary/25 bg-primary/10 text-primary-ink'
			: state === 'PARTIAL'
				? 'border-warning/30 bg-warning/10 text-warning'
				: state === 'UNAVAILABLE'
					? 'border-destructive/25 bg-destructive/10 text-destructive'
					: 'border-border/70 bg-muted/50 text-muted-foreground'
	return (
		<span
			className={cn(
				'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold',
				tone
			)}
		>
			<span
				aria-hidden="true"
				className="size-1.5 rounded-full bg-current"
			/>
			{label}
		</span>
	)
}

function signalBarClass(capability: string): string {
	if (capability === 'CAPTAINCY' || capability === 'VICE_CAPTAINCY') {
		return 'bg-pink'
	}
	if (capability === 'TRANSFERS') return 'bg-warning'
	if (capability === 'EFFECTIVE_OWNERSHIP') return 'bg-chart-3'
	return 'bg-primary'
}

function SignalRow({
	row,
	rank,
	maxMetric,
	locale,
	barClass
}: {
	row: TrendDeskRow
	rank: number
	maxMetric: number
	locale: string
	barClass: string
}) {
	const metric = row.percentage ?? row.count
	const width =
		metric != null && Number.isFinite(metric) && maxMetric > 0
			? Math.max(5, Math.min(100, (metric / maxMetric) * 100))
			: 5
	return (
		<li className="group/row grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border/50 py-2.5 last:border-b-0 sm:gap-3">
			<span className="font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
				{String(rank).padStart(2, '0')}
			</span>
			<div className="min-w-0">
				<div className="flex min-w-0 items-baseline gap-2">
					<Link
						href={`/explore/player-stats?p1=${row.elementId}`}
						prefetch={false}
						className="min-w-0 truncate whitespace-nowrap font-display text-sm font-bold tracking-tight text-primary-ink underline decoration-primary/35 underline-offset-4 transition-colors hover:decoration-primary"
					>
						{row.playerName}
					</Link>
					<span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						{row.teamShortName}
					</span>
				</div>
				<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
					<span
						aria-hidden="true"
						className={cn(
							'block h-full rounded-full transition-[width] duration-500 ease-out',
							barClass
						)}
						style={{ width: `${width}%` }}
					/>
				</div>
			</div>
			<span className="shrink-0 text-right font-display text-sm font-bold tabular-nums tracking-tight text-foreground">
				{row.percentage == null
					? formatNumber(row.count, locale)
					: formatMetric(row.percentage, locale)}
			</span>
		</li>
	)
}

function SignalCard({
	section,
	eventId,
	locale,
	t,
	onRetry
}: {
	section: TrendDeskSection
	eventId: number
	locale: string
	t: ReturnType<typeof useTranslations<'Selections'>>
	onRetry: () => void
}) {
	const availability = resolveTrendAvailabilityState(section)
	const title = t(labelKeys[section.capability] ?? 'unknownCapability')
	const personalExposure = section.capability === 'PERSONAL_EXPOSURE'
	const rows = section.rows
	const displayRows = rows
		? personalExposure
			? rows
			: rows.slice(0, TOP_RANK_LIMIT)
		: null
	const maxMetric = Math.max(
		1,
		...(displayRows ?? [])
			.map(row => row.percentage ?? row.count)
			.filter(
				(value): value is number => value != null && Number.isFinite(value)
			)
	)
	const denominator = sectionDenominator(section)
	const sectionId = `trend-signal-${section.capability.toLowerCase()}`
	const status =
		availability !== 'AVAILABLE' ? (
			<TrendStatusPill
				label={t(trendAvailabilityLabelKey(availability))}
				state={availability}
			/>
		) : null

	return (
		<article
			aria-labelledby={sectionId}
			className={cn(
				'rounded-lg border border-border/80 bg-card p-4 shadow-sm sm:p-5',
				personalExposure && 'lg:col-span-2'
			)}
		>
			<div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
				<h3
					id={sectionId}
					className="font-display text-xl font-bold tracking-tight text-foreground"
				>
					{title}
				</h3>
				{status}
			</div>

			{rows !== null ? (
				<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
					<span>
						{personalExposure
							? t('squadPicks', {
									shown: rows.length,
									expected: PERSONAL_SQUAD_SIZE
								})
							: t('topRanked', { count: TOP_RANK_LIMIT })}
					</span>
					<span aria-hidden="true">·</span>
					<span>
						{denominator === null
							? t('fieldSizeUnavailable')
							: t('fieldSize', { count: denominator })}
					</span>
				</div>
			) : null}

			{rows === null ? (
				<div className="mt-4 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4">
					<p className="text-sm leading-relaxed text-muted-foreground">
						{t(trendAvailabilityMessageKey(availability), {
							gameweek: eventId
						})}
					</p>
					{availability === 'UNAVAILABLE' ? (
						<button
							type="button"
							className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border/80 bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={onRetry}
						>
							<RefreshCw
								className="size-3.5"
								aria-hidden="true"
							/>
							{t('retry')}
						</button>
					) : null}
				</div>
			) : rows.length === 0 ? (
				<div className="mt-4 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
					{t(
						availability === 'CONFIRMED_EMPTY'
							? 'confirmedEmpty'
							: availability === 'STALE'
								? 'staleData'
								: availability === 'PARTIAL'
									? 'partialData'
									: 'noData'
					)}
				</div>
			) : (
				<ol
					className={cn('mt-3')}
					aria-label={title}
				>
					{displayRows?.map((row, index) => (
						<SignalRow
							key={row.elementId}
							row={row}
							rank={index + 1}
							maxMetric={maxMetric}
							locale={locale}
							barClass={signalBarClass(section.capability)}
						/>
					))}
				</ol>
			)}
		</article>
	)
}

function pitchPosition(value: number): SquadPitchPlayer['position'] {
	if (value === 1) return 'GKP'
	if (value === 2) return 'DEF'
	if (value === 4) return 'FWD'
	return 'MID'
}

function TrendSquadPitch({
	section,
	eventId,
	t
}: {
	section: TrendDeskSection
	eventId: number
	t: ReturnType<typeof useTranslations<'Selections'>>
}) {
	const rows = section.rows ?? []
	const denominator = sectionDenominator(section)
	const players: SquadPitchPlayer[] = rows.map(row => {
		const teamCode = resolveSquadTeamCode(row.teamShortName)
		const score = row.percentage ?? row.count
		return {
			id: String(row.elementId),
			webName: row.playerName,
			score,
			scoreLabel:
				row.percentage == null
					? formatNumber(row.count, 'en-US')
					: formatMetric(row.percentage, 'en-US'),
			scoreTone: 'neutral',
			href: playerStatsHref({ p1: String(row.elementId) }),
			position: pitchPosition(row.playerPosition),
			...(teamCode
				? { teamCode }
				: { teamBadgeLabel: row.teamShortName.trim().toUpperCase() })
		}
	})

	return (
		<div className="overflow-hidden rounded-lg border border-border/80 bg-[#210025] shadow-sm">
			<SquadPitch
				players={players}
				labels={{
					formation: t('personalExposureLabel'),
					positions: { GKP: 'GKP', DEF: 'DEF', MID: 'MID', FWD: 'FWD' },
					captain: 'C',
					viceCaptain: 'V',
					total: t('personalExposureLabel'),
					playerDetails: player => player.webName
				}}
				showHeader
				title={t('personalExposureLabel')}
				eyebrow={`GW${eventId}`}
				headerStats={{
					eyebrow: `GW${eventId}`,
					details: [
						{
							label: t('glanceField'),
							value:
								denominator === null ? '—' : formatNumber(denominator, 'en-US'),
							accent: true
						}
					]
				}}
				className="rounded-none border-0 shadow-none"
			/>
		</div>
	)
}

function TrendTemplatePitch({
	section,
	eventId,
	t
}: {
	section: TrendDeskSection
	eventId: number
	t: ReturnType<typeof useTranslations<'Selections'>>
}) {
	const template = buildTrendTemplate(section.rows)
	if (!template) return null
	const denominator = sectionDenominator(section)
	const toPitchPlayer = (row: TrendDeskRow): SquadPitchPlayer => {
		const teamCode = resolveSquadTeamCode(row.teamShortName)
		return {
			id: String(row.elementId),
			webName: row.playerName,
			score: row.percentage ?? row.count,
			scoreLabel:
				row.percentage == null
					? formatNumber(row.count, 'en-US')
					: formatMetric(row.percentage, 'en-US'),
			scoreTone: 'neutral',
			href: playerStatsHref({ p1: String(row.elementId) }),
			position: pitchPosition(row.playerPosition),
			isCaptain: row.isCaptain === true,
			isViceCaptain: row.isViceCaptain === true,
			...(teamCode
				? { teamCode }
				: { teamBadgeLabel: row.teamShortName.trim().toUpperCase() })
		}
	}

	return (
		<div className="overflow-hidden rounded-lg border border-border/80 bg-[#210025] shadow-sm">
			<SquadPitch
				players={template.starters.map(toPitchPlayer)}
				benchPlayers={template.bench.map(toPitchPlayer)}
				benchTitle={t('templateBench')}
				labels={{
					formation: t('templateLabel'),
					positions: { GKP: 'GKP', DEF: 'DEF', MID: 'MID', FWD: 'FWD' },
					captain: t('roleCaptain'),
					viceCaptain: t('roleVice'),
					total: t('templateOwnership'),
					playerDetails: player => player.webName
				}}
				showHeader
				title={t('templateTitle')}
				eyebrow={`GW${eventId}`}
				headerStats={{
					eyebrow: `GW${eventId} · ${t('templatePlayers')}`,
					details: [
						{
							label: t('templateFormation'),
							value: template.formation,
							accent: true
						},
						{
							label: t('glanceField'),
							value:
								denominator === null ? '—' : formatNumber(denominator, 'en-US')
						}
					]
				}}
				className="rounded-none border-0 shadow-none"
			/>
		</div>
	)
}

export default function TrendsClient({
	publicCohorts,
	publicCatalogState,
	myCohorts,
	canLoadMine,
	myCohortsLoadFailed,
	publicCohortsLoadFailed,
	initialDesk,
	initialAccess,
	initialCohortId,
	initialEventId,
	initialDeskError = false
}: Props) {
	const t = useTranslations('Selections')
	const [access, setAccess] = useState<TrendAccess>(initialAccess)
	const [cohortId, setCohortId] = useState(initialCohortId ?? '')
	const [eventId, setEventId] = useState(initialEventId)
	const [committed, setCommitted] = useState<TrendDesk | null>(initialDesk)
	const [activeView, setActiveView] = useState<TrendView>('template')
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(
		initialDeskError ? t('statsError') : null
	)
	const shareRef = useRef<HTMLDivElement | null>(null)
	const cache = useRef(new Map<string, TrendDesk>())
	const inFlight = useRef(
		new Map<string, { controller: AbortController; generation: number }>()
	)
	const generation = useRef(0)
	const pendingSwitch = useRef<{ key: string; startedAt: number } | null>(null)

	useEffect(() => {
		if (initialDesk)
			cache.current.set(
				`${initialAccess}:${initialDesk.cohort.id}:${initialDesk.eventId}:${initialDesk.cohort.revision ?? ''}`,
				initialDesk
			)
	}, [initialAccess, initialDesk])

	const cohorts = useMemo(
		() => mergeVisibleTrendCohorts(myCohorts, publicCohorts),
		[myCohorts, publicCohorts]
	)
	const selected =
		cohorts.find(item => item.id === cohortId && isTrendCohortReady(item)) ??
		cohorts.find(isTrendCohortReady) ??
		null
	const groupedCohorts = useMemo(
		() => ({
			mine: cohorts.filter(item => item.access === 'MINE'),
			public: cohorts.filter(item => item.access === 'PUBLIC')
		}),
		[cohorts]
	)
	const scopeCohorts =
		access === 'MINE' ? groupedCohorts.mine : groupedCohorts.public
	const readyScopeCohorts = scopeCohorts.filter(isTrendCohortReady)
	const audienceHint =
		typeof document === 'undefined'
			? ('unknown' as const)
			: resolveAudienceHint()
	const denominators = useMemo(
		() => denominatorSummary(committed?.sections ?? []),
		[committed]
	)
	const viewDefinitions = useMemo<TrendViewDefinition[]>(() => {
		const base: TrendViewDefinition[] = [
			{
				id: 'template',
				label: t('templateLabel'),
				capabilities: ['TEMPLATE']
			},
			{
				id: 'ownership',
				label: t('ownershipLabel'),
				capabilities: ['OWNERSHIP', 'EFFECTIVE_OWNERSHIP']
			},
			{
				id: 'captaincy',
				label: t('captaincyLabel'),
				capabilities: ['CAPTAINCY', 'VICE_CAPTAINCY']
			},
			{
				id: 'transfers',
				label: t('transfersLabel'),
				capabilities: ['TRANSFERS']
			},
			{
				id: 'squad',
				label: t('personalExposureLabel'),
				capabilities: ['PERSONAL_EXPOSURE']
			}
		]
		const knownCapabilities = new Set(base.flatMap(view => view.capabilities))
		const otherCapabilities = Array.from(
			new Set(
				(committed?.sections ?? [])
					.map(section => section.capability)
					.filter(capability => !knownCapabilities.has(capability))
			)
		)
		return otherCapabilities.length > 0
			? [
					...base,
					{
						id: 'other',
						label: t('unknownCapability'),
						capabilities: otherCapabilities
					}
				]
			: base
	}, [committed, t])
	const availableViews = useMemo(
		() =>
			viewDefinitions.filter(view =>
				(committed?.sections ?? []).some(section =>
					view.capabilities.includes(section.capability)
				)
			),
		[committed, viewDefinitions]
	)
	const visibleView =
		availableViews.find(view => view.id === activeView) ??
		availableViews[0] ??
		null

	useEffect(() => {
		if (visibleView && visibleView.id !== activeView) {
			setActiveView(visibleView.id)
		}
	}, [activeView, visibleView])

	function updateUrl(
		nextAccess: TrendAccess,
		nextCohort: string,
		nextEvent: number,
		mode: 'push' | 'replace' = 'push'
	) {
		const url = buildTrendUrl(
			window.location.href,
			nextAccess,
			nextCohort,
			nextEvent
		)
		window.history[mode === 'replace' ? 'replaceState' : 'pushState'](
			{ access: nextAccess, cohort: nextCohort, gw: nextEvent },
			'',
			`${url.pathname}${url.search}${url.hash}`
		)
	}

	useEffect(() => {
		if (!initialCohortId) return
		const currentUrl = new URL(window.location.href)
		const selectedUrl = buildTrendUrl(
			currentUrl.href,
			initialAccess,
			initialCohortId,
			initialEventId
		)
		if (
			`${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}` ===
			`${selectedUrl.pathname}${selectedUrl.search}${selectedUrl.hash}`
		)
			return
		updateUrl(initialAccess, initialCohortId, initialEventId, 'replace')
	}, [initialAccess, initialCohortId, initialEventId])

	async function select(
		nextCohort: string,
		nextEvent: number,
		pushHistory = true,
		bypassCache = false
	) {
		const knownCohort = cohorts.find(item => item.id === nextCohort)
		if (!knownCohort || !isTrendCohortReady(knownCohort)) return
		const nextAccess = knownCohort.access
		const key = `${nextAccess}:${nextCohort}:${nextEvent}:${knownCohort.revision ?? ''}`
		setAccess(nextAccess)
		setCohortId(nextCohort)
		setEventId(nextEvent)
		setError(null)
		if (pushHistory) updateUrl(nextAccess, nextCohort, nextEvent)
		if (bypassCache) cache.current.delete(key)
		const cached = bypassCache ? undefined : cache.current.get(key)
		if (cached) {
			inFlight.current.forEach(request => request.controller.abort())
			inFlight.current.clear()
			++generation.current
			setPending(false)
			const startedAt = readPerformanceNow()
			markRouteReadyStart(window.location.pathname, startedAt, key)
			pendingSwitch.current = { key, startedAt }
			startTransition(() => setCommitted(cached))
			return
		}
		if (inFlight.current.has(key)) return
		inFlight.current.forEach(request => request.controller.abort())
		const requestGeneration = ++generation.current
		const controller = new AbortController()
		inFlight.current.set(key, { controller, generation: requestGeneration })
		setPending(true)
		const startedAt = readPerformanceNow()
		markRouteReadyStart(window.location.pathname, startedAt, key)
		pendingSwitch.current = { key, startedAt }
		try {
			const endpoint =
				nextAccess === 'MINE'
					? '/api/trends/my-desk'
					: '/api/trends/public-desk'
			const response = await fetch(
				`${endpoint}?cohortId=${encodeURIComponent(nextCohort)}&eventId=${nextEvent}&limit=12`,
				{ signal: controller.signal, cache: 'no-store' }
			)
			if (!response.ok) throw new Error(`HTTP ${response.status}`)
			const payload = (await response.json()) as
				{ trendCohortSnapshot?: TrendDesk } | TrendDesk
			const desk: TrendDesk | null =
				'trendCohortSnapshot' in payload
					? ((payload as { trendCohortSnapshot?: TrendDesk })
							.trendCohortSnapshot ?? null)
					: (payload as TrendDesk)
			if (requestGeneration !== generation.current) return
			if (!desk) throw new Error('trend desk unavailable')
			cache.current.set(key, desk)
			startTransition(() => setCommitted(desk))
		} catch (requestError) {
			if (
				requestError instanceof DOMException &&
				requestError.name === 'AbortError'
			)
				return
			if (requestGeneration === generation.current) {
				// The URL and selectors optimistically move while the request is in
				// flight. On failure, restore the last rendered desk so controls never
				// name one cohort while the metrics visibly belong to another.
				if (committed) {
					setAccess(committed.cohort.access)
					setCohortId(committed.cohort.id)
					setEventId(committed.eventId)
					updateUrl(
						committed.cohort.access,
						committed.cohort.id,
						committed.eventId,
						'replace'
					)
				}
				setError(t('statsError'))
			}
		} finally {
			inFlight.current.delete(key)
			if (requestGeneration === generation.current) setPending(false)
		}
	}

	function selectScope(nextAccess: TrendAccess) {
		if (nextAccess === access) return
		const next = (
			nextAccess === 'MINE' ? groupedCohorts.mine : groupedCohorts.public
		).find(isTrendCohortReady)
		if (next) void select(next.id, eventId)
	}

	useEffect(() => {
		if (!committed) return
		const key = `${access}:${committed.cohort.id}:${committed.eventId}:${committed.cohort.revision ?? ''}`
		if (pendingSwitch.current?.key !== key) return
		const switchMs = performance.now() - pendingSwitch.current.startedAt
		pendingSwitch.current = null
		reportBrowserPerformanceMetric(
			{
				name: 'TRENDS_SWITCH_READY',
				value: switchMs,
				delta: switchMs,
				rating:
					switchMs <= 1000
						? 'good'
						: switchMs <= 1500
							? 'needs-improvement'
							: 'poor',
				metricId: `trends-switch-${Date.now()}`,
				page: window.location.pathname,
				audienceHint: resolveAudienceHint()
			},
			{ always: true }
		)
	}, [access, committed])

	const shareText = useMemo(() => {
		if (!committed) return ''

		const sampleSize =
			committed.sections.find(
				section => section.evidenceContext.sampleSize != null
			)?.evidenceContext.sampleSize ?? '?'
		const cohortScope = committed.cohort.exact
			? denominators.shared !== null
				? t('exactCompetitionWithCount', { count: denominators.shared })
				: t('exactCompetition')
			: t('sampledCohort', { count: sampleSize })

		const lines = [
			`# ${committed.cohort.displayName} · GW${committed.eventId}`,
			cohortScope,
			''
		]
		for (const section of committed.sections) {
			lines.push(t(labelKeys[section.capability] ?? 'title'))
			if (!section.rows || section.rows.length === 0) {
				lines.push(t('noData'))
			} else {
				lines.push(
					section.capability === 'TEMPLATE'
						? t('templatePlayers')
						: section.capability === 'PERSONAL_EXPOSURE'
							? t('squadPicks', {
									shown: section.rows.length,
									expected: PERSONAL_SQUAD_SIZE
								})
							: t('topRanked', { count: TOP_RANK_LIMIT })
				)
				const rows =
					section.capability === 'TEMPLATE' ||
					section.capability === 'PERSONAL_EXPOSURE'
						? section.rows
						: section.rows.slice(0, TOP_RANK_LIMIT)
				for (const row of rows) {
					const role = row.isCaptain
						? ` · ${t('roleCaptain')}`
						: row.isViceCaptain
							? ` · ${t('roleVice')}`
							: ''
					lines.push(
						`- ${row.playerName} ${row.teamShortName}${role} · ${row.percentage == null ? '—' : `${row.percentage.toFixed(1)}%`} · ${row.count}`
					)
				}
			}
			lines.push('')
		}
		lines.push(
			typeof window !== 'undefined'
				? buildTrendUrl(
						window.location.href,
						access,
						committed.cohort.id,
						committed.eventId
					).href
				: 'https://letletme.top/explore/selections'
		)
		return lines.join('\n')
	}, [access, committed, denominators.shared, t])

	useEffect(() => {
		const onPopState = () => {
			const params = new URLSearchParams(window.location.search)
			const nextCohort =
				params.get('cohort') ?? params.get('tournament') ?? cohortId
			const nextEvent = Number(params.get('gw') ?? eventId)
			if (nextCohort && Number.isInteger(nextEvent)) {
				const normalizedCohort = /^(?:competition|custom|rank-sample):/i.test(
					nextCohort
				)
					? nextCohort
					: `competition:${nextCohort}`
				void select(normalizedCohort, nextEvent, false)
			}
		}
		window.addEventListener('popstate', onPopState)
		return () => window.removeEventListener('popstate', onPopState)
		// This handler intentionally observes the initial browser history only.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const boardError = !committed && error
	const showEmptyBoard = !committed && !error

	return (
		<>
			<RouteReadyMarker
				name="TRENDS_CATALOG_READY"
				ready={
					cohorts.length > 0 &&
					(access === 'MINE' || publicCatalogState === 'PUBLISHED')
				}
				readyKey={`${access}:${publicCatalogState}:${cohorts.length}`}
				audienceHint={audienceHint}
				goodMs={1000}
				poorMs={1500}
			/>
			<RouteReadyMarker
				name="TRENDS_DESK_READY"
				ready={committed != null}
				readyKey={`${access}:${committed?.cohort.id ?? ''}:${committed?.eventId ?? ''}:${committed?.cohort.revision ?? ''}`}
				audienceHint={audienceHint}
				goodMs={1000}
				poorMs={1500}
			/>
			<PageShell>
				<div className="container mx-auto max-w-6xl px-4 py-8">
					<StatsPageHeader
						title={t('title')}
						badge={
							<div className="flex items-center gap-2">
								<span className="rounded-full border border-border/80 bg-card px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-foreground">
									GW{committed?.eventId ?? eventId}
								</span>
								{pending ? (
									<span
										role="status"
										className="text-xs text-muted-foreground"
									>
										{t('loading')}
									</span>
								) : null}
								{committed ? (
									<ShareActions
										actions={['image']}
										text={shareText}
										imageRef={shareRef}
										title={t('title')}
									/>
								) : null}
							</div>
						}
					/>

					<Card className="mb-6 p-4 sm:p-5">
						<div className="flex flex-col gap-4">
							<div
								role="group"
								aria-label={t('scopeLabel')}
								className="grid grid-cols-2 rounded-lg border border-border/80 bg-muted/35 p-1 sm:flex sm:w-fit"
							>
								{(['MINE', 'PUBLIC'] as const).map(scope => {
									const isMine = scope === 'MINE'
									const scopeReadyCount = (
										isMine ? groupedCohorts.mine : groupedCohorts.public
									).filter(isTrendCohortReady).length
									const disabled = isMine
										? !canLoadMine || scopeReadyCount === 0
										: scopeReadyCount === 0
									return (
										<button
											key={scope}
											type="button"
											aria-pressed={access === scope}
											disabled={disabled}
											onClick={() => selectScope(scope)}
											className={cn(
												'inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-32',
												access === scope
													? 'bg-background text-foreground shadow-sm'
													: 'text-muted-foreground hover:text-foreground'
											)}
										>
											{isMine ? t('scopeMine') : t('scopePublic')}
											<span className="font-mono text-[10px] tabular-nums text-muted-foreground">
												{scopeReadyCount}
											</span>
										</button>
									)
								})}
							</div>

							<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
								<label className="min-w-0">
									<span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
										{t('activeLeague')}
									</span>
									<select
										value={selected?.id ?? ''}
										onChange={event => void select(event.target.value, eventId)}
										className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
										aria-busy={pending}
									>
										{readyScopeCohorts.length === 0 && (
											<option value="">
												{isMineAndUnavailable(access, canLoadMine, t)}
											</option>
										)}
										{scopeCohorts.map(item => (
											<option
												key={item.id}
												value={item.id}
												disabled={!isTrendCohortReady(item)}
											>
												{isTrendCohortReady(item)
													? item.displayName
													: t('competitionNotReady', {
															name: item.displayName
														})}
											</option>
										))}
									</select>
								</label>
								<label>
									<span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
										{t('selectGameweek')}
									</span>
									<select
										value={eventId}
										onChange={event =>
											selected &&
											void select(selected.id, Number(event.target.value))
										}
										className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
										aria-busy={pending}
									>
										{Array.from({ length: 38 }, (_, index) => index + 1).map(
											value => (
												<option
													key={value}
													value={value}
												>
													GW{value}
												</option>
											)
										)}
									</select>
								</label>
							</div>
						</div>
					</Card>

					{denominators.mismatch ? (
						<p className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
							{t('denominatorMismatch')}
						</p>
					) : null}
					{denominators.missing ? (
						<p className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
							{t('denominatorMissing')}
						</p>
					) : null}

					{!canLoadMine ? (
						<div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
							<span>{t('needEntry')}</span>
							<Link
								href="/onboarding/bind-entry"
								className="inline-flex items-center gap-1 font-semibold text-primary-ink underline decoration-primary/35 underline-offset-4 hover:decoration-primary"
							>
								{t('bindEntryCta')}
								<ArrowRight
									className="size-3.5"
									aria-hidden="true"
								/>
							</Link>
						</div>
					) : null}
					{myCohortsLoadFailed || publicCohortsLoadFailed ? (
						<div
							className="mb-3 flex flex-wrap gap-2 text-xs text-destructive"
							role="status"
						>
							{myCohortsLoadFailed ? <span>{t('myLeaguesError')}</span> : null}
							{publicCohortsLoadFailed ? (
								<span>{t('publicLeaguesError')}</span>
							) : null}
						</div>
					) : null}
					{error && committed ? (
						<p
							className="mb-3 text-xs text-destructive"
							role="status"
						>
							{error}
						</p>
					) : null}

					{committed ? (
						<div
							ref={shareRef}
							data-share-preserve-width="true"
							data-share-fit-content="true"
							aria-busy={pending}
						>
							{availableViews.length > 0 ? (
								<Tabs
									value={visibleView?.id ?? availableViews[0].id}
									onValueChange={value => setActiveView(value as TrendView)}
								>
									<StatsTabsShell>
										<TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 sm:grid-cols-4">
											{availableViews.map(view => (
												<TabsTrigger
													key={view.id}
													value={view.id}
													className="min-h-11 w-full rounded-md px-3 text-sm font-semibold"
												>
													{view.label}
												</TabsTrigger>
											))}
										</TabsList>
									</StatsTabsShell>

									{viewDefinitions.map(view => {
										const sections = committed.sections.filter(section =>
											view.capabilities.includes(section.capability)
										)
										if (sections.length === 0) return null
										const personalSection = sections.find(
											section => section.capability === 'PERSONAL_EXPOSURE'
										)
										const templateSection = sections.find(
											section => section.capability === 'TEMPLATE'
										)
										const showPitch =
											view.id === 'squad' &&
											personalSection?.rows !== null &&
											(personalSection?.rows.length ?? 0) > 0
										const showTemplate =
											view.id === 'template' &&
											templateSection?.rows !== null &&
											buildTrendTemplate(templateSection?.rows ?? null) !== null
										return (
											<TabsContent
												key={view.id}
												value={view.id}
												className="mt-5"
											>
												<div className="mb-4 border-b border-border/70 pb-3">
													<h2 className="font-display text-2xl font-bold tracking-tight">
														{view.label}
													</h2>
												</div>
												{showTemplate && templateSection ? (
													<TrendTemplatePitch
														section={templateSection}
														eventId={committed.eventId}
														t={t}
													/>
												) : showPitch && personalSection ? (
													<TrendSquadPitch
														section={personalSection}
														eventId={committed.eventId}
														t={t}
													/>
												) : (
													<div className="grid gap-4 lg:grid-cols-2">
														{sections.map(section => (
															<SignalCard
																key={section.capability}
																section={section}
																eventId={committed.eventId}
																locale="en-US"
																t={t}
																onRetry={() =>
																	void select(
																		committed.cohort.id,
																		committed.eventId,
																		false,
																		true
																	)
																}
															/>
														))}
													</div>
												)}
											</TabsContent>
										)
									})}
								</Tabs>
							) : (
								<div className="rounded-lg border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
									{t('noData')}
								</div>
							)}
						</div>
					) : boardError ? (
						<Card
							role="alert"
							className="p-8 text-center shadow-sm"
						>
							<div className="mx-auto grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
								<Activity
									className="size-6"
									aria-hidden="true"
								/>
							</div>
							<h2 className="mt-4 font-display text-2xl font-bold tracking-tight">
								{t('emptyBoardTitle')}
							</h2>
							<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
								{error}
							</p>
							{selected ? (
								<button
									type="button"
									className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									onClick={() => void select(selected.id, eventId)}
								>
									<RefreshCw
										className="size-4"
										aria-hidden="true"
									/>
									{t('retry')}
								</button>
							) : null}
						</Card>
					) : showEmptyBoard ? (
						<Card className="p-6 shadow-sm sm:p-8">
							<div className="max-w-2xl">
								<div className="grid size-11 place-items-center rounded-xl bg-accent text-primary-ink">
									<Sparkles
										className="size-5"
										aria-hidden="true"
									/>
								</div>
								<h2 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
									{publicCatalogState === 'NOT_PUBLISHED'
										? t('notPublished')
										: t('emptyBoardTitle')}
								</h2>
								<p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
									{publicCatalogState === 'NOT_PUBLISHED'
										? t('notPublished')
										: cohorts.length > 0
											? t('noReadyLeagueOptions')
											: t('emptyBoardDescription')}
								</p>
								<div className="mt-5 flex flex-wrap gap-2">
									{!canLoadMine ? (
										<Link
											href="/onboarding/bind-entry"
											className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											{t('bindEntryCta')}
											<ArrowRight
												className="size-4"
												aria-hidden="true"
											/>
										</Link>
									) : null}
									<Link
										href="/competitions/browse"
										className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border/80 bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/45 hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										{t('browseCompetitions')}
										<ArrowRight
											className="size-4"
											aria-hidden="true"
										/>
									</Link>
								</div>
							</div>
						</Card>
					) : null}
				</div>
			</PageShell>
		</>
	)
}

function isMineAndUnavailable(
	access: TrendAccess,
	canLoadMine: boolean,
	t: ReturnType<typeof useTranslations<'Selections'>>
) {
	if (access === 'MINE' && !canLoadMine) return t('needEntry')
	return t('noLeagueOptions')
}
