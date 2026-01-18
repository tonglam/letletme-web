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
	type EventsResponse,
	type Fixture
} from '@/lib/graphql/queries'
import { format } from 'date-fns'
import Image from 'next/image'
import { useEffect, useState } from 'react'

interface Match {
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

function MatchList({ matches }: { matches: Match['matches'] }) {
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
								{match.finished && match.homeScore !== null && match.awayScore !== null ? (
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
	const [matches, setMatches] = useState<Match[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const fetchMatches = async () => {
			try {
				setIsLoading(true)
				setError(null)

				// First, get the next event ID
				const eventsResponse = await executeQuery<EventsResponse>(
					GET_CURRENT_AND_NEXT_EVENTS
				)

				const nextEvent = eventsResponse.next?.[0]
				if (!nextEvent) {
					throw new Error('No next gameweek found')
				}

				// Then fetch fixtures for the next event
				const fixturesResponse = await executeQuery<EventFixturesResponse>(
					GET_EVENT_FIXTURES,
					{ eventId: nextEvent.id }
				)

				// Transform fixtures into matches grouped by date
				const fixtures = fixturesResponse.eventFixtures || []
				
				// Group fixtures by date
				const matchesByDate = new Map<string, Fixture[]>()
				
				fixtures.forEach(fixture => {
					// Parse kickoff time and convert to local timezone
					let kickoffDate: Date
					if (fixture.kickoffTime.includes('Z') || fixture.kickoffTime.includes('+')) {
						kickoffDate = new Date(fixture.kickoffTime)
					} else {
						const isoString = fixture.kickoffTime.replace(' ', 'T') + 'Z'
						kickoffDate = new Date(isoString)
					}
					
					// Use date as key (YYYY-MM-DD format)
					const dateKey = format(kickoffDate, 'yyyy-MM-dd')
					
					if (!matchesByDate.has(dateKey)) {
						matchesByDate.set(dateKey, [])
					}
					matchesByDate.get(dateKey)?.push(fixture)
				})

				// Convert map to array and sort by date
				const matchesArray: Match[] = Array.from(matchesByDate.entries())
					.sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
					.map(([dateKey, fixturesForDate]) => {
						const firstFixture = fixturesForDate[0]
						let kickoffDate: Date
						if (firstFixture.kickoffTime.includes('Z') || firstFixture.kickoffTime.includes('+')) {
							kickoffDate = new Date(firstFixture.kickoffTime)
						} else {
							const isoString = firstFixture.kickoffTime.replace(' ', 'T') + 'Z'
							kickoffDate = new Date(isoString)
						}

						// Sort fixtures by kickoff time
						const sortedFixtures = fixturesForDate.sort((a, b) => {
							let dateA: Date, dateB: Date
							if (a.kickoffTime.includes('Z') || a.kickoffTime.includes('+')) {
								dateA = new Date(a.kickoffTime)
							} else {
								dateA = new Date(a.kickoffTime.replace(' ', 'T') + 'Z')
							}
							if (b.kickoffTime.includes('Z') || b.kickoffTime.includes('+')) {
								dateB = new Date(b.kickoffTime)
							} else {
								dateB = new Date(b.kickoffTime.replace(' ', 'T') + 'Z')
							}
							return dateA.getTime() - dateB.getTime()
						})

						return {
							date: format(kickoffDate, 'EEEE dd MMMM yyyy'),
							dateObj: kickoffDate,
							matches: sortedFixtures.map(fixture => {
								let fixtureDate: Date
								if (fixture.kickoffTime.includes('Z') || fixture.kickoffTime.includes('+')) {
									fixtureDate = new Date(fixture.kickoffTime)
								} else {
									fixtureDate = new Date(fixture.kickoffTime.replace(' ', 'T') + 'Z')
								}
								
								return {
									homeTeam: fixture.homeTeam.name,
									homeTeamShort: fixture.homeTeam.shortName,
									awayTeam: fixture.awayTeam.name,
									awayTeamShort: fixture.awayTeam.shortName,
									time: format(fixtureDate, 'HH:mm'),
									homeScore: fixture.homeScore,
									awayScore: fixture.awayScore,
									finished: fixture.finished,
									started: fixture.started
								}
							})
						}
					})

				setMatches(matchesArray)
			} catch (err) {
				console.error('Failed to fetch matches:', err)
				const errorMessage = err instanceof Error ? err.message : String(err)
				if (errorMessage.includes('Failed to fetch')) {
					setError('Unable to connect to server. Please try again later.')
				} else {
					setError('Failed to load matches. Please try again later.')
				}
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
					</h2>
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-20 w-full" />
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
					</h2>
					<p className="text-sm text-destructive text-center py-8">{error}</p>
				</Card>
			</div>
		)
	}

	if (matches.length === 0) {
		return (
			<div className="flex-grow mb-8">
				<Card className="p-4 md:p-6">
					<h2 className="text-xl font-bold mb-6 flex items-center rounded-none sm:rounded-lg">
						Upcoming Matches
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
				</h2>

				{/* Mobile view with tabs */}
				<div className="md:hidden">
					<Tabs
						defaultValue={matches[0].date}
						className="w-full"
					>
						<TabsList className="grid mb-4" style={{ gridTemplateColumns: `repeat(${matches.length}, 1fr)` }}>
							{matches.map(matchDay => (
								<TabsTrigger
									key={matchDay.date}
									value={matchDay.date}
									className="text-xs"
								>
									{format(matchDay.dateObj, 'EEE dd/MM')}
								</TabsTrigger>
							))}
						</TabsList>
						{matches.map(matchDay => (
							<TabsContent
								key={matchDay.date}
								value={matchDay.date}
							>
								<MatchList matches={matchDay.matches} />
							</TabsContent>
						))}
					</Tabs>
				</div>

				{/* Desktop view with all days */}
				<div className="hidden md:block">
					{matches.map((matchDay, dayIndex) => (
						<div
							key={matchDay.date}
							className="max-w-4xl mx-auto"
						>
							<h3 className="text-xl font-semibold text-muted-foreground mb-6 mt-8 text-center">
								{format(matchDay.dateObj, 'EEEE dd MMMM yyyy')}
							</h3>
							<MatchList matches={matchDay.matches} />
							{dayIndex < matches.length - 1 && <Separator className="mt-8" />}
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
