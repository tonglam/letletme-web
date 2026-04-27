'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import RootLayout from '@/components/layout/RootLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TournamentSelector } from '@/components/tournament/TournamentSelector'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_CURRENT_AND_NEXT_EVENTS,
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_SELECTION_STATS,
	type EntryTournamentsResponse,
	type EventsResponse,
	type TournamentSelectionStatsResponse,
	type TournamentStatPlayer,
} from '@/lib/graphql/queries'
import {
	mapEntryTournamentToLiveTournament,
} from '@/lib/tournament/liveTournament'
import { Tournament } from '@/types/tournament'
import { Crown, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { useCallback, useEffect, useState } from 'react'

function positionLabel(position: string): string {
	switch (position.toUpperCase()) {
		case 'GOALKEEPER': return 'GKP'
		case 'DEFENDER': return 'DEF'
		case 'MIDFIELDER': return 'MID'
		case 'FORWARD': return 'FWD'
		default: return position
	}
}

function StatRow({ player, rank, leftLabel, leftValue, rightLabel, rightValue, barColor }: {
	player: TournamentStatPlayer
	rank: number
	leftLabel: string
	leftValue: number
	rightLabel: string
	rightValue: number
	barColor: string
}) {
	const maxPercent = 100
	const barWidth = Math.min((leftValue / maxPercent) * 100, 100)
	return (
		<div className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-accent/40 transition-colors">
			<span className="w-5 text-right text-xs font-medium text-muted-foreground tabular-nums">{rank}</span>
			<div className="flex-1 min-w-0">
				<div className="flex items-center justify-between mb-0.5">
					<span className="font-medium text-sm truncate mr-2">{player.webName}</span>
					<span className="text-[10px] text-muted-foreground shrink-0">{player.teamShortName} · {positionLabel(player.position)}</span>
				</div>
				<div className="flex items-center gap-1.5">
					<div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
						<div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${barWidth}%` }} />
					</div>
				</div>
			</div>
			<div className="flex flex-col items-end shrink-0 w-14">
				<span className="text-xs font-semibold tabular-nums">{leftValue.toFixed(1)}%</span>
				<span className="text-[10px] text-muted-foreground tabular-nums">{rightValue.toFixed(1)}%</span>
			</div>
		</div>
	)
}

function StatList({ data, leftLabel, leftField, rightLabel, rightField, barColor, sortBy }: {
	data: TournamentStatPlayer[]
	leftLabel: string
	leftField: 'selectedByPercent' | 'eoByPercent'
	rightLabel: string
	rightField: 'selectedByPercent' | 'eoByPercent' | 'transfersEvent'
	barColor: string
	sortBy?: 'selectedByPercent' | 'eoByPercent' | 'transfersEvent'
}) {
	const sorted = sortBy ? [...data].sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0)) : data
	if (data.length === 0) {
		return (
			<div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
				No data available.
			</div>
		)
	}
	return (
		<div className="rounded-lg border bg-card overflow-hidden">
			<div className="grid grid-cols-[1.5rem_1fr_3.5rem] items-center gap-x-2 px-3 py-2 bg-muted/40 border-b">
				<span />
				<span className="text-xs font-medium text-muted-foreground">Player</span>
				<div className="flex flex-col items-end">
					<span className="text-[10px] font-medium text-muted-foreground">{leftLabel} %</span>
					<span className="text-[10px] font-medium text-muted-foreground">{rightLabel} %</span>
				</div>
			</div>
			{sorted.map((p, i) => (
				<StatRow
					key={p.id}
					player={p}
					rank={i + 1}
					leftLabel={leftLabel}
					leftValue={p[leftField] ?? 0}
					rightLabel={rightLabel}
					rightValue={p[rightField] ?? 0}
					barColor={barColor}
				/>
			))}
		</div>
	)
}export default function SelectionsPage() {
	const { data: sessionData } = useSession()
	const entryId = sessionData?.user?.fplEntryId ?? 0

	const [tournaments, setTournaments] = useState<Tournament[]>([])
	const [selectedTournamentId, setSelectedTournamentId] = useState<string>('')
	const [currentGameweek, setCurrentGameweek] = useState<number>(1)
	const [selectedGameweek, setSelectedGameweek] = useState<number>(1)
	const [isLoadingTournaments, setIsLoadingTournaments] = useState(true)
	const [isLoadingStats, setIsLoadingStats] = useState(false)
	const [selectionData, setSelectionData] = useState<TournamentStatPlayer[]>([])
	const [captainData, setCaptainData] = useState<TournamentStatPlayer[]>([])
	const [transferInData, setTransferInData] = useState<TournamentStatPlayer[]>([])
	const [transferOutData, setTransferOutData] = useState<TournamentStatPlayer[]>([])

	useEffect(() => {
		Promise.all([
			executeQuery<EntryTournamentsResponse>(GET_ENTRY_TOURNAMENTS, {
				entryId: entryId,
			}),
			executeQuery<EventsResponse>(GET_CURRENT_AND_NEXT_EVENTS),
		])
			.then(([tournamentsData, eventsData]) => {
				const mapped = tournamentsData.entryTournaments.map(
					mapEntryTournamentToLiveTournament
				)
				setTournaments(mapped)
				if (mapped.length > 0) setSelectedTournamentId(mapped[0].id)
				const gw = eventsData.current?.[0]?.id ?? 1
				setCurrentGameweek(gw)
				setSelectedGameweek(gw)
			})
			.catch(() => {})
			.finally(() => setIsLoadingTournaments(false))
	}, [])

	const fetchStats = useCallback(async (tournamentId: number, eventId: number) => {
		setIsLoadingStats(true)
		try {
			const data = await executeQuery<TournamentSelectionStatsResponse>(GET_TOURNAMENT_SELECTION_STATS, {
				tournamentId,
				eventId,
				limit: 10,
			})
			const stats = data.tournamentSelectionStats
			setSelectionData(stats?.mostSelectedPlayers ?? [])
			setCaptainData(stats?.captainSelect ?? [])
			setTransferInData(stats?.mostTransferIn ?? [])
			setTransferOutData(stats?.mostTransferOut ?? [])
		} catch {
			setSelectionData([])
			setCaptainData([])
			setTransferInData([])
			setTransferOutData([])
		} finally {
			setIsLoadingStats(false)
		}
	}, [])

	useEffect(() => {
		const tid = parseInt(selectedTournamentId, 10)
		if (tid && selectedGameweek) fetchStats(tid, selectedGameweek)
	}, [selectedTournamentId, selectedGameweek, fetchStats])

	const selectedTournament = tournaments.find(t => t.id === selectedTournamentId)

	const subtitle = selectedTournament
		? `${selectedTournament.name} · GW${selectedGameweek}`
		: `GW${selectedGameweek}`

	return (
		<RootLayout>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<h1 className="text-3xl font-bold mb-6">Tournament Selections</h1>

				{/* Pickers */}
				<div className="space-y-4 mb-6">
					{isLoadingTournaments ? (
						<div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
							Loading tournaments…
						</div>
					) : tournaments.length > 0 ? (
						<TournamentSelector
							tournaments={tournaments}
							currentTournamentId={selectedTournamentId}
							onTournamentChange={setSelectedTournamentId}
							className="p-4"
						/>
					) : (
						<div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
							No tournaments found
						</div>
					)}

					<GameweekSelector
						currentGameweek={currentGameweek}
						selectedGameweek={selectedGameweek}
						onGameweekChange={setSelectedGameweek}
						disabled={isLoadingStats}
					/>
				</div>

				<Tabs defaultValue="selections">
					<TabsList className="grid grid-cols-4 mb-4 w-full">
						<TabsTrigger value="selections" className="gap-1.5"><Users className="h-4 w-4" /> Selections</TabsTrigger>
						<TabsTrigger value="captain" className="gap-1.5"><Crown className="h-4 w-4" /> Captain</TabsTrigger>
						<TabsTrigger value="transfers-in" className="gap-1.5"><TrendingUp className="h-4 w-4" /> Transfers In</TabsTrigger>
						<TabsTrigger value="transfers-out" className="gap-1.5"><TrendingDown className="h-4 w-4" /> Transfers Out</TabsTrigger>
					</TabsList>

					<div className="max-w-lg mx-auto">
					<TabsContent value="selections">
						{isLoadingStats ? (
							<div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
						) : (
							<StatList data={selectionData} leftLabel="Selected" leftField="selectedByPercent" rightLabel="EO" rightField="eoByPercent" barColor="bg-blue-500" />
						)}
					</TabsContent>

					<TabsContent value="captain">
						{isLoadingStats ? (
							<div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
						) : (
							<StatList data={captainData} leftLabel="Captain" leftField="selectedByPercent" rightLabel="EO" rightField="eoByPercent" barColor="bg-yellow-500" />
						)}
					</TabsContent>

					<TabsContent value="transfers-in">
						{isLoadingStats ? (
							<div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
						) : (
							<StatList data={transferInData} leftLabel="In %" leftField="selectedByPercent" rightLabel="Count" rightField="transfersEvent" barColor="bg-emerald-500" sortBy="transfersEvent" />
						)}
					</TabsContent>

					<TabsContent value="transfers-out">
						{isLoadingStats ? (
							<div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
						) : (
							<StatList data={transferOutData} leftLabel="Out %" leftField="selectedByPercent" rightLabel="Count" rightField="transfersEvent" barColor="bg-red-500" sortBy="transfersEvent" />
						)}
					</TabsContent>
					</div>
				</Tabs>
			</div>
		</RootLayout>
	)
}
