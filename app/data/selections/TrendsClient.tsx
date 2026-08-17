'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import {
	reportBrowserPerformanceMetric,
	resolveAudienceHint
} from '@/lib/analytics/client-vitals'
import { markRouteReadyStart } from '@/lib/analytics/route-navigation'
import {
	resolveTrendAvailabilityState,
	trendAvailabilityLabelKey,
	trendAvailabilityMessageKey
} from './_lib/trend-availability'
import type {
	TrendAccess,
	TrendCohort,
	TrendDesk
} from '@/lib/graphql/operations/trends'

type Props = {
	publicCohorts: TrendCohort[]
	myCohorts: TrendCohort[]
	canLoadMine: boolean
	initialDesk: TrendDesk | null
	initialAccess: TrendAccess
	initialCohortId: string | null
	initialEventId: number
	initialDeskError?: boolean
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
	myCohorts,
	canLoadMine,
	initialDesk,
	initialAccess,
	initialCohortId,
	initialEventId,
	initialDeskError = false
}: Props) {
	const t = useTranslations('Selections')
	const [access, setAccess] = useState<TrendAccess>(initialAccess)
	const [mineCohortState, setMineCohortState] = useState(myCohorts)
	const [cohortId, setCohortId] = useState(initialCohortId ?? '')
	const [eventId, setEventId] = useState(initialEventId)
	const [committed, setCommitted] = useState<TrendDesk | null>(initialDesk)
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(
		initialDeskError ? t('statsError') : null
	)
	const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
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
		() => (access === 'MINE' ? mineCohortState : publicCohorts),
		[access, mineCohortState, publicCohorts]
	)
	const selected =
		cohorts.find(item => item.id === cohortId) ?? cohorts[0] ?? null
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

	function updateUrl(
		nextAccess: TrendAccess,
		nextCohort: string,
		nextEvent: number
	) {
		const url = new URL(window.location.href)
		url.searchParams.set('cohort', nextCohort)
		url.searchParams.set('gw', String(nextEvent))
		url.searchParams.set('scope', nextAccess === 'MINE' ? 'mine' : 'public')
		url.searchParams.delete('tournament')
		window.history.pushState(
			{ access: nextAccess, cohort: nextCohort, gw: nextEvent },
			'',
			`${url.pathname}?${url.searchParams.toString()}`
		)
	}

	async function select(
		nextAccess: TrendAccess,
		nextCohort: string,
		nextEvent: number,
		pushHistory = true
	) {
		const knownCohort = (
			nextAccess === 'MINE' ? mineCohortState : publicCohorts
		).find(item => item.id === nextCohort)
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

	async function shareCurrentDesk() {
		if (!committed) return
		const text = `${committed.cohort.displayName} · GW${committed.eventId} Trends\n${window.location.href}`
		try {
			if (navigator.share) {
				await navigator.share({ title: 'Trends', text })
				return
			}
			const { copyTextToClipboard } =
				await import('@/app/live/points/_lib/live-points-share')
			const result = await copyTextToClipboard(text)
			if (result === 'copied') {
				setShareState('copied')
				window.setTimeout(() => setShareState('idle'), 2000)
			}
		} catch {
			setError('Share was cancelled or unavailable')
		}
	}

	useEffect(() => {
		const onPopState = (historyEvent: PopStateEvent) => {
			const params = new URLSearchParams(window.location.search)
			const nextCohort =
				params.get('cohort') ?? params.get('tournament') ?? cohortId
			const nextEvent = Number(params.get('gw') ?? eventId)
			const historyAccess = historyEvent.state?.access
			const nextAccess: TrendAccess =
				historyAccess === 'MINE' || params.get('scope') === 'mine'
					? 'MINE'
					: 'PUBLIC'
			if (nextCohort && Number.isInteger(nextEvent)) {
				const normalizedCohort = /^(?:competition|custom|rank-sample):/i.test(
					nextCohort
				)
					? nextCohort
					: `competition:${nextCohort}`
				void select(nextAccess, normalizedCohort, nextEvent, false)
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
				ready={cohorts.length > 0}
				readyKey={`${access}:${cohorts.length}`}
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
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
							Explore
						</p>
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

				<div className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
					<label className="flex flex-col gap-1 text-sm font-medium">
						<span>{t('scopeLabel')}</span>
						<select
							value={access}
							onChange={event => {
								const nextAccess = event.target.value as TrendAccess
								if (
									nextAccess === 'MINE' &&
									mineCohortState.length === 0 &&
									canLoadMine
								) {
									void fetch('/api/trends/my-cohorts', { cache: 'no-store' })
										.then(async response => {
											if (!response.ok)
												throw new Error(`HTTP ${response.status}`)
											const payload = (await response.json()) as {
												cohorts?: TrendCohort[]
											}
											const loaded = payload.cohorts ?? []
											setMineCohortState(loaded)
											const next = loaded[0]
											if (next) await select(nextAccess, next.id, eventId)
										})
										.catch(() => setError(t('myLeaguesError')))
									return
								}
								const next = (
									nextAccess === 'MINE' ? mineCohortState : publicCohorts
								)[0]
								if (next) void select(nextAccess, next.id, eventId)
							}}
							className="h-10 rounded-md border bg-background px-3"
							aria-busy={pending}
						>
							<option value="PUBLIC">Public</option>
							<option
								value="MINE"
								disabled={!canLoadMine && mineCohortState.length === 0}
							>
								My competitions
							</option>
						</select>
					</label>
					<label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
						<span>{t('leagueSelectorLabel')}</span>
						<select
							value={selected?.id ?? ''}
							onChange={event =>
								void select(access, event.target.value, eventId)
							}
							className="h-10 min-w-0 rounded-md border bg-background px-3"
							aria-busy={pending}
						>
							{cohorts.length === 0 && (
								<option value="">{t('noLeagueOptions')}</option>
							)}
							{cohorts.map(item => (
								<option
									key={item.id}
									value={item.id}
								>
									{item.displayName}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-1 text-sm font-medium">
						<span>Gameweek</span>
						<select
							value={eventId}
							onChange={event =>
								selected &&
								void select(access, selected.id, Number(event.target.value))
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
									onClick={() => void select(access, selected.id, eventId)}
								>
									{t('retry')}
								</button>
							)}
						</div>
					)}
					{!committed && !error && (
						<div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
							{t('noLeagueOptions')}
						</div>
					)}
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
											? t('exactCompetition')
											: t('sampledCohort', {
													count:
														committed.sections.find(
															section =>
																section.evidenceContext.sampleSize != null
														)?.evidenceContext.sampleSize ?? '?'
												})}
									</span>
													<button
										type="button"
										onClick={() => void shareCurrentDesk()}
										className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted"
									>
											{shareState === 'copied'
												? t('shareCopiedShort')
												: t('shareCopy')}
									</button>
								</div>
							</div>
							<div className="grid gap-4 md:grid-cols-2">
									{committed.sections.map(section => {
										const availability = resolveTrendAvailabilityState(section)
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
																	access,
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
												{section.rows.slice(0, 12).map(row => (
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
						</>
					)}
				</div>
			</section>
		</>
	)
}
