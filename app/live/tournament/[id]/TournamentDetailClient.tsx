"use client"

import { useEffect, useMemo, useState } from "react"
import RootLayout from "@/components/layout/RootLayout"
import { TournamentHeader } from "@/components/tournament/TournamentHeader"
import { SearchHeader } from "@/components/tournament/SearchHeader"
import { TournamentTable } from "@/components/tournament/TournamentTable"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { executeQuery } from "@/lib/graphql-client"
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_LIVE_POINTS,
	type EntryTournament,
	type EntryTournamentsResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse,
} from "@/lib/graphql/queries"
import { useEvent } from "@/lib/event-context"
import {
	buildTournamentEntries,
	buildTournamentStats,
} from "@/lib/tournament/liveEntries"
import {
	formatTournamentState
} from "@/lib/tournament/liveTournament"
import { type TournamentEntry } from "@/types/tournament"
import { ArrowLeft, Calendar, Users } from "lucide-react"
import Link from "next/link"

const formatGroupMode = (groupMode: string): string => {
	if (groupMode === "H2H") {
		return "Head-to-head"
	}
	if (groupMode === "POINTS_RACES") {
		return "Points race"
	}
	return "No group stage"
}

const formatKnockoutMode = (knockoutMode: string): string => {
	if (knockoutMode === "SINGLE_ELIMINATION") {
		return "Single elimination"
	}
	if (knockoutMode === "DOUBLE_ELIMINATION") {
		return "Home & away"
	}
	return "No knockout stage"
}

const fetchLivePoints = async (
	tournamentId: number,
	eventId: number,
): Promise<TournamentLiveCalcData[]> => {
	const response = await executeQuery<TournamentLivePointsResponse>(
		GET_TOURNAMENT_LIVE_POINTS,
		{ tournamentId, eventId },
	)
	return response.calcLivePointsForTournament.results ?? []
}

