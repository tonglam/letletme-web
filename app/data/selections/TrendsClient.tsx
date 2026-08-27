'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { ShareActions } from '@/components/share/ShareActions'
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
import {
	resolveTrendAvailabilityState,
	trendAvailabilityLabelKey,
	trendAvailabilityMessageKey
} from './_lib/trend-availability'
import type {
	TrendAccess,
	TrendCohort,
	TrendDesk,
	TrendCatalogState
} from '@/lib/graphql/operations/trends'

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

// GraphQL returns PERSONAL_EXPOSURE independently of the ranking limit. The
// request remains capped at twelve because that limit is only for ranked
// sections; the UI explicitly renders the complete personal section.

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

const labelKeys: Record<
	string,
	| 'ownershipLabel'
	| 'effectiveOwnershipLabel'
	| 'captaincyLabel'
	| 'viceCaptaincyLabel'
	| 'transfersLabel'
	| 'personalExposureLabel'
> = {
	OWNERSHIP: 'ownershipLabel',
	EFFECTIVE_OWNERSHIP: 'effectiveOwnershipLabel',
	CAPTAINCY: 'captaincyLabel',
	VICE_CAPTAINCY: 'viceCaptaincyLabel',
	TRANSFERS: 'transfersLabel',
	PERSONAL_EXPOSURE: 'personalExposureLabel'
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
	const switchStartedAt = useRef<number | null>(null)
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
	const committedAvailability = committed
		? resolveTrendAvailabilityState({
				state: committed.cohort.availability,
				rows: null
			})
		: null
	const audienceHint =
		typeof document === 'undefined'
			? ('unknown' as const)
			: resolveAudienceHint()
	const denominators = useMemo(
		() => denominatorSummary(committed?.sections ?? []),
		[committed]
	)

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
		pushHistory = true
	) {
		const knownCohort = cohorts.find(item => item.id === nextCohort)
		if (!knownCohort || !isTrendCohortReady(knownCohort)) return
		const nextAccess = knownCohort.access
		const key = `${nextAccess}:${nextCohort}:${nextEvent}:${knownCohort?.revision ?? ''}`
		setAccess(nextAccess)
		setCohortId(nextCohort)
		setEventId(nextEvent)
		setError(null)
		if (pushHistory) updateUrl(nextAccess, nextCohort, nextEvent)
		const cached = cache.current.get(key)
		if (cached) {
			inFlight.current.forEach(request => request.controller.abort())
			inFlight.current.clear()
			++generation.current
			setPending(false)
			const startedAt = performance.now()
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
		switchStartedAt.current = performance.now()
		markRouteReadyStart(window.location.pathname, switchStartedAt.current, key)
		pendingSwitch.current = { key, startedAt: switchStartedAt.current }
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
			if (!desk || requestGeneration !== generation.current) return
			cache.current.set(key, desk)
			startTransition(() => setCommitted(desk))
		} catch (requestError) {
			if (
				requestError instanceof DOMException &&
				requestError.name === 'AbortError'
			)
				return
			if (requestGeneration === generation.current) setError(t('statsError'))
		} finally {
			inFlight.current.delete(key)
			if (requestGeneration === generation.current) setPending(false)
		}
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
					section.capability === 'PERSONAL_EXPOSURE'
						? t('squadPicks', {
								shown: section.rows.length,
								expected: PERSONAL_SQUAD_SIZE
							})
						: t('topRanked', { count: TOP_RANK_LIMIT })
				)
				const rows =
					section.capability === 'PERSONAL_EXPOSURE'
						? section.rows
						: section.rows.slice(0, TOP_RANK_LIMIT)
				for (const row of rows) {
					lines.push(
						`- ${row.playerName} ${row.teamShortName} · ${row.percentage == null ? '—' : `${row.percentage.toFixed(1)}%`} · ${row.count}`
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
			<section
				className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8"
				aria-labelledby="trends-title"
			>
				<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h1
							id="trends-title"
							className="font-display text-4xl font-bold tracking-tight"
						>
							{t('title')}
						</h1>
						<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
							{t('pageIntro')}
						</p>
					</div>
					<div
						className="flex items-center gap-2"
						aria-live="polite"
					>
						{pending && (
							<span className="text-xs text-muted-foreground">
								{t('loading')}
							</span>
						)}
						{error && (
							<span
								role="status"
								className="text-xs text-destructive"
							>
								{error}
							</span>
						)}
					</div>
				</div>

				<div className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
					<label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
						<span>{t('leagueSelectorLabel')}</span>
						<select
							value={selected?.id ?? ''}
							onChange={event => void select(event.target.value, eventId)}
							className="h-10 min-w-0 rounded-md border bg-background px-3"
							aria-busy={pending}
						>
							{cohorts.length === 0 && (
								<option value="">{t('noLeagueOptions')}</option>
							)}
							{cohorts.length > 0 && !selected && (
								<option value="">{t('leagueSelectorPlaceholder')}</option>
							)}
							{groupedCohorts.mine.length > 0 && (
								<optgroup label={t('myLeagues')}>
									{groupedCohorts.mine.map(item => (
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
								</optgroup>
							)}
							{groupedCohorts.public.length > 0 && (
								<optgroup label={t('publicLeagues')}>
									{groupedCohorts.public.map(item => (
										<option
											key={item.id}
											value={item.id}
										>
											{item.displayName}
										</option>
									))}
								</optgroup>
							)}
						</select>
					</label>
					<label className="flex flex-col gap-1 text-sm font-medium">
						<span>Gameweek</span>
						<select
							value={eventId}
							onChange={event =>
								selected && void select(selected.id, Number(event.target.value))
							}
							className="h-10 rounded-md border bg-background px-3"
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
				{!canLoadMine && (
					<p className="mt-3 text-xs text-muted-foreground">{t('needEntry')}</p>
				)}
				{myCohortsLoadFailed && (
					<p
						className="mt-3 text-xs text-destructive"
						role="status"
					>
						{t('myLeaguesError')}
					</p>
				)}
				{publicCohortsLoadFailed && (
					<p
						className="mt-3 text-xs text-destructive"
						role="status"
					>
						{t('publicLeaguesError')}
					</p>
				)}

				<div
					className="mt-6 min-h-[480px]"
					aria-busy={pending}
				>
					{!committed && error && (
						<div
							className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground"
							role="alert"
						>
							<p>{error}</p>
							{selected && (
								<button
									type="button"
									className="mt-3 rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted"
									onClick={() => void select(selected.id, eventId)}
								>
									{t('retry')}
								</button>
							)}
						</div>
					)}
					{!committed && !error && publicCohortsLoadFailed ? (
						<div
							className="rounded-xl border border-destructive/30 p-10 text-center text-sm text-destructive"
							role="alert"
						>
							<p>{t('publicLeaguesError')}</p>
							<button
								type="button"
								className="mt-3 rounded-md border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
								onClick={() => window.location.reload()}
							>
								{t('retry')}
							</button>
						</div>
					) : !committed && !error ? (
						publicCatalogState === 'NOT_PUBLISHED' && access === 'PUBLIC' ? (
							<div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
								{t('notPublished')}
							</div>
						) : (
							<div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
								{cohorts.length > 0
									? t('noReadyLeagueOptions')
									: t('noLeagueOptions')}
							</div>
						)
					) : null}
					{committed && (
						<>
							<div className="mb-4 flex items-center justify-between">
								<div>
									<h2 className="font-display text-2xl font-bold">
										{committed.cohort.displayName}
									</h2>
									<p className="text-sm text-muted-foreground">
										GW{committed.eventId} ·{' '}
										{t(
											trendAvailabilityLabelKey(
												committedAvailability ?? 'UNAVAILABLE'
											)
										)}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<span className="rounded-full bg-muted px-3 py-1 text-xs">
										{committed.cohort.exact
											? denominators.shared !== null
												? t('exactCompetitionWithCount', {
														count: denominators.shared
													})
												: t('exactCompetition')
											: t('sampledCohort', {
													count:
														committed.sections.find(
															section =>
																section.evidenceContext.sampleSize != null
														)?.evidenceContext.sampleSize ?? '?'
												})}
									</span>
									<ShareActions
										text={shareText}
										imageRef={shareRef}
										title={committed.cohort.displayName}
									/>
								</div>
							</div>
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
							<div
								ref={shareRef}
								data-share-preserve-width="true"
							>
								<div className="grid gap-4 md:grid-cols-2">
									{committed.sections.map(section => {
										const availability = resolveTrendAvailabilityState(section)
										const denominator = sectionDenominator(section)
										const personalExposure =
											section.capability === 'PERSONAL_EXPOSURE'
										const sectionRows =
											section.rows && personalExposure
												? section.rows
												: section.rows?.slice(0, TOP_RANK_LIMIT)
										return (
											<article
												key={section.capability}
												className="rounded-xl border bg-card p-4 shadow-sm"
											>
												<div className="mb-3 flex items-center justify-between">
													<h3 className="font-semibold">
														{labelKeys[section.capability]
															? t(labelKeys[section.capability])
															: t('unknownCapability')}
													</h3>
													<span className="text-xs text-muted-foreground">
														{t(trendAvailabilityLabelKey(availability))}
													</span>
												</div>
												{section.rows !== null ? (
													<p className="mb-3 text-xs text-muted-foreground">
														{personalExposure
															? t('squadPicks', {
																	shown: section.rows.length,
																	expected: PERSONAL_SQUAD_SIZE
																})
															: t('topRanked', { count: TOP_RANK_LIMIT })}{' '}
														·{' '}
														{denominator === null
															? t('fieldSizeUnavailable')
															: t('fieldSize', { count: denominator })}
													</p>
												) : null}
												{section.rows === null ? (
													<div className="space-y-3">
														<p className="text-sm text-muted-foreground">
															{t(trendAvailabilityMessageKey(availability), {
																gameweek: committed.eventId
															})}
														</p>
														{availability === 'UNAVAILABLE' ? (
															<button
																type="button"
																className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted"
																onClick={() =>
																	void select(
																		committed.cohort.id,
																		committed.eventId,
																		false
																	)
																}
															>
																{t('retry')}
															</button>
														) : null}
													</div>
												) : section.rows.length === 0 ? (
													<p className="text-sm text-muted-foreground">
														{t(
															availability === 'CONFIRMED_EMPTY'
																? 'confirmedEmpty'
																: availability === 'STALE'
																	? 'staleData'
																	: availability === 'PARTIAL'
																		? 'partialData'
																		: 'noData'
														)}
													</p>
												) : (
													<ol className="space-y-2">
														{sectionRows?.map(row => (
															<li
																key={row.elementId}
																className="flex items-center justify-between gap-3 text-sm"
															>
																<span className="min-w-0 truncate">
																	<Link
																		href={`/explore/player-stats?p1=${row.elementId}`}
																		prefetch={false}
																		className="font-semibold hover:underline"
																	>
																		{row.playerName}
																	</Link>
																	<span className="ml-2 text-muted-foreground">
																		{row.teamShortName}
																	</span>
																</span>
																<span className="shrink-0 tabular-nums">
																	{row.percentage == null
																		? row.count
																		: `${row.percentage.toFixed(1)}%`}
																</span>
															</li>
														))}
													</ol>
												)}
											</article>
										)
									})}
								</div>
							</div>
						</>
					)}
				</div>
			</section>
		</>
	)
}
