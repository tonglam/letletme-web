'use client'

import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_EVENT_FIXTURES,
	type EventFixturesResponse,
	type Fixture,
} from '@/lib/graphql/operations/events'
import { Link } from '@/i18n/navigation'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_GAMEWEEK = 38

interface MatchDay {
	date: string
	tabLabel: string
	matches: {
		homeTeam: string
		homeTeamShort: string
		awayTeam: string
		awayTeamShort: string
		time: string
		homeScore: number | null
		awayScore: number | null
		finished: boolean
		started: boolean
	}[]
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

function formatFixtureDate(date: Date, useLocalTime: boolean, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'long',
		day: '2-digit',
		month: 'long',
		year: 'numeric',
		...(useLocalTime ? {} : { timeZone: 'UTC' }),
	}).format(date)
}

function formatFixtureTab(date: Date, useLocalTime: boolean, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: '2-digit',
		month: '2-digit',
		...(useLocalTime ? {} : { timeZone: 'UTC' }),
	}).format(date)
}

function formatFixtureTime(date: Date, useLocalTime: boolean, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
		...(useLocalTime ? {} : { timeZone: 'UTC' }),
	}).format(date)
}

function MatchList({ matches }: { matches: MatchDay['matches'] }) {
	const t = useTranslations('Home')
	return (
		<div className="space-y-4 md:space-y-6">
			{matches.map((match, matchIndex) => (
				<div
					key={matchIndex}
					className="max-w-3xl mx-auto"
				>
					<div className="flex flex-col md:flex-row md:items-center bg-accent/50 rounded-lg p-4 hover:bg-accent/70 transition-colors">
						<div className="grid grid-cols-3 items-center flex-1 gap-4">
							<div className="flex items-center justify-end space-x-3">
								<span className="font-semibold text-sm md:text-base text-right">
									<span className="hidden md:inline">{match.homeTeam}</span>
									<span className="md:hidden">{match.homeTeamShort}</span>
								</span>
								<div className="relative w-8 h-8 md:w-10 md:h-10">
									<Image
										alt={t('teamLogo', { team: match.homeTeam })}
										src={`/images/team-logos/${match.homeTeamShort.toUpperCase()}.png`}
										width={40}
										height={40}
										className="w-full h-full object-contain"
									/>
								</div>
							</div>

							<div className="mx-auto rounded-md border border-electric/25 bg-plum px-4 py-2 text-center font-mono text-sm font-semibold text-electric md:text-base">
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

							<div className="flex items-center justify-start space-x-3">
								<div className="relative w-8 h-8 md:w-10 md:h-10">
									<Image
										alt={t('teamLogo', { team: match.awayTeam })}
										src={`/images/team-logos/${match.awayTeamShort.toUpperCase()}.png`}
										width={40}
										height={40}
										className="w-full h-full object-contain"
									/>
								</div>
								<span className="font-semibold text-sm md:text-base">
									<span className="hidden md:inline">{match.awayTeam}</span>
									<span className="md:hidden">{match.awayTeamShort}</span>
								</span>
							</div>
						</div>
					</div>
					{matchIndex < matches.length - 1 && <Separator className="my-4 md:my-6" />}
				</div>
			))}
		</div>
	)
}

function parseFixturesToMatchDays(fixtures: Fixture[], useLocalTime: boolean, locale: string): MatchDay[] {
	const byDate = new Map<string, Fixture[]>()
	for (const fixture of fixtures) {
		const dateKey = getDateKey(new Date(fixture.kickoffTime), useLocalTime)
		if (!byDate.has(dateKey)) byDate.set(dateKey, [])
		byDate.get(dateKey)!.push(fixture)
	}

	return Array.from(byDate.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, dayFixtures]) => {
			const sorted = dayFixtures.sort(
				(a, b) =>
					new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime(),
			)
			const firstKickoff = new Date(sorted[0].kickoffTime)
			return {
				date: formatFixtureDate(firstKickoff, useLocalTime, locale),
				tabLabel: formatFixtureTab(firstKickoff, useLocalTime, locale),
				matches: sorted.map((f) => ({
					homeTeam: f.homeTeam.name,
					homeTeamShort: f.homeTeam.shortName,
					awayTeam: f.awayTeam.name,
					awayTeamShort: f.awayTeam.shortName,
					time: formatFixtureTime(new Date(f.kickoffTime), useLocalTime, locale),
					homeScore: f.finished ? (f.homeScore ?? null) : null,
					awayScore: f.finished ? (f.awayScore ?? null) : null,
					finished: f.finished,
					started: f.started,
				})),
			}
		})
}

interface MatchesSectionProps {
	initialEventId: number | null
	initialFixtures: EventFixturesResponse | null
}