export default function TournamentDetailClient({ params, entryId }: { params: { id: string }; entryId: number }) {
	const tournamentId = params.id
	const { currentEventId } = useEvent()
	const [searchQuery, setSearchQuery] = useState("")
	const [currentGameweek] = useState<number>(currentEventId ?? 1)
	const [tournament, setTournament] = useState<EntryTournament | null>(null)
	const [entries, setEntries] = useState<TournamentEntry[]>([])
	const [isLoading, setIsLoading] = useState<boolean>(true)
	const [isLoadingStandings, setIsLoadingStandings] = useState<boolean>(false)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [standingsError, setStandingsError] = useState<string | null>(null)

	useEffect(() => {
		let isCancelled = false

		const loadTournament = async () => {
			if (entryId <= 0) {
				setIsLoading(false)
				setLoadError("Sign in and bind an FPL entry to view this tournament.")
				setTournament(null)
				return
			}

			try {
				setIsLoading(true)
				setLoadError(null)

				const tournamentsData = await executeQuery<EntryTournamentsResponse>(
					GET_ENTRY_TOURNAMENTS,
					{ entryId: entryId }
				)

				if (isCancelled) {
					return
				}

				const selectedTournament =
					tournamentsData.entryTournaments.find(
						entryTournament => String(entryTournament.id) === tournamentId
					) ?? null

				setTournament(selectedTournament)
			} catch (error) {
				if (isCancelled) {
					return
				}
				const message =
					error instanceof Error ? error.message : "Failed to load tournament"
				setLoadError(message)
				setTournament(null)
			} finally {
				if (!isCancelled) {
					setIsLoading(false)
				}
			}
		}

		loadTournament()

		return () => {
			isCancelled = true
		}
	}, [tournamentId, entryId])

	useEffect(() => {
		let isCancelled = false

		const loadStandings = async () => {
			if (!tournament || currentGameweek <= 0) {
				setEntries([])
				return
			}

			try {
				setIsLoadingStandings(true)
				setStandingsError(null)

				const tournamentNumericId = tournament.id
				const previousEventId = currentGameweek > 1 ? currentGameweek - 1 : null

				const [currentRows, previousRows] = await Promise.all([
					fetchLivePoints(tournamentNumericId, currentGameweek),
					previousEventId
						? fetchLivePoints(tournamentNumericId, previousEventId).catch(
								() => [] as TournamentLiveCalcData[],
							)
						: Promise.resolve([] as TournamentLiveCalcData[]),
				])

				if (isCancelled) {
					return
				}

				setEntries(buildTournamentEntries(currentRows, previousRows))
			} catch (error) {
				if (isCancelled) {
					return
				}
				const message =
					error instanceof Error ? error.message : "Failed to load standings"
				setStandingsError(message)
				setEntries([])
			} finally {
				if (!isCancelled) {
					setIsLoadingStandings(false)
				}
			}
		}

		loadStandings()

		return () => {
			isCancelled = true
		}
	}, [tournament, currentGameweek])

	const standingsStats = useMemo(() => buildTournamentStats(entries), [entries])

	const tournamentHeaderData = useMemo(() => {
		if (!tournament) {
			return null
		}

		return {
			name: tournament.name,
			gameweek: currentGameweek,
			averagePoints: standingsStats.averagePoints,
			highestPoints: standingsStats.highestPoints,
			totalEntries: standingsStats.totalEntries || tournament.totalTeamNum
		}
	}, [currentGameweek, standingsStats, tournament])

	return (
		<RootLayout>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<Link href="/live/tournament">
					<Button
						variant="ghost"
						className="flex items-center gap-1 text-primary hover:text-primary/80 mb-4"
					>
						<ArrowLeft className="h-4 w-4" />
						<span>Back to All Tournaments</span>
					</Button>
				</Link>

				{loadError && (
					<Card className="p-4 mb-6 border-destructive/30 bg-destructive/5 text-destructive text-sm">
						{loadError}
					</Card>
				)}

				{isLoading && (
					<Card className="p-6 text-sm text-muted-foreground mb-6">
						Loading tournament...
					</Card>
				)}

				{!isLoading && !tournament && !loadError && (
					<Card className="p-6 text-sm text-muted-foreground mb-6">
						This tournament is unavailable or you do not have access.
					</Card>
				)}

				{tournament && tournamentHeaderData && (
					<>
						<TournamentHeader
							name={tournamentHeaderData.name}
							gameweek={tournamentHeaderData.gameweek}
							averagePoints={tournamentHeaderData.averagePoints}
							highestPoints={tournamentHeaderData.highestPoints}
							totalEntries={tournamentHeaderData.totalEntries}
							tournamentId={String(tournament.id)}
						/>

						<Tabs defaultValue="standings" className="mb-6">
							<Card className="p-4 mb-6">
								<TabsList className="w-full grid grid-cols-3 gap-2">
									<TabsTrigger value="standings">Standings</TabsTrigger>
									<TabsTrigger value="stats">Tournament Stats</TabsTrigger>
									<TabsTrigger value="rules">Rules</TabsTrigger>
								</TabsList>
							</Card>

							<TabsContent value="standings">
								<SearchHeader
									searchQuery={searchQuery}
									setSearchQuery={setSearchQuery}
									captainOptions={[]}
									chipFilter="all"
									onChipFilterChange={() => {}}
									captainFilter="all"
									onCaptainFilterChange={() => {}}
								/>

								{standingsError && (
									<Card className="p-4 mb-4 border-destructive/30 bg-destructive/5 text-destructive text-sm">
										{standingsError}
									</Card>
								)}

								{isLoadingStandings ? (
									<Card className="p-6 text-sm text-muted-foreground">
										Loading standings...
									</Card>
								) : (
									<TournamentTable
										entries={entries}
										searchQuery={searchQuery}
										tournamentId={String(tournament.id)}
										gameweek={currentGameweek}
									/>
								)}
							</TabsContent>

							<TabsContent value="stats">
								<Card className="p-6">
									<h2 className="text-xl font-bold mb-6">Tournament Statistics</h2>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground">Creator</div>
											<div className="font-semibold">{tournament.creator}</div>
										</div>

										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground">League Type</div>
											<div className="font-semibold">{tournament.leagueType}</div>
										</div>

										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground flex items-center gap-2">
												<Users className="h-4 w-4 text-emerald-500" />
												Participant Count
											</div>
											<div className="text-2xl font-bold">{tournament.totalTeamNum}</div>
										</div>

										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground flex items-center gap-2">
												<Calendar className="h-4 w-4 text-purple-500" />
												Status
											</div>
											<div className="text-2xl font-bold">
												{formatTournamentState(tournament.state)}
											</div>
										</div>
									</div>
								</Card>
							</TabsContent>

							<TabsContent value="rules">
								<Card className="p-6">
									<h2 className="text-xl font-bold mb-6">Tournament Rules</h2>

									<div className="space-y-6 text-muted-foreground">
										<div>
											<h3 className="text-lg font-semibold mb-2 text-foreground">
												Group Stage
											</h3>
											<ul className="list-disc pl-5 space-y-1">
												<li>Mode: {formatGroupMode(tournament.groupMode)}</li>
												<li>Teams per group: {tournament.groupTeamNum}</li>
												<li>Groups: {tournament.groupNum}</li>
												<li>
													Gameweeks:{" "}
													{tournament.groupStartedEventId && tournament.groupEndedEventId
														? `GW${tournament.groupStartedEventId} - GW${tournament.groupEndedEventId}`
														: "Not scheduled"}
												</li>
											</ul>
										</div>

										<div>
											<h3 className="text-lg font-semibold mb-2 text-foreground">
												Knockout Stage
											</h3>
											<ul className="list-disc pl-5 space-y-1">
												<li>Mode: {formatKnockoutMode(tournament.knockoutMode)}</li>
												<li>
													Teams:{" "}
													{tournament.knockoutTeamNum !== null
														? tournament.knockoutTeamNum
														: "Not configured"}
												</li>
												<li>
													Rounds:{" "}
													{tournament.knockoutRounds !== null
														? tournament.knockoutRounds
														: "Not configured"}
												</li>
												<li>
													Gameweeks:{" "}
													{tournament.knockoutStartedEventId &&
													tournament.knockoutEndedEventId
														? `GW${tournament.knockoutStartedEventId} - GW${tournament.knockoutEndedEventId}`
														: "Not scheduled"}
												</li>
											</ul>
										</div>
									</div>
								</Card>
							</TabsContent>
						</Tabs>
					</>
				)}
			</div>
		</RootLayout>
	)
}
