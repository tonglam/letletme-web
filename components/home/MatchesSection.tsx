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
} from '@/lib/graphql/queries'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
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

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const LONG_WEEKDAYS = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
] as const
const LONG_MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
] as const

function pad2(value: number): string {
	return String(value).padStart(2, '0')
}

function getDateKey(date: Date, useLocalTime: boolean): string {
	if (useLocalTime) return format(date, 'yyyy-MM-dd')
	return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function formatFixtureDate(date: Date, useLocalTime: boolean): string {
	if (useLocalTime) return format(date, 'EEEE dd MMMM yyyy')
	return `${LONG_WEEKDAYS[date.getUTCDay()]} ${pad2(date.getUTCDate())} ${
		LONG_MONTHS[date.getUTCMonth()]
	} ${date.getUTCFullYear()}`
}

function formatFixtureTab(date: Date, useLocalTime: boolean): string {
	if (useLocalTime) return format(date, 'EEE dd/MM')
	return `${SHORT_WEEKDAYS[date.getUTCDay()]} ${pad2(date.getUTCDate())}/${pad2(
		date.getUTCMonth() + 1,
	)}`
}

function formatFixtureTime(date: Date, useLocalTime: boolean): string {
	if (useLocalTime) return format(date, 'HH:mm')
	return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`
}

function MatchList({ matches }: { matches: MatchDay['matches'] }) {
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
								<div className="relative w-8 h-8 md:w-10 md:h-10">
									<Image
										alt={`${match.homeTeam} logo`}
										src={`/images/team-logos/${match.homeTeamShort.toUpperCase()}.png`}
										width={40}
										height={40}
										className="w-full h-full object-contain"
									/>
								</div>
								<span className="font-semibold text-sm md:text-base text-right">
									<span className="hidden md:inline">{match.homeTeam}</span>
									<span className="md:hidden">{match.homeTeamShort}</span>
								</span>
							</div>

							<div className="px-4 py-2 bg-background rounded-lg font-mono text-sm md:text-base font-semibold text-center mx-auto">
								{match.finished &&
								match.homeScore !== null &&
								match.awayScore !== null ? (
									<span className="text-lg">
										{match.homeScore} - {match.awayScore}
									</span>
								) : (
									<span>{match.time}</span>
								)}
							</div>

							<div className="flex items-center justify-start space-x-3">
								<span className="font-semibold text-sm md:text-base">
									<span className="hidden md:inline">{match.awayTeam}</span>
									<span className="md:hidden">{match.awayTeamShort}</span>
								</span>
								<div className="relative w-8 h-8 md:w-10 md:h-10">
									<Image
										alt={`${match.awayTeam} logo`}
										src={`/images/team-logos/${match.awayTeamShort.toUpperCase()}.png`}
										width={40}
										height={40}
										className="w-full h-full object-contain"
									/>
								</div>
							</div>
						</div>
					</div>
					{matchIndex < matches.length - 1 && <Separator className="my-4 md:my-6" />}
				</div>
			))}
		</div>
	)
}

function parseFixturesToMatchDays(fixtures: Fixture[], useLocalTime: boolean): MatchDay[] {
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
				date: formatFixtureDate(firstKickoff, useLocalTime),
				tabLabel: formatFixtureTab(firstKickoff, useLocalTime),
				matches: sorted.map((f) => ({
					homeTeam: f.homeTeam.name,
					homeTeamShort: f.homeTeam.shortName,
					awayTeam: f.awayTeam.name,
					awayTeamShort: f.awayTeam.shortName,
					time: formatFixtureTime(new Date(f.kickoffTime), useLocalTime),
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
		return parseFixturesToMatchDays(initialFixtures.eventFixtures, false)
	})

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setUseLocalTimezone(true)
			if (selectedEventId !== null && cache.current.has(selectedEventId)) {
				setMatchDays(parseFixturesToMatchDays(cache.current.get(selectedEventId)!, true))
			}
		}, 0)
		return () => window.clearTimeout(timer)
	}, [selectedEventId])

	const fetchFixtures = useCallback(async (eventId: number) => {
		if (cache.current.has(eventId)) {
			setMatchDays(parseFixturesToMatchDays(cache.current.get(eventId)!, useLocalTimezone))
			return
		}
		setIsLoadingFixtures(true)
		setError(null)
		try {
			const data = await executeQuery<EventFixturesResponse>(GET_EVENT_FIXTURES, { eventId })
			cache.current.set(eventId, data.eventFixtures)
			setMatchDays(parseFixturesToMatchDays(data.eventFixtures, useLocalTimezone))
		} catch {
			setError('Failed to load fixtures. Please try again.')
		} finally {
			setIsLoadingFixtures(false)
		}
	}, [useLocalTimezone])

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
		<div className="flex items-center justify-between mb-6">
			<h2 className="text-xl font-bold flex items-center gap-2">
				Upcoming Matches
				{selectedEventId !== null && (
					<span className="text-sm font-medium text-muted-foreground">
						(GW {selectedEventId})
					</span>
				)}
			</h2>
			<div className="flex items-center gap-1">
				<button
					onClick={handlePrev}
					disabled={!canGoPrev || isLoadingFixtures}
					aria-label="Previous gameweek"
					className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
				>
					<ChevronLeft className="w-5 h-5" />
				</button>
				<button
					onClick={handleNext}
					disabled={!canGoNext || isLoadingFixtures}
					aria-label="Next gameweek"
					className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
				>
					<ChevronRight className="w-5 h-5" />
				</button>
			</div>
		</div>
	)

	if (!initialEventId) {
		return (
			<div className="flex-grow mb-8">
				<Card className="p-4 md:p-6">
					<h2 className="text-xl font-bold mb-6">Upcoming Matches</h2>
					<p className="text-sm text-muted-foreground text-center py-8">
						Unable to load fixtures
					</p>
				</Card>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex-grow mb-8">
				<Card className="p-4 md:p-6">
					{header}
					<p className="text-sm text-destructive text-center py-8">{error}</p>
				</Card>
			</div>
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
			No matches scheduled for GW {selectedEventId}.
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
							<h3 className="text-xl font-semibold text-muted-foreground mb-6 mt-8 text-center">
								{matchDay.date}
							</h3>
						<MatchList matches={matchDay.matches} />
						{dayIndex < matchDays.length - 1 && <Separator className="mt-8" />}
					</div>
				))}
			</div>

			<div className="mt-6 pt-4 border-t text-center max-w-4xl mx-auto">
				<p className="text-sm text-muted-foreground">All times are shown in your local timezone</p>
			</div>
		</>
	)

	return (
		<div className="flex-grow mb-8">
			<Card className="p-4 md:p-6">
				{header}
				{fixturesContent}
			</Card>
		</div>
	)
}
