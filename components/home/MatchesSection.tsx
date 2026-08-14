'use client'

import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Link } from '@/i18n/navigation'
import type {
	HomeFixture,
	HomeFixturesResponse
} from '@/lib/graphql/operations/home'
import { teamCrestSrc } from '@/lib/team-crest'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import {
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent
} from 'react'

const MAX_GAMEWEEK = 38

interface MatchDay {
	dateKey: string
	date: string
	tabLabel: string
	matches: Array<{
		id: number
		homeTeam: string
		homeTeamShort: string
		awayTeam: string
		awayTeamShort: string
		time: string
		homeScore: number | null
		awayScore: number | null
		finished: boolean
	}>
}

function pad2(value: number): string {
	return String(value).padStart(2, '0')
}

function getDateKey(date: Date, useLocalTime: boolean): string {
	if (useLocalTime) {
		return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
	}
	return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function fixtureDateFormatter(
	locale: string,
	useLocalTime: boolean,
	options: Intl.DateTimeFormatOptions
) {
	return new Intl.DateTimeFormat(locale, {
		...options,
		...(useLocalTime ? {} : { timeZone: 'UTC' })
	})
}

export function parseHomeFixturesToMatchDays(
	fixtures: HomeFixture[],
	useLocalTime: boolean,
	locale: string
): MatchDay[] {
	const byDate = new Map<string, HomeFixture[]>()
	for (const fixture of fixtures) {
		if (!fixture.kickoffTime) continue
		const kickoff = new Date(fixture.kickoffTime)
		if (!Number.isFinite(kickoff.getTime())) continue
		const dateKey = getDateKey(kickoff, useLocalTime)
		const dayFixtures = byDate.get(dateKey) ?? []
		dayFixtures.push(fixture)
		byDate.set(dateKey, dayFixtures)
	}

	return Array.from(byDate.entries())
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([dateKey, dayFixtures]) => {
			const sorted = [...dayFixtures].sort(
				(left, right) =>
					Date.parse(left.kickoffTime ?? '') -
					Date.parse(right.kickoffTime ?? '')
			)
			const firstKickoff = new Date(sorted[0].kickoffTime ?? '')
			return {
				dateKey,
				date: fixtureDateFormatter(locale, useLocalTime, {
					weekday: 'long',
					day: '2-digit',
					month: 'long',
					year: 'numeric'
				}).format(firstKickoff),
				tabLabel: fixtureDateFormatter(locale, useLocalTime, {
					weekday: 'short',
					day: '2-digit',
					month: '2-digit'
				}).format(firstKickoff),
				matches: sorted.map(fixture => ({
					id: fixture.id,
					homeTeam: fixture.homeTeam.name,
					homeTeamShort: fixture.homeTeam.shortName,
					awayTeam: fixture.awayTeam.name,
					awayTeamShort: fixture.awayTeam.shortName,
					time: fixtureDateFormatter(locale, useLocalTime, {
						hour: '2-digit',
						minute: '2-digit',
						hourCycle: 'h23'
					}).format(new Date(fixture.kickoffTime ?? '')),
					homeScore: fixture.finished ? fixture.homeScore : null,
					awayScore: fixture.finished ? fixture.awayScore : null,
					finished: fixture.finished
				}))
			}
		})
}

