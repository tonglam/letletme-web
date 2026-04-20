'use client'

import { PriceChangeList } from '@/components/data/PriceChangeList'
import { StatsTable } from '@/components/data/StatsTable'
import RootLayout from '@/components/layout/RootLayout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_PLAYERS_FOR_PICKER,
	GET_PLAYER_VALUE_HISTORY,
	GET_PLAYER_VALUES,
	type PlayersForPickerResponse,
	type PlayerDirectoryItem,
	type PlayerValueHistoryItem,
	type PlayerValueHistoryResponse,
	type PlayerValue,
	type PlayerValuesResponse
} from '@/lib/graphql/queries'
import { teamFullNames, type PlayerOption, type Position, type Team } from '@/types/common'
import { format, parseISO } from 'date-fns'
import { useMemo } from 'react'
import { useEffect, useState } from 'react'

interface PriceChange {
	player: PlayerOption
	oldPrice: number
	newPrice: number
	date: string | null
	positionKnown: boolean
	transfersIn?: number
	transfersOut?: number
}

interface PriceHistoryRow {
	date: string
	oldPrice: number
	newPrice: number
	change: number
	movement: string
	transfersIn?: number
	transfersOut?: number
	transferFlow: string
}

type PositionFilter = Position | 'ALL'
type TeamFilter = 'ALL' | string
const DEFAULT_VISIBLE_PLAYER_RESULTS = 10
const PLAYER_PICKER_LIMIT = 1000

interface PickerPlayer {
	id: string
	name: string
	position: Position
	teamShortName: string
	teamName: string
}

const TEAM_NAME_TO_SHORT: Record<string, Team> = {
	Arsenal: 'ARS',
	'Aston Villa': 'AVL',
	Brighton: 'BHA',
	Bournemouth: 'BOU',
	Brentford: 'BRE',
	Chelsea: 'CHE',
	'Crystal Palace': 'CRY',
	Everton: 'EVE',
	Fulham: 'FUL',
	Liverpool: 'LIV',
	'Luton Town': 'LUT',
	'Manchester City': 'MCI',
	'Manchester United': 'MUN',
	Newcastle: 'NEW',
	'Nottingham Forest': 'NFO',
	'Sheffield United': 'SHU',
	Tottenham: 'TOT',
	'West Ham': 'WHU',
	Wolves: 'WOL',
	Burnley: 'BUR'
}

const parsePosition = (position: string): { normalized: Position; known: boolean } => {
	const normalizedInput = position.trim().toLowerCase()

	if (
		normalizedInput === 'gkp' ||
		normalizedInput === 'gk' ||
		normalizedInput === 'goalkeeper' ||
		normalizedInput === '1'
	) {
		return { normalized: 'GKP', known: true }
	}

	if (
		normalizedInput === 'def' ||
		normalizedInput === 'df' ||
		normalizedInput === 'defender' ||
		normalizedInput === '2'
	) {
		return { normalized: 'DEF', known: true }
	}

	if (
		normalizedInput === 'mid' ||
		normalizedInput === 'mf' ||
		normalizedInput === 'midfielder' ||
		normalizedInput === '3'
	) {
		return { normalized: 'MID', known: true }
	}

	if (
		normalizedInput === 'fwd' ||
		normalizedInput === 'fw' ||
		normalizedInput === 'forward' ||
		normalizedInput === 'striker' ||
		normalizedInput === '4'
	) {
		return { normalized: 'FWD', known: true }
	}

	// Keep UI stable for unknown values but mark it unknown so filters don't mis-bucket.
	return { normalized: 'MID', known: false }
}

const normalizeTeam = (teamName: string): Team => TEAM_NAME_TO_SHORT[teamName] ?? 'ALL'

const directoryPositionToShort = (position: PlayerDirectoryItem['position']): Position => {
	switch (position) {
		case 'GOALKEEPER':
			return 'GKP'
		case 'DEFENDER':
			return 'DEF'
		case 'MIDFIELDER':
			return 'MID'
		case 'FORWARD':
			return 'FWD'
		default:
			return 'MID'
	}
}

const toPickerPlayer = (player: PlayerDirectoryItem): PickerPlayer => ({
	id: player.id.toString(),
	name: player.webName,
	position: directoryPositionToShort(player.position),
	teamShortName: player.team.shortName,
	teamName: player.team.name
})

