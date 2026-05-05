'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import RootLayout from '@/components/layout/RootLayout'
import { PlayerOwnershipFilter } from '@/components/player/PlayerOwnershipFilter'
import { TeamExposureFilter } from '@/components/player/TeamExposureFilter'
import { SearchHeader } from '@/components/tournament/SearchHeader'
import { TournamentHeader } from '@/components/tournament/TournamentHeader'
import { TournamentSelector } from '@/components/tournament/TournamentSelector'
import { TournamentTable } from '@/components/tournament/TournamentTable'
import { Card } from '@/components/ui/card'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_LIVE_POINTS,
	type EntryTournamentsResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse
} from '@/lib/graphql/queries'
import { useEvent } from '@/lib/event-context'
import {
	mapEntryTournamentToLiveTournament
} from '@/lib/tournament/liveTournament'
import { TournamentEntry } from '@/types/tournament'
import { Tournament } from '@/types/tournament'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type LiveTournamentStats = {
	averagePoints: number
	highestPoints: number
	totalEntries: number
}

const mapEventChipToFlags = (eventChip: string | null) => ({
	bench: eventChip === 'BENCH_BOOST',
	triple: eventChip === 'TRIPLE_CAPTAIN',
	wildcard: eventChip === 'WILDCARD'
})

const buildRankMap = (rows: TournamentLiveCalcData[]): Map<number, number> => {
	const sorted = [...rows].sort((a, b) => {
		if (b.liveNetPoints !== a.liveNetPoints) {
			return b.liveNetPoints - a.liveNetPoints
		}
		if (b.liveTotalPoints !== a.liveTotalPoints) {
			return b.liveTotalPoints - a.liveTotalPoints
		}
		return a.entry - b.entry
	})

	return new Map(sorted.map((row, index) => [row.entry, index + 1]))
}

const buildTournamentEntries = (
	currentRows: TournamentLiveCalcData[],
): TournamentEntry[] => {
	const currentRankByEntryId = buildRankMap(currentRows)

	return currentRows.map(row => ({
		id: String(row.entry),
		rank: currentRankByEntryId.get(row.entry) ?? 0,
		previousRank: currentRankByEntryId.get(row.entry) ?? 0,
		teamName: row.entryName ?? `Entry ${row.entry}`,
		managerName: row.playerName ?? '-',
		captainName: row.pickList.find(player => player.isCaptain)?.webName ?? row.captainName ?? 'N/A',
		captainTeam: row.pickList.find(player => player.isCaptain)?.teamShortName ?? 'N/A',
		captainPoints: 0,
		gwPoints: row.livePoints ?? 0,
		gwNetPoints: row.liveNetPoints ?? row.livePoints ?? 0,
		eventCost: row.transferCost ?? 0,
		overallRank: row.overallRank ?? 0,
		livePoints: row.liveNetPoints ?? row.livePoints ?? 0,
		totalPoints: row.liveTotalPoints ?? 0,
		playersPlayed: row.played ?? 0,
		playersToPlay: row.toPlay ?? 0,
		picks: row.pickList.map(player => ({
			element: player.element,
			webName: player.webName,
			teamShortName: player.teamShortName,
			teamName: player.teamName,
			elementTypeName: player.elementTypeName,
			position: player.position,
			isCaptain: player.isCaptain,
			isViceCaptain: player.isViceCaptain
		})),
		chips: mapEventChipToFlags(row.chip)
	}))
}

const buildTournamentStats = (entries: TournamentEntry[]): LiveTournamentStats => {
	if (entries.length === 0) {
		return {
			averagePoints: 0,
			highestPoints: 0,
			totalEntries: 0
		}
	}

	const totalPoints = entries.reduce((sum, entry) => sum + entry.livePoints, 0)
	const highestPoints = entries.reduce(
		(max, entry) => Math.max(max, entry.livePoints),
		entries[0]?.livePoints ?? 0
	)

	return {
		averagePoints: Math.round(totalPoints / entries.length),
		highestPoints,
		totalEntries: entries.length
	}
}

interface TournamentClientProps {
	entryId: number
	initialTournaments?: Tournament[]
	initialSelectedTournamentId?: string
	initialEventId?: number
	initialCurrentRows?: TournamentLiveCalcData[]
}

