'use client'

import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_CURRENT_AND_NEXT_EVENTS,
	GET_EVENT_FIXTURES,
	type EventFixturesResponse,
	type EventsResponse
} from '@/lib/graphql/queries'
import { format } from 'date-fns'
import Image from 'next/image'
import { useEffect, useState } from 'react'

interface MatchDay {
	date: string
	dateObj: Date
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
					{matchIndex < matches.length - 1 && (
						<Separator className="my-4 md:my-6" />
					)}
				</div>
			))}
		</div>
	)
}

export function MatchesSection() {
	const [matchDays, setMatchDays] = useState<MatchDay[]>([])
	const [nextGameweek, setNextGameweek] = useState<number | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const fetchMatches = async () => {
			try {
				setIsLoading(true)
				setError(null)

				const eventsData = await executeQuery<EventsResponse>(
					GET_CURRENT_AND_NEXT_EVENTS
				)
				const nextEventId = eventsData.next[0]?.id
				if (!nextEventId) throw new Error('No upcoming event found')
				setNextGameweek(nextEventId)

				const fixturesData = await executeQuery<EventFixturesResponse>(
					GET_EVENT_FIXTURES,
					{ eventId: nextEventId }
				)

				// Group by date
				const byDate = new Map<string, typeof fixturesData.eventFixtures>()
				for (const fixture of fixturesData.eventFixtures) {
					const dateKey = format(new Date(fixture.kickoffTime), 'yyyy-MM-dd')
					if (!byDate.has(dateKey)) byDate.set(dateKey, [])
					byDate.get(dateKey)!.push(fixture)
				}

				const days: MatchDay[] = Array.from(byDate.entries())
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([, dayFixtures]) => {
						const sorted = dayFixtures.sort(
							(a, b) =>
								new Date(a.kickoffTime).getTime() -
								new Date(b.kickoffTime).getTime()
						)
						const firstKickoff = new Date(sorted[0].kickoffTime)
						return {
							date: format(firstKickoff, 'EEEE dd MMMM yyyy'),
							dateObj: firstKickoff,
							matches: sorted.map(f => ({
								homeTeam: f.homeTeam.name,
								homeTeamShort: f.homeTeam.shortName,
								awayTeam: f.awayTeam.name,
								awayTeamShort: f.awayTeam.shortName,
								time: format(new Date(f.kickoffTime), 'HH:mm'),
								homeScore: f.finished ? (f.homeScore ?? null) : null,
								awayScore: f.finished ? (f.awayScore ?? null) : null,
								finished: f.finished,
								started: f.started
							}))
						}
					})

				setMatchDays(days)
			} catch (err) {
				console.error('Failed to fetch matches:', err)
				setError('Failed to load matches. Please try again later.')
			} finally {
				setIsLoading(false)
			}
		}

		fetchMatches()
	}, [])

	if (isLoading) {
		return (
			<div className="flex-grow mb-8">
				<Card className="p-4 md:p-6">
					<h2 className="text-xl font-bold mb-6 flex items-center rounded-none sm:rounded-lg">
						Upcoming Matches
						{nextGameweek !== null && (
							<span className="ml-2 text-sm font-medium text-muted-foreground">
								(Next GW: {nextGameweek})
							</span>
						)}
					</h2>
					<div className="space-y-4">
						{[1, 2, 3].map(i => (
							<Skeleton
								key={i}
								className="h-20 w-full"
							/>
						))}
					</div>
				</Card>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex-grow mb-8">
				<Card className="p-4 md:p-6">
					<h2 className="text-xl font-bold mb-6 flex items-center rounded-none sm:rounded-lg">
						Upcoming Matches
						{nextGameweek !== null && (
							<span className="ml-2 text-sm font-medium text-muted-foreground">
								(Next GW: {nextGameweek})
							</span>
						)}
					</h2>
					<p className="text-sm text-destructive text-center py-8">{error}</p>
				</Card>
			</div>
		)
	}

	if (matchDays.length === 0) {
		return (
			<div className="flex-grow mb-8">
				<Card className="p-4 md:p-6">
					<h2 className="text-xl font-bold mb-6 flex items-center rounded-none sm:rounded-lg">
						Upcoming Matches
						{nextGameweek !== null && (
							<span className="ml-2 text-sm font-medium text-muted-foreground">
								(GW: {nextGameweek})
							</span>
						)}
					</h2>
					<p className="text-sm text-muted-foreground text-center py-8">
						No matches scheduled for the next gameweek.
					</p>
				</Card>
			</div>
		)
	}

	return (
		<div className="flex-grow mb-8">
			<Card className="p-4 md:p-6">
				<h2 className="text-xl font-bold mb-6 flex items-center rounded-none sm:rounded-lg">
					Upcoming Matches
					{nextGameweek !== null && (
						<span className="ml-2 text-sm font-medium text-muted-foreground">
							(Next GW: {nextGameweek})
						</span>
					)}
				</h2>

				<div className="md:hidden">
					<Tabs
						defaultValue={matchDays[0].date}
						className="w-full"
					>
						<TabsList
							className="grid mb-4"
							style={{
								gridTemplateColumns: `repeat(${matchDays.length}, 1fr)`
							}}
						>
							{matchDays.map(matchDay => (
								<TabsTrigger
									key={matchDay.date}
									value={matchDay.date}
									className="text-xs"
								>
									{format(matchDay.dateObj, 'EEE dd/MM')}
								</TabsTrigger>
							))}
						</TabsList>
						{matchDays.map(matchDay => (
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
								{format(matchDay.dateObj, 'EEEE dd MMMM yyyy')}
							</h3>
							<MatchList matches={matchDay.matches} />
							{dayIndex < matchDays.length - 1 && (
								<Separator className="mt-8" />
							)}
						</div>
					))}
				</div>

				<div className="mt-6 pt-4 border-t text-center max-w-4xl mx-auto">
					<p className="text-sm text-muted-foreground">
						All times are shown in your local timezone
					</p>
				</div>
			</Card>
		</div>
	)
}