const toPriceChange = (value: PlayerValue): PriceChange => {
	const parsedPosition = parsePosition(value.position)

	return {
		player: {
			id: value.playerId.toString(),
			name: value.playerName,
			position: parsedPosition.normalized,
			team: normalizeTeam(value.teamName),
			price: value.value / 10
		},
		oldPrice: value.lastValue / 10,
		newPrice: value.value / 10,
		date: null,
		positionKnown: parsedPosition.known
	}
}

const toPriceHistoryRow = (item: PlayerValueHistoryItem): PriceHistoryRow => {
	const oldPrice = item.oldValue / 10
	const newPrice = item.newValue / 10
	const computedChange = newPrice - oldPrice
	const movement =
		item.changeType === 'RISE'
			? 'Rise'
			: item.changeType === 'FALL'
			? 'Fall'
			: item.changeType === 'UNCHANGED'
			? 'No change'
			: computedChange > 0
			? 'Rise'
			: computedChange < 0
			? 'Fall'
			: 'No change'

	return {
		date: item.changeDate,
		oldPrice,
		newPrice,
		change: computedChange,
		movement,
		transfersIn: item.transfersIn ?? undefined,
		transfersOut: item.transfersOut ?? undefined,
		transferFlow:
			typeof item.transfersIn === 'number'
				? `${item.transfersIn.toLocaleString()} in`
				: typeof item.transfersOut === 'number'
				? `${item.transfersOut.toLocaleString()} out`
				: '—'
	}
}

const formatHistoryDate = (value: string): string => {
	const parsed = parseISO(value)
	return Number.isNaN(parsed.getTime()) ? value : format(parsed, 'dd MMM yyyy')
}

