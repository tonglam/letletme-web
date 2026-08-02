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
import { ArrowLeft, Calendar, Settings, Users } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"

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
	const t = useTranslations("LiveTournament")
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
	const formatGroupMode = (groupMode: string) => groupMode === "H2H"
		? t("headToHead")
		: groupMode === "POINTS_RACES"
			? t("pointsRace")
			: t("noGroup")
	const formatKnockoutMode = (knockoutMode: string) => knockoutMode === "SINGLE_ELIMINATION"
		? t("singleElimination")
		: knockoutMode === "DOUBLE_ELIMINATION"
			? t("homeAway")
			: t("noKnockout")
	const formatState = (state: string) => state === "ACTIVE"
		? t("active")
		: state === "COMPLETED"
			? t("completed")
			: state === "PENDING"
				? t("pending")
				: state
	const leagueType = tournament?.leagueType === "H2H" ? t("headToHead") : tournament?.leagueType === "CLASSIC" ? t("classic") : tournament?.leagueType

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
							<span>{t("backToTournaments")}</span>
						</Link>
					</Button>
					{canManage && tournament ? (
						<Button variant="outline" asChild>
							<Link href={`/tournament/${tournament.id}/manage`}>
								<Settings aria-hidden="true" /> {t("manage")}
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
						{t("unavailable")}
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
									<TabsTrigger value="standings">{t("standings")}</TabsTrigger>
									<TabsTrigger value="stats">{t("tournamentStats")}</TabsTrigger>
									<TabsTrigger value="rules">{t("rules")}</TabsTrigger>
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
										{t("liveUnavailable")}
									</Card>
								)}
							</TabsContent>

							<TabsContent value="stats">
								<Card className="p-6">
									<h2 className="text-xl font-bold mb-6">{t("statistics")}</h2>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground">{t("creator")}</div>
											<div className="font-semibold">{tournament.creator}</div>
										</div>

										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground">{t("leagueType")}</div>
											<div className="font-semibold">{leagueType}</div>
										</div>

										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground flex items-center gap-2">
												<Users className="h-4 w-4 text-emerald-500" />
												{t("participantCount")}
											</div>
											<div className="text-2xl font-bold">{tournament.totalTeamNum}</div>
										</div>

										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground flex items-center gap-2">
												<Calendar className="h-4 w-4 text-purple-500" />
												{t("status")}
											</div>
											<div className="text-2xl font-bold">
												{formatState(tournament.state)}
											</div>
										</div>
									</div>
								</Card>
							</TabsContent>

							<TabsContent value="rules">
								<Card className="p-6">
									<h2 className="text-xl font-bold mb-6">{t("tournamentRules")}</h2>

									<div className="space-y-6 text-muted-foreground">
										<div>
											<h3 className="text-lg font-semibold mb-2 text-foreground">
												{t("groupStage")}
											</h3>
											<ul className="list-disc pl-5 space-y-1">
												<li>{t("mode", { mode: formatGroupMode(tournament.groupMode) })}</li>
												<li>{t("teamsPerGroup", { count: tournament.groupTeamNum })}</li>
												<li>{t("groups", { count: tournament.groupNum })}</li>
												<li>
													{t("gameweeks", { value: tournament.groupStartedEventId && tournament.groupEndedEventId
														? t("gameweekRange", { start: tournament.groupStartedEventId, end: tournament.groupEndedEventId })
														: t("notScheduled") })}
												</li>
											</ul>
										</div>

										<div>
											<h3 className="text-lg font-semibold mb-2 text-foreground">
												{t("knockoutStage")}
											</h3>
											<ul className="list-disc pl-5 space-y-1">
												<li>{t("mode", { mode: formatKnockoutMode(tournament.knockoutMode) })}</li>
												<li>
													{t("teamsCount", { count: tournament.knockoutTeamNum !== null ? tournament.knockoutTeamNum : t("notConfigured") })}
												</li>
												<li>
													{t("rounds", { count: tournament.knockoutRounds !== null ? tournament.knockoutRounds : t("notConfigured") })}
												</li>
												<li>
													{t("gameweeks", { value: tournament.knockoutStartedEventId && tournament.knockoutEndedEventId
														? t("gameweekRange", { start: tournament.knockoutStartedEventId, end: tournament.knockoutEndedEventId })
														: t("notScheduled") })}
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
