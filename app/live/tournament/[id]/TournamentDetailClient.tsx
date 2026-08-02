"use client"

import { useMemo, useState } from "react"
import PageShell from "@/components/layout/PageShell"
import { TournamentHeader } from "@/components/tournament/TournamentHeader"
import { SearchHeader } from "@/components/tournament/SearchHeader"
import { TournamentTable } from "@/components/tournament/TournamentTable"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
	type EntryTournament,
	type TournamentLiveCalcData,
} from "@/lib/graphql/operations/tournaments"
import {
	buildTournamentEntries,
	buildTournamentStats,
} from "@/lib/tournament/liveEntries"
import {
	formatTournamentState
} from "@/lib/tournament/liveTournament"
import { ArrowLeft, Calendar, Settings, Users } from "lucide-react"
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

export default function TournamentDetailClient({
	canManage,
	tournament,
	currentGameweek,
	initialRows,
	initialError,
}: {
	canManage: boolean
	tournament: EntryTournament | null
	currentGameweek?: number
	initialRows: TournamentLiveCalcData[]
	initialError: string | null
}) {
	const [searchQuery, setSearchQuery] = useState("")
	const entries = useMemo(() => buildTournamentEntries(initialRows), [initialRows])

	const standingsStats = useMemo(() => buildTournamentStats(entries), [entries])

	const tournamentHeaderData = useMemo(() => {
		if (!tournament) {
			return null
		}

		return {
			name: tournament.name,
			averagePoints: standingsStats.averagePoints,
			highestPoints: standingsStats.highestPoints,
			totalEntries: standingsStats.totalEntries || tournament.totalTeamNum
		}
	}, [standingsStats, tournament])

	return (
		<PageShell>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
					<Button
						variant="ghost"
						className="-ml-3 text-primary hover:text-primary/80"
						asChild
					>
						<Link href="/live/tournament">
							<ArrowLeft aria-hidden="true" />
							<span>Back to all tournaments</span>
						</Link>
					</Button>
					{canManage && tournament ? (
						<Button variant="outline" asChild>
							<Link href={`/tournament/${tournament.id}/manage`}>
								<Settings aria-hidden="true" /> Manage
							</Link>
						</Button>
					) : null}
				</div>

				{initialError && (
					<Card className="p-4 mb-6 border-destructive/30 bg-destructive/5 text-destructive text-sm">
						{initialError}
					</Card>
				)}

				{!tournament && !initialError && (
					<Card className="p-6 text-sm text-muted-foreground mb-6">
						This tournament is unavailable or you do not have access.
					</Card>
				)}

				{tournament && tournamentHeaderData && (
					<>
						<TournamentHeader
							name={tournamentHeaderData.name}
							averagePoints={tournamentHeaderData.averagePoints}
							highestPoints={tournamentHeaderData.highestPoints}
							totalEntries={tournamentHeaderData.totalEntries}
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
								{currentGameweek ? (
									<>
										<SearchHeader
											searchQuery={searchQuery}
											setSearchQuery={setSearchQuery}
											showFilters={false}
										/>

										<TournamentTable
											entries={entries}
											searchQuery={searchQuery}
											tournamentId={String(tournament.id)}
											gameweek={currentGameweek}
										/>
									</>
								) : (
									<Card className="p-6 text-sm text-muted-foreground">
										Live standings are unavailable until the current gameweek can be confirmed.
									</Card>
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
		</PageShell>
	)
}