export function MatchesSection({ initialEventId, initialFixtures }: MatchesSectionProps) {
	const locale = useLocale()
	const t = useTranslations('Home')
	// nextEventId acts as the lower navigation boundary (can't go below the current next GW)
	const [nextEventId] = useState<number | null>(initialEventId)
	const [selectedEventId, setSelectedEventId] = useState<number | null>(initialEventId)
	const [useLocalTimezone, setUseLocalTimezone] = useState(false)
	const [isLoadingFixtures, setIsLoadingFixtures] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Pre-populate the fixture cache with server-fetched initial data.
	const cache = useRef<Map<number, Fixture[]>>(
		initialEventId !== null && initialFixtures
			? new Map([[initialEventId, initialFixtures.eventFixtures]])
			: new Map(),
	)

	const [matchDays, setMatchDays] = useState<MatchDay[]>(() => {
		if (!initialFixtures || initialEventId === null) return []
		return parseFixturesToMatchDays(initialFixtures.eventFixtures, false, locale)
	})

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setUseLocalTimezone(true)
			if (selectedEventId !== null && cache.current.has(selectedEventId)) {
				setMatchDays(parseFixturesToMatchDays(cache.current.get(selectedEventId)!, true, locale))
			}
		}, 0)
		return () => window.clearTimeout(timer)
	}, [locale, selectedEventId])

	const fetchFixtures = useCallback(async (eventId: number) => {
		if (cache.current.has(eventId)) {
			setMatchDays(parseFixturesToMatchDays(cache.current.get(eventId)!, useLocalTimezone, locale))
			return
		}
		setIsLoadingFixtures(true)
		setError(null)
		try {
			const data = await executeQuery<EventFixturesResponse>(GET_EVENT_FIXTURES, { eventId })
			cache.current.set(eventId, data.eventFixtures)
			setMatchDays(parseFixturesToMatchDays(data.eventFixtures, useLocalTimezone, locale))
		} catch {
			setError(t('fixturesFailed'))
		} finally {
			setIsLoadingFixtures(false)
		}
	}, [locale, t, useLocalTimezone])

	const handlePrev = () => {
		if (selectedEventId === null || nextEventId === null) return
		if (selectedEventId <= nextEventId) return
		const prev = selectedEventId - 1
		setSelectedEventId(prev)
		void fetchFixtures(prev)
	}

	const handleNext = () => {
		if (selectedEventId === null) return
		if (selectedEventId >= MAX_GAMEWEEK) return
		const next = selectedEventId + 1
		setSelectedEventId(next)
		void fetchFixtures(next)
	}

	const canGoPrev =
		selectedEventId !== null && nextEventId !== null && selectedEventId > nextEventId
	const canGoNext = selectedEventId !== null && selectedEventId < MAX_GAMEWEEK

	const header = (
		<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
					{t('nextGameweekLabel')}
				</p>
				<h2 className="mt-1 flex flex-wrap items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide">
					{t('upcomingMatches')}
					{selectedEventId !== null && (
						<span className="rounded-md bg-plum px-2 py-1 font-mono text-xs font-semibold tracking-[0.14em] text-electric">
							GW{selectedEventId}
						</span>
					)}
				</h2>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Link
					href="/live/matches"
					className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
				>
					{t('viewLiveMatches')}
					<ArrowRight aria-hidden="true" className="size-4" />
				</Link>
				<div className="flex items-center gap-1">
					<button
						onClick={handlePrev}
						disabled={!canGoPrev || isLoadingFixtures}
						aria-label={t('previousGameweek')}
						className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
					>
						<ChevronLeft className="h-5 w-5" />
					</button>
					<button
						onClick={handleNext}
						disabled={!canGoNext || isLoadingFixtures}
						aria-label={t('nextGameweek')}
						className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
					>
						<ChevronRight className="h-5 w-5" />
					</button>
				</div>
			</div>
		</div>
	)

	if (!initialEventId) {
		return (
			<Card className="p-4 md:p-6">
				<h2 className="mb-6 font-display text-xl font-bold uppercase tracking-wide">{t('upcomingMatches')}</h2>
				<p className="py-8 text-center text-sm text-muted-foreground">
					{t('fixturesUnavailable')}
				</p>
			</Card>
		)
	}

	if (error) {
		return (
			<Card className="p-4 md:p-6">
				{header}
				<p className="py-8 text-center text-sm text-destructive">{error}</p>
			</Card>
		)
	}

	const fixturesContent = isLoadingFixtures ? (
		<div className="space-y-4">
			{[1, 2, 3].map((i) => (
				<Skeleton
					key={i}
					className="h-20 w-full"
				/>
			))}
		</div>
	) : matchDays.length === 0 ? (
		<p className="text-sm text-muted-foreground text-center py-8">
			{t('noMatches', { gameweek: selectedEventId ?? '—' })}
		</p>
	) : (
		<>
			<div className="md:hidden">
				<Tabs
					defaultValue={matchDays[0].date}
					className="w-full"
				>
					<TabsList
						className="grid mb-4"
						style={{ gridTemplateColumns: `repeat(${matchDays.length}, 1fr)` }}
						>
							{matchDays.map((matchDay) => (
								<TabsTrigger
									key={matchDay.date}
									value={matchDay.date}
									className="text-xs"
								>
									{matchDay.tabLabel}
								</TabsTrigger>
							))}
					</TabsList>
					{matchDays.map((matchDay) => (
						<TabsContent
							key={matchDay.date}
							value={matchDay.date}
						>
							<MatchList matches={matchDay.matches} />
						</TabsContent>
					))}
				</Tabs>
			</div>

			<div className="hidden md:block">
					{matchDays.map((matchDay, dayIndex) => (
						<div
							key={matchDay.date}
							className="max-w-4xl mx-auto"
						>
							<h3 className="mb-6 mt-8 text-center font-display text-lg font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								{matchDay.date}
							</h3>
						<MatchList matches={matchDay.matches} />
						{dayIndex < matchDays.length - 1 && <Separator className="mt-8" />}
					</div>
				))}
			</div>

			<div className="mt-6 pt-4 border-t text-center max-w-4xl mx-auto">
				<p className="text-sm text-muted-foreground">{t('localTimezone')}</p>
			</div>
		</>
	)

	return (
		<Card className="p-4 md:p-6">
			{header}
			{fixturesContent}
		</Card>
	)
}