export default function TournamentClient({
	entryId,
	initialTournaments = [],
	initialSelectedTournamentId = '',
	initialEventId,
	initialCurrentRows = [],
}: TournamentClientProps) {
	const router = useRouter()
	const searchParams = useSearchParams()
	const { currentEventId } = useEvent()

	const [searchQuery, setSearchQuery] = useState<string>('')
	const [chipFilter, setChipFilter] = useState<string>('all')
	const [captainFilter, setCaptainFilter] = useState<string>('all')
	const [tournaments, setTournaments] = useState<Tournament[]>(initialTournaments)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [resultsError, setResultsError] = useState<string | null>(null)
	const [isLoadingTournaments, setIsLoadingTournaments] = useState<boolean>(initialTournaments.length === 0)
	const [isLoadingResults, setIsLoadingResults] = useState<boolean>(false)
	const [currentGameweek] = useState<number | undefined>(currentEventId ?? initialEventId ?? undefined)
	const [selectedGameweek, setSelectedGameweek] = useState<number | undefined>(initialEventId ?? currentEventId ?? undefined)
	const initialEntries = initialCurrentRows.length > 0
		? buildTournamentEntries(initialCurrentRows)
		: []
	const [selectedEntries, setSelectedEntries] = useState<TournamentEntry[]>(initialEntries)
	const [ownershipMatchedEntryIds, setOwnershipMatchedEntryIds] = useState<string[] | null>(null)
	const [teamExposureMatchedEntryIds, setTeamExposureMatchedEntryIds] = useState<string[] | null>(null)
	const [selectedStats, setSelectedStats] = useState<LiveTournamentStats>(
		buildTournamentStats(initialEntries)
	)
	const initialResultsKeyRef = useRef(
		initialCurrentRows.length > 0 && initialSelectedTournamentId && initialEventId
			? `${initialSelectedTournamentId}:${initialEventId}`
			: null
	)

	const tournamentIdFromUrl = searchParams.get('tournamentId')

	const selectedTournament = useMemo(() => {
		const currentTournament = tournaments.find(t => t.id === (tournamentIdFromUrl ?? initialSelectedTournamentId))
		return currentTournament ?? tournaments[0] ?? null
	}, [initialSelectedTournamentId, tournamentIdFromUrl, tournaments])

	useEffect(() => {
		let isCancelled = false
		if (initialTournaments.length > 0) {
			return
		}

		const loadEntryTournaments = async () => {
			try {
				setIsLoadingTournaments(true)
				setLoadError(null)

				const data = await executeQuery<EntryTournamentsResponse>(
					GET_ENTRY_TOURNAMENTS,
					{
						entryId: entryId
					}
				)

				if (isCancelled) {
					return
				}

				const mappedTournaments = data.entryTournaments.map(entryTournament =>
					mapEntryTournamentToLiveTournament(entryTournament)
				)
				setTournaments(mappedTournaments)
			} catch (error) {
				if (isCancelled) {
					return
				}

				const message =
					error instanceof Error
						? error.message
						: 'Failed to load tournaments from API'
				setLoadError(message)
				setTournaments([])
			} finally {
				if (!isCancelled) {
					setIsLoadingTournaments(false)
				}
			}
		}

		loadEntryTournaments()

		return () => {
			isCancelled = true
		}
	}, [entryId, initialTournaments.length])


	useEffect(() => {
		if (!selectedTournament || selectedGameweek === undefined) {
			const resetTimer = window.setTimeout(() => {
				setSelectedEntries([])
				setSelectedStats({ averagePoints: 0, highestPoints: 0, totalEntries: 0 })
			}, 0)
			return () => window.clearTimeout(resetTimer)
		}
		const resultsKey = `${selectedTournament.id}:${selectedGameweek}`
		if (initialResultsKeyRef.current === resultsKey) {
			initialResultsKeyRef.current = null
			return
		}

		let isCancelled = false

		const loadTournamentResults = async () => {
			try {
				setIsLoadingResults(true)
				setResultsError(null)

				const tournamentId = Number(selectedTournament.id)
				const currentResponse = await executeQuery<TournamentLivePointsResponse>(
					GET_TOURNAMENT_LIVE_POINTS,
					{
						tournamentId,
						eventId: selectedGameweek
					}
				)

				if (isCancelled) {
					return
				}

				const currentBatch = currentResponse.calcLivePointsForTournament
				if (currentBatch.meta.failedCount > 0) {
					setResultsError(
						`Partial results: ${currentBatch.meta.failedCount}/${currentBatch.meta.totalEntries} entries failed to calculate.`
					)
				}

				const entries = buildTournamentEntries(
					currentBatch.results ?? []
				)

				setSelectedEntries(entries)
				setSelectedStats(buildTournamentStats(entries))
			} catch (error) {
				if (isCancelled) {
					return
				}

				const message =
					error instanceof Error
						? error.message
						: 'Failed to load tournament standings from API'
				setResultsError(message)
				setSelectedEntries([])
				setSelectedStats({ averagePoints: 0, highestPoints: 0, totalEntries: 0 })
			} finally {
				if (!isCancelled) {
					setIsLoadingResults(false)
				}
			}
		}

		loadTournamentResults()

		return () => {
			isCancelled = true
		}
	}, [selectedGameweek, selectedTournament])

	useEffect(() => {
		const resetTimer = window.setTimeout(() => {
			setOwnershipMatchedEntryIds(null)
			setTeamExposureMatchedEntryIds(null)
		}, 0)
		return () => window.clearTimeout(resetTimer)
	}, [selectedGameweek, selectedTournament?.id])

	const displayGameweek = selectedGameweek ?? currentGameweek ?? 1
	const captainOptions = useMemo(
		() =>
			Array.from(
				new Set(
					selectedEntries
						.map(entry => entry.captainName)
						.filter(name => !!name && name !== 'N/A')
				)
			).sort((a, b) => a.localeCompare(b)),
		[selectedEntries]
	)

	const handleOwnershipMatchedEntryIdsChange = useCallback((entryIds: string[] | null) => {
		setOwnershipMatchedEntryIds(entryIds)
	}, [])

	const handleTeamExposureMatchedEntryIdsChange = useCallback((entryIds: string[] | null) => {
		setTeamExposureMatchedEntryIds(entryIds)
	}, [])

	const ownershipMatchedEntrySet = useMemo(
		() => ownershipMatchedEntryIds ? new Set(ownershipMatchedEntryIds) : null,
		[ownershipMatchedEntryIds]
	)

	const teamExposureMatchedEntrySet = useMemo(
		() => teamExposureMatchedEntryIds ? new Set(teamExposureMatchedEntryIds) : null,
		[teamExposureMatchedEntryIds]
	)

	const filteredEntries = useMemo(() => {
		const query = searchQuery.trim().toLowerCase()
		const captainQuery = captainFilter.trim().toLowerCase()
		return selectedEntries.filter(entry => {
			const matchesSearch =
				query.length === 0 ||
				entry.teamName.toLowerCase().includes(query) ||
				entry.managerName.toLowerCase().includes(query)

			const matchesChip =
				chipFilter === 'all' ||
				(chipFilter === 'triple' && entry.chips.triple) ||
				(chipFilter === 'bench' && entry.chips.bench) ||
				(chipFilter === 'wildcard' && entry.chips.wildcard)

			const matchesCaptain =
				captainFilter === 'all' ||
				captainQuery.length === 0 ||
				entry.captainName.toLowerCase() === captainQuery

			const matchesOwnership =
				ownershipMatchedEntrySet === null ||
				ownershipMatchedEntrySet.has(entry.id)

			const matchesTeamExposure =
				teamExposureMatchedEntrySet === null ||
				teamExposureMatchedEntrySet.has(entry.id)

			return matchesSearch && matchesChip && matchesCaptain && matchesOwnership && matchesTeamExposure
		})
	}, [captainFilter, chipFilter, ownershipMatchedEntrySet, teamExposureMatchedEntrySet, searchQuery, selectedEntries])

	return (
		<RootLayout>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				{loadError && (
					<Card className="p-4 mb-6 border-destructive/30 bg-destructive/5 text-destructive text-sm">
						{loadError}
					</Card>
				)}

				{resultsError && (
					<Card className="p-4 mb-6 border-destructive/30 bg-destructive/5 text-destructive text-sm">
						{resultsError}
					</Card>
				)}

				{tournaments.length > 0 && selectedTournament && (
					<TournamentSelector
						tournaments={tournaments}
						currentTournamentId={selectedTournament.id}
						onTournamentChange={id => {
							router.push(`/live/tournament?tournamentId=${id}`)
						}}
					/>
				)}

				<Card className="p-4 mb-6">
					{currentGameweek !== undefined ? (
						<GameweekSelector
							onGameweekChange={setSelectedGameweek}
							currentGameweek={currentGameweek}
							selectedGameweek={selectedGameweek}
							disabled={isLoadingResults}
						/>
					) : (
						<p className="text-sm text-muted-foreground">Loading gameweek...</p>
					)}
				</Card>

				{isLoadingTournaments && (
					<Card className="p-6 text-sm text-muted-foreground">
						Loading tournaments...
					</Card>
				)}

				{!isLoadingTournaments && !selectedTournament && (
					<Card className="p-6 text-sm text-muted-foreground">
						No tournaments available for this account yet.
					</Card>
				)}

				{selectedTournament && (
					<>
						<TournamentHeader
							name={selectedTournament.name}
							gameweek={displayGameweek}
							averagePoints={selectedStats.averagePoints}
							highestPoints={selectedStats.highestPoints}
							totalEntries={selectedStats.totalEntries || selectedTournament.totalEntries}
							tournamentId={selectedTournament.id}
						/>

						<SearchHeader
							searchQuery={searchQuery}
							setSearchQuery={setSearchQuery}
							captainOptions={captainOptions}
							chipFilter={chipFilter}
							onChipFilterChange={setChipFilter}
							captainFilter={captainFilter}
							onCaptainFilterChange={setCaptainFilter}
						/>

						{isLoadingResults ? (
							<Card className="p-6 text-sm text-muted-foreground mb-6">
								Loading tournament standings...
							</Card>
						) : (
							<>
								<PlayerOwnershipFilter
									key={`${selectedTournament.id}-${displayGameweek}`}
									entries={selectedEntries}
									onMatchedEntryIdsChange={handleOwnershipMatchedEntryIdsChange}
								/>

								<TeamExposureFilter
									key={`team-${selectedTournament.id}-${displayGameweek}`}
									entries={selectedEntries}
									onMatchedEntryIdsChange={handleTeamExposureMatchedEntryIdsChange}
								/>

								<TournamentTable
									entries={filteredEntries}
									searchQuery=""
									tournamentId={selectedTournament.id}
									gameweek={displayGameweek}
								/>
							</>
						)}
					</>
				)}
			</div>
		</RootLayout>
	)
}