function MatchList({ matches }: { matches: MatchDay['matches'] }) {
	const t = useTranslations('Home')
	return (
		<div className="space-y-4 md:space-y-6">
			{matches.map((match, index) => (
				<div
					key={match.id}
					className="mx-auto max-w-3xl"
				>
					<div className="flex flex-col rounded-lg bg-accent/50 p-4 transition-colors hover:bg-accent/70 md:flex-row md:items-center">
						<div className="grid flex-1 grid-cols-3 items-center gap-4">
							<div className="flex items-center justify-end gap-3">
								<span className="text-right text-sm font-semibold md:text-base">
									<span className="hidden md:inline">{match.homeTeam}</span>
									<span className="md:hidden">{match.homeTeamShort}</span>
								</span>
								<Image
									alt={t('teamLogo', { team: match.homeTeam })}
									src={teamCrestSrc(match.homeTeamShort)}
									width={40}
									height={40}
									sizes="(min-width: 768px) 40px, 32px"
									className="size-8 shrink-0 object-contain md:size-10"
								/>
							</div>

							<div className="mx-auto rounded-md border border-electric/25 bg-plum px-4 py-2 text-center font-display text-sm font-semibold text-electric md:text-base">
								{match.finished &&
								match.homeScore !== null &&
								match.awayScore !== null ? (
									<span className="text-lg tabular-nums">
										{match.homeScore} - {match.awayScore}
									</span>
								) : (
									<span className="tabular-nums">{match.time}</span>
								)}
							</div>

							<div className="flex items-center justify-start gap-3">
								<Image
									alt={t('teamLogo', { team: match.awayTeam })}
									src={teamCrestSrc(match.awayTeamShort)}
									width={40}
									height={40}
									sizes="(min-width: 768px) 40px, 32px"
									className="size-8 shrink-0 object-contain md:size-10"
								/>
								<span className="text-sm font-semibold md:text-base">
									<span className="hidden md:inline">{match.awayTeam}</span>
									<span className="md:hidden">{match.awayTeamShort}</span>
								</span>
							</div>
						</div>
					</div>
					{index < matches.length - 1 ? (
						<Separator className="my-4 md:my-6" />
					) : null}
				</div>
			))}
		</div>
	)
}

type InFlightRequest = {
	generation: number
	controller: AbortController
	promise: Promise<HomeFixturesResponse>
}