export default function PriceChangesPage() {
	const [allPriceChanges, setAllPriceChanges] = useState<PriceChange[]>([])
	const [allPlayers, setAllPlayers] = useState<PickerPlayer[]>([])
	const [hasLoadedPlayers, setHasLoadedPlayers] = useState<boolean>(false)
	const [isPlayersLoading, setIsPlayersLoading] = useState<boolean>(false)
	const [playersError, setPlayersError] = useState<string | null>(null)
	const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
	const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL')
	const [teamFilter, setTeamFilter] = useState<TeamFilter>('ALL')
	const [playerSearchTerm, setPlayerSearchTerm] = useState<string>('')
	const [priceChanges, setPriceChanges] = useState<{
		rises: PriceChange[]
		falls: PriceChange[]
	}>({ rises: [], falls: [] })
	const [activeTab, setActiveTab] = useState<string>('daily')
	const [isLoading, setIsLoading] = useState<boolean>(true)
	const [error, setError] = useState<string | null>(null)
	const [playerHistoryRows, setPlayerHistoryRows] = useState<PriceHistoryRow[]>([])
	const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false)
	const [historyError, setHistoryError] = useState<string | null>(null)

	useEffect(() => {
		const fetchPriceChanges = async () => {
			try {
				setIsLoading(true)
				setError(null)

				const data = await executeQuery<PlayerValuesResponse>(GET_PLAYER_VALUES)
				const mapped = data.playerValues.map(toPriceChange)
				setAllPriceChanges(mapped)
				setPriceChanges({
					rises: mapped
						.filter(item => item.newPrice > item.oldPrice)
						.sort((a, b) => b.newPrice - a.newPrice),
					falls: mapped
						.filter(item => item.newPrice < item.oldPrice)
						.sort((a, b) => a.newPrice - b.newPrice)
				})
			} catch (unexpectedError) {
				console.error('Unexpected error loading price changes:', unexpectedError)
				setError('Failed to load price changes from GraphQL.')
				setAllPriceChanges([])
				setPriceChanges({ rises: [], falls: [] })
			} finally {
				setIsLoading(false)
			}
		}

		void fetchPriceChanges()
	}, [])

	const shouldRequestPlayers =
		playerSearchTerm.trim().length > 0 ||
		teamFilter !== 'ALL' ||
		positionFilter !== 'ALL' ||
		selectedPlayerId.length > 0

	useEffect(() => {
		if (!shouldRequestPlayers || hasLoadedPlayers) {
			return
		}

		const fetchPlayersDirectory = async () => {
			try {
				setIsPlayersLoading(true)
				setPlayersError(null)

				const result = await executeQuery<PlayersForPickerResponse>(
					GET_PLAYERS_FOR_PICKER,
					{
						limit: PLAYER_PICKER_LIMIT,
						offset: 0
					}
				)

				const mappedDirectory = result.players
					.map(toPickerPlayer)
					.sort((a, b) => a.name.localeCompare(b.name))

				setAllPlayers(mappedDirectory)
				setHasLoadedPlayers(true)
			} catch (fetchPlayersError) {
				console.error('Failed to fetch players directory:', fetchPlayersError)
				setPlayersError('Failed to load player directory.')
				setAllPlayers([])
			} finally {
				setIsPlayersLoading(false)
			}
		}

		void fetchPlayersDirectory()
	}, [shouldRequestPlayers, hasLoadedPlayers])

	const selectedPlayer = useMemo(
		() => allPlayers.find(player => player.id === selectedPlayerId) ?? null,
		[allPlayers, selectedPlayerId]
	)

	const selectedPlayerPriceSnapshot = useMemo(
		() => allPriceChanges.find(item => item.player.id === selectedPlayerId) ?? null,
		[allPriceChanges, selectedPlayerId]
	)

	const availableTeams = useMemo(() => {
		if (!hasLoadedPlayers) {
			return ['ALL', ...Object.keys(teamFullNames).filter(key => key !== 'ALL').sort()] as string[]
		}

		const teams = new Set<string>(['ALL'])

		allPlayers.forEach(player => {
			if (
				positionFilter === 'ALL' ||
				player.position === positionFilter
			) {
				teams.add(player.teamShortName)
			}
		})

		return Array.from(teams).sort((a, b) => {
			if (a === 'ALL') return -1
			if (b === 'ALL') return 1
			const nameA = teamFullNames[a as Team] ?? a
			const nameB = teamFullNames[b as Team] ?? b
			return nameA.localeCompare(nameB)
		})
	}, [allPlayers, positionFilter, hasLoadedPlayers])

	const filteredPlayerOptions = useMemo(() => {
		const searchLower = playerSearchTerm.trim().toLowerCase()
		const hasSearch = searchLower.length > 0

		// Search acts as a standalone filter: when search is active, ignore team/position filters.
		if (hasSearch) {
			return allPlayers
				.filter(player => player.name.toLowerCase().includes(searchLower))
				.sort((a, b) => a.name.localeCompare(b.name))
		}

		return allPlayers
			.filter(player => {
				const matchesPosition =
					positionFilter === 'ALL' || player.position === positionFilter
				const matchesTeam = teamFilter === 'ALL' || player.teamShortName === teamFilter
				return matchesPosition && matchesTeam
			})
			.sort((a, b) => a.name.localeCompare(b.name))
	}, [allPlayers, positionFilter, teamFilter, playerSearchTerm])

	const shouldUseDefaultLimit = useMemo(
		() => positionFilter === 'ALL' && playerSearchTerm.trim().length === 0,
		[positionFilter, playerSearchTerm]
	)

	const visiblePlayerOptions = useMemo(
		() =>
			shouldUseDefaultLimit
				? filteredPlayerOptions.slice(0, DEFAULT_VISIBLE_PLAYER_RESULTS)
				: filteredPlayerOptions,
		[filteredPlayerOptions, shouldUseDefaultLimit]
	)

	const hasMoreFilteredPlayers =
		shouldUseDefaultLimit &&
		filteredPlayerOptions.length > DEFAULT_VISIBLE_PLAYER_RESULTS
	const playerDirectoryTotal = hasLoadedPlayers ? allPlayers.length : 0

	const selectedPlayerOutsideFilters = useMemo(
		() =>
			Boolean(
				selectedPlayerId &&
					selectedPlayer &&
					!filteredPlayerOptions.some(player => player.id === selectedPlayerId)
			),
		[selectedPlayerId, selectedPlayer, filteredPlayerOptions]
	)

	useEffect(() => {
		if (!availableTeams.includes(teamFilter)) {
			setTeamFilter('ALL')
		}
	}, [availableTeams, teamFilter])

	useEffect(() => {
		if (!selectedPlayerId) {
			setPlayerHistoryRows([])
			setIsHistoryLoading(false)
			setHistoryError(null)
			return
		}

		const fetchHistory = async () => {
			try {
				setIsHistoryLoading(true)
				setHistoryError(null)

				const data = await executeQuery<PlayerValueHistoryResponse>(
					GET_PLAYER_VALUE_HISTORY,
					{
						playerId: Number(selectedPlayerId),
						limit: 30
					}
				)

				const mappedRows = data.playerValueHistory
					.map(toPriceHistoryRow)
					.sort(
						(a, b) =>
							new Date(b.date).getTime() - new Date(a.date).getTime()
					)

				setPlayerHistoryRows(mappedRows)
			} catch (fetchHistoryError) {
				console.error('Failed to fetch player value history:', fetchHistoryError)
				setHistoryError('Failed to load player price history from GraphQL.')
				setPlayerHistoryRows([])
			} finally {
				setIsHistoryLoading(false)
			}
		}

		void fetchHistory()
	}, [selectedPlayerId])

	const hasTransferData = useMemo(
		() =>
			playerHistoryRows.some(
				row =>
					typeof row.transfersIn === 'number' ||
					typeof row.transfersOut === 'number'
			),
		[playerHistoryRows]
	)

	return (
		<RootLayout>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<h1 className="text-3xl font-bold mb-6">Price Changes</h1>

				{error && (
					<div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</div>
				)}

				<div className="mb-6">
					<Card className="p-3 sm:p-4">
						<p className="text-sm text-muted-foreground mb-2">Select Player</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
							<Select
								value={teamFilter}
								onValueChange={value => setTeamFilter(value)}
							>
								<SelectTrigger>
									<SelectValue placeholder="Filter by team" />
								</SelectTrigger>
								<SelectContent>
									{availableTeams.map(team => (
										<SelectItem
											key={team}
											value={team}
										>
											{team === 'ALL' ? 'All Teams' : teamFullNames[team as Team] ?? team}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select
								value={positionFilter}
								onValueChange={value => setPositionFilter(value as PositionFilter)}
							>
								<SelectTrigger>
									<SelectValue placeholder="Filter by position" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">All Positions</SelectItem>
									<SelectItem value="GKP">Goalkeeper</SelectItem>
									<SelectItem value="DEF">Defender</SelectItem>
									<SelectItem value="MID">Midfielder</SelectItem>
									<SelectItem value="FWD">Forward</SelectItem>
								</SelectContent>
							</Select>

							<div className="md:col-span-2">
								<Input
									value={playerSearchTerm}
									onChange={event => setPlayerSearchTerm(event.target.value)}
									placeholder="Type player name to search..."
								/>
							</div>
						</div>

						{selectedPlayerOutsideFilters && selectedPlayer && (
							<div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
								<span>
									Current selected player is outside active filters:{' '}
									{selectedPlayer.name}
								</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => {
										setPositionFilter('ALL')
										setTeamFilter('ALL')
										setPlayerSearchTerm('')
									}}
								>
									Clear filters
								</Button>
							</div>
						)}

						{selectedPlayer && (
							<div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border px-3 py-2">
								<p className="text-xs sm:text-sm text-muted-foreground">
									Selected: <span className="font-medium text-foreground">{selectedPlayer.name}</span>{' '}
									({selectedPlayer.position} | {selectedPlayer.teamShortName})
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										setSelectedPlayerId('')
										setActiveTab('daily')
									}}
								>
									Clear selected player
								</Button>
							</div>
						)}

						<div className="rounded-md border">
							<div className="max-h-64 sm:max-h-72 overflow-y-auto">
								{isPlayersLoading ? (
									<div className="p-3 text-sm text-muted-foreground">
										Loading players...
									</div>
								) : !hasLoadedPlayers ? (
									<div className="p-3 text-sm text-muted-foreground">
										Select team/position or start typing to load players.
									</div>
								) : visiblePlayerOptions.length === 0 ? (
									<div className="p-3 text-sm text-muted-foreground">
										No players match current filters.
									</div>
								) : (
									visiblePlayerOptions.map(change => {
										const isSelected = selectedPlayerId === change.id
										return (
											<button
												key={change.id}
												type="button"
												onClick={() => {
													setSelectedPlayerId(change.id)
													setActiveTab('player')
												}}
												className={`flex w-full items-center justify-between gap-3 border-b px-3 py-3 text-left text-sm last:border-b-0 hover:bg-accent/50 ${
													isSelected ? 'bg-accent' : ''
												}`}
											>
												<span className="font-medium truncate">{change.name}</span>
												<span className="shrink-0 text-xs text-muted-foreground">
													{change.position} | {change.teamShortName}
												</span>
											</button>
										)
									})
								)}
							</div>
						</div>
						<p className="mt-2 text-xs text-muted-foreground">
							Showing {visiblePlayerOptions.length} of {filteredPlayerOptions.length}{' '}
							filtered players ({playerDirectoryTotal} total)
						</p>
						{playersError && (
							<p className="mt-1 text-xs text-destructive">{playersError}</p>
						)}
						{hasMoreFilteredPlayers && (
							<p className="mt-1 text-xs text-muted-foreground">
								Default view shows 10 players. Select a specific position or use
								search to see all matching players.
							</p>
						)}
					</Card>
				</div>

				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="mb-8"
				>
					<TabsList className="grid grid-cols-2 mb-4">
						<TabsTrigger value="daily">Daily Price Changes</TabsTrigger>
						<TabsTrigger
							value="player"
							disabled={!selectedPlayerId}
						>
							Player Price History
						</TabsTrigger>
					</TabsList>

					<TabsContent value="daily">
						<Card className="p-6">
							<h2 className="text-2xl font-bold mb-2">
								Latest Price Changes
							</h2>

							{isLoading ? (
								<div className="text-sm text-muted-foreground">
									Loading price changes...
								</div>
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
									<PriceChangeList
										title="Price Rises"
										changes={priceChanges.rises}
										type="rise"
									/>
									<PriceChangeList
										title="Price Falls"
										changes={priceChanges.falls}
										type="fall"
									/>
								</div>
							)}
						</Card>
					</TabsContent>

					<TabsContent value="player">
						{selectedPlayer ? (
							<Card className="p-6">
								<h2 className="text-2xl font-bold mb-2">
									Price History for {selectedPlayer.name}
								</h2>
								<p className="text-muted-foreground mb-6">
									{selectedPlayer.position} | {selectedPlayer.teamShortName} |
									Current Price:{' '}
									{selectedPlayerPriceSnapshot
										? `£${selectedPlayerPriceSnapshot.newPrice.toFixed(1)}m`
										: 'N/A'}
								</p>

								{historyError && (
									<div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
										{historyError}
									</div>
								)}

								{isHistoryLoading ? (
									<div className="text-sm text-muted-foreground">
										Loading player price history...
									</div>
								) : (
									<StatsTable
										title="Historical Price Changes"
										data={playerHistoryRows}
										columns={[
											{
												key: 'date',
												label: 'Date',
												format: value => formatHistoryDate(value as string)
											},
											{
												key: 'oldPrice',
												label: 'Old Price',
												format: value => `£${(value as number).toFixed(1)}m`
											},
											{
												key: 'newPrice',
												label: 'New Price',
												format: value => `£${(value as number).toFixed(1)}m`
											},
											{
												key: 'movement',
												label: 'Movement'
											},
											{
												key: 'change',
												label: 'Change',
												format: (_, row) => {
													const typedRow = row as PriceHistoryRow
													const change = typedRow.change
													const className =
														change > 0
															? 'text-emerald-600'
															: change < 0
															? 'text-rose-600'
															: 'text-muted-foreground'
													return (
														<span className={className}>
															{change > 0 ? '+' : ''}£{change.toFixed(1)}m
														</span>
													)
												}
											},
											...(hasTransferData
												? [
														{
															key: 'transferFlow',
															label: 'Transfers'
														}
												  ]
												: [])
										]}
									/>
								)}
							</Card>
						) : (
							<Card className="p-6 text-sm text-muted-foreground">
								Select a player to view available price data from GraphQL.
							</Card>
						)}
					</TabsContent>
				</Tabs>

			</div>
		</RootLayout>
	)
}