export function MatchesSection({
	initialFixtures
}: {
	initialFixtures: HomeFixturesResponse | null
}) {
	const locale = useLocale()
	const t = useTranslations('Home')
	const initialEventId = initialFixtures?.eventId ?? null
	const [minimumEventId] = useState(initialEventId)
	const [committed, setCommitted] = useState(initialFixtures)
	const [pendingEventId, setPendingEventId] = useState<number | null>(null)
	const [fixtureError, setFixtureError] = useState<string | null>(null)
	const [useLocalTimezone, setUseLocalTimezone] = useState(false)
	const [activeDayKey, setActiveDayKey] = useState<string | null>(null)
	const generation = useRef(0)
	const inFlight = useRef(new Map<number, InFlightRequest>())
	const revision = useRef(initialFixtures?.revision ?? null)
	const [cache] = useState(
		() =>
			new Map<string, HomeFixturesResponse>(
				initialFixtures
					? [
							[
								`${initialFixtures.revision}:${initialFixtures.eventId}`,
								initialFixtures
							]
						]
					: []
			)
	)
	const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
	const errorTimer = useRef<number | null>(null)

	useEffect(() => {
		const requests = inFlight.current
		setUseLocalTimezone(true)
		return () => {
			if (errorTimer.current !== null) window.clearTimeout(errorTimer.current)
			for (const request of Array.from(requests.values())) {
				request.controller.abort()
			}
			requests.clear()
		}
	}, [])

	const clearFixtureError = useCallback(() => {
		if (errorTimer.current !== null) {
			window.clearTimeout(errorTimer.current)
			errorTimer.current = null
		}
		setFixtureError(null)
	}, [])

	const showFixtureError = useCallback(() => {
		if (errorTimer.current !== null) window.clearTimeout(errorTimer.current)
		setFixtureError(t('fixturesFailed'))
		errorTimer.current = window.setTimeout(() => {
			setFixtureError(null)
			errorTimer.current = null
		}, 5_000)
	}, [t])

	const matchDays = useMemo(
		() =>
			committed
				? parseHomeFixturesToMatchDays(
						committed.fixtures,
						useLocalTimezone,
						locale
					)
				: [],
		[committed, locale, useLocalTimezone]
	)
	const activeDay =
		matchDays.find(day => day.dateKey === activeDayKey)?.dateKey ??
		matchDays[0]?.dateKey ??
		''
	const intentEventId = pendingEventId ?? committed?.eventId ?? initialEventId

	const loadEvent = useCallback(
		(eventId: number) => {
			clearFixtureError()
			const cacheKey = revision.current
				? `${revision.current}:${eventId}`
				: null
			const cached = cacheKey ? cache.get(cacheKey) : null
			if (cached) {
				generation.current += 1
				for (const request of Array.from(inFlight.current.values())) {
					request.controller.abort()
				}
				inFlight.current.clear()
				setPendingEventId(null)
				setActiveDayKey(null)
				startTransition(() => setCommitted(cached))
				return
			}

			const existing = inFlight.current.get(eventId)
			if (existing) {
				setPendingEventId(eventId)
				return
			}

			for (const [requestedEventId, request] of Array.from(
				inFlight.current.entries()
			)) {
				if (requestedEventId !== eventId) {
					request.controller.abort()
					inFlight.current.delete(requestedEventId)
				}
			}

			const requestGeneration = ++generation.current
			const controller = new AbortController()
			setPendingEventId(eventId)
			const promise = fetch(`/api/home/fixtures?eventId=${eventId}`, {
				method: 'GET',
				headers: { Accept: 'application/json' },
				signal: controller.signal
			}).then(async response => {
				if (!response.ok)
					throw new Error(`Fixtures request failed: ${response.status}`)
				return (await response.json()) as HomeFixturesResponse
			})
			inFlight.current.set(eventId, {
				generation: requestGeneration,
				controller,
				promise
			})

			void promise
				.then(next => {
					if (
						controller.signal.aborted ||
						requestGeneration !== generation.current
					) {
						return
					}
					if (revision.current !== next.revision) {
						cache.clear()
						revision.current = next.revision
					}
					cache.set(`${next.revision}:${eventId}`, next)
					setActiveDayKey(null)
					startTransition(() => setCommitted(next))
				})
				.catch(error => {
					if (controller.signal.aborted) return
					console.error('[home-fixtures] client switch failed', {
						error: error instanceof Error ? error.name : 'UnknownError'
					})
					showFixtureError()
				})
				.finally(() => {
					const request = inFlight.current.get(eventId)
					if (request?.generation === requestGeneration) {
						inFlight.current.delete(eventId)
					}
					if (requestGeneration === generation.current) {
						setPendingEventId(null)
					}
				})
		},
		[cache, clearFixtureError, showFixtureError]
	)

	const navigate = (direction: -1 | 1) => {
		if (intentEventId === null) return
		const target = intentEventId + direction
		if (target < (minimumEventId ?? 1) || target > MAX_GAMEWEEK) return
		loadEvent(target)
	}

	const onTabKeyDown = (
		event: KeyboardEvent<HTMLButtonElement>,
		index: number
	) => {
		let nextIndex: number | null = null
		if (event.key === 'ArrowRight') nextIndex = (index + 1) % matchDays.length
		if (event.key === 'ArrowLeft') {
			nextIndex = (index - 1 + matchDays.length) % matchDays.length
		}
		if (event.key === 'Home') nextIndex = 0
		if (event.key === 'End') nextIndex = matchDays.length - 1
		if (nextIndex === null) return
		event.preventDefault()
		setActiveDayKey(matchDays[nextIndex]?.dateKey ?? null)
		tabRefs.current[nextIndex]?.focus()
	}

	if (initialEventId === null) {
		return (
			<Card className="p-4 md:p-6">
				<h2 className="mb-6 font-display text-xl font-bold uppercase tracking-wide">
					{t('upcomingMatches')}
				</h2>
				<p className="py-8 text-center text-sm text-muted-foreground">
					{t('fixturesUnavailable')}
				</p>
			</Card>
		)
	}

	const committedEventId = committed?.eventId ?? initialEventId
	const canGoPrev =
		intentEventId !== null &&
		minimumEventId !== null &&
		intentEventId > minimumEventId
	const canGoNext = intentEventId !== null && intentEventId < MAX_GAMEWEEK

	return (
		<Card
			data-home-matches
			data-home-fixtures-event={committedEventId}
			className="min-h-[29rem] p-4 md:p-6"
		>
			{fixtureError ? (
				<div
					role="alert"
					className="fixed inset-x-4 top-20 z-[60] mx-auto max-w-md rounded-lg border border-destructive/35 bg-background px-4 py-3 text-center text-sm font-medium text-destructive shadow-lg"
				>
					{fixtureError}
				</div>
			) : null}
			<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p className="eyebrow">{t('nextGameweekLabel')}</p>
					<h2 className="mt-1 flex flex-wrap items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide">
						{t('upcomingMatches')}
						<GameweekBadge
							gameweek={committedEventId}
							size="sm"
							fontFamily="display"
						/>
					</h2>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Link
						href="/live/matches"
						prefetch={false}
						className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
					>
						{t('viewLiveMatches')}
						<ArrowRight
							aria-hidden="true"
							className="size-4"
						/>
					</Link>
					<div
						className="flex items-center gap-1"
						aria-busy={pendingEventId !== null}
					>
						<button
							type="button"
							onClick={() => navigate(-1)}
							disabled={!canGoPrev}
							aria-label={t('previousGameweek')}
							className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
						>
							<ChevronLeft
								aria-hidden="true"
								className="size-5"
							/>
						</button>
						<button
							type="button"
							onClick={() => navigate(1)}
							disabled={!canGoNext}
							aria-label={t('nextGameweek')}
							className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
						>
							<ChevronRight
								aria-hidden="true"
								className="size-5"
							/>
						</button>
					</div>
				</div>
			</div>

			<p
				className="sr-only"
				role="status"
				aria-live="polite"
			>
				{pendingEventId === null
					? ''
					: t('fixturesLoading', { gameweek: pendingEventId })}
			</p>

			{matchDays.length === 0 ? (
				<p className="py-8 text-center text-sm text-muted-foreground">
					{t('noMatches', { gameweek: committedEventId })}
				</p>
			) : (
				<>
					<div
						role="tablist"
						aria-label={t('fixtureDays')}
						className="mb-5 flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1"
					>
						{matchDays.map((matchDay, index) => {
							const selected = matchDay.dateKey === activeDay
							return (
								<button
									key={matchDay.dateKey}
									ref={node => {
										tabRefs.current[index] = node
									}}
									type="button"
									role="tab"
									id={`home-fixture-tab-${matchDay.dateKey}`}
									aria-controls={`home-fixture-panel-${matchDay.dateKey}`}
									aria-selected={selected}
									tabIndex={selected ? 0 : -1}
									onClick={() => setActiveDayKey(matchDay.dateKey)}
									onKeyDown={event => onTabKeyDown(event, index)}
									className={
										selected
											? 'min-h-9 shrink-0 rounded-md bg-background px-3 text-xs font-semibold text-foreground shadow-sm'
											: 'min-h-9 shrink-0 rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground'
									}
								>
									{matchDay.tabLabel}
								</button>
							)
						})}
					</div>
					{matchDays.map(matchDay =>
						matchDay.dateKey === activeDay ? (
							<div
								key={matchDay.dateKey}
								role="tabpanel"
								id={`home-fixture-panel-${matchDay.dateKey}`}
								aria-labelledby={`home-fixture-tab-${matchDay.dateKey}`}
							>
								<h3 className="mb-5 text-center font-display text-lg font-semibold uppercase tracking-caps text-muted-foreground">
									{matchDay.date}
								</h3>
								<MatchList matches={matchDay.matches} />
							</div>
						) : null
					)}
					<div className="mx-auto mt-6 max-w-4xl border-t pt-4 text-center">
						<p className="text-sm text-muted-foreground">
							{t('localTimezone')}
						</p>
					</div>
				</>
			)}
		</Card>
	)
}
