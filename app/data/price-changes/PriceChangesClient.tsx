'use client'

import { PriceChangeList } from '@/components/data/PriceChangeList'
import { StatsTable } from '@/components/data/StatsTable'
import PageShell from '@/components/layout/PageShell'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
	GET_PLAYER_VALUE_HISTORY,
	type PlayerValue,
	type PlayerValueHistoryItem,
	type PlayerValueHistoryResponse,
} from '@/lib/graphql/operations/prices'
import {
	GET_PLAYERS_FOR_PICKER,
	type PlayerDirectoryItem,
	type PlayersForPickerResponse,
} from '@/lib/graphql/operations/players'
import {
	teamFullNames,
	type PlayerOption,
	type Position,
	type Team
} from '@/types/common'
import { X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

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
	movement: 'rise' | 'fall' | 'noChange'
	transfersIn?: number
	transfersOut?: number
	transferFlow: 'in' | 'out' | 'none'
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
	if (['gkp', 'gk', 'goalkeeper', '1'].includes(normalizedInput)) return { normalized: 'GKP', known: true }
	if (['def', 'df', 'defender', '2'].includes(normalizedInput)) return { normalized: 'DEF', known: true }
	if (['mid', 'mf', 'midfielder', '3'].includes(normalizedInput)) return { normalized: 'MID', known: true }
	if (['fwd', 'fw', 'forward', 'striker', '4'].includes(normalizedInput)) return { normalized: 'FWD', known: true }
	return { normalized: 'MID', known: false }
}

const normalizeTeam = (teamName: string): Team => TEAM_NAME_TO_SHORT[teamName] ?? 'ALL'

const directoryPositionToShort = (position: PlayerDirectoryItem['position']): Position => {
	switch (position) {
		case 'GOALKEEPER': return 'GKP'
		case 'DEFENDER': return 'DEF'
		case 'MIDFIELDER': return 'MID'
		case 'FORWARD': return 'FWD'
		default: return 'MID'
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
		item.changeType === 'RISE' ? 'rise'
		: item.changeType === 'FALL' ? 'fall'
		: item.changeType === 'UNCHANGED' ? 'noChange'
		: computedChange > 0 ? 'rise'
		: computedChange < 0 ? 'fall'
		: 'noChange'
	return {
		date: item.changeDate,
		oldPrice,
		newPrice,
		change: computedChange,
		movement,
		transfersIn: item.transfersIn ?? undefined,
		transfersOut: item.transfersOut ?? undefined,
		transferFlow:
			typeof item.transfersIn === 'number' ? 'in'
			: typeof item.transfersOut === 'number' ? 'out'
			: 'none'
	}
}

const computeRisesFalls = (playerValues: PlayerValue[]) => {
	const mapped = playerValues.map(toPriceChange)
	return {
		all: mapped,
		rises: mapped.filter(item => item.newPrice > item.oldPrice).sort((a, b) => b.newPrice - a.newPrice),
		falls: mapped.filter(item => item.newPrice < item.oldPrice).sort((a, b) => a.newPrice - b.newPrice),
	}
}

interface PriceChangesClientProps {
	initialPlayerValues: PlayerValue[] | null
	initialError: string | null
}

export default function PriceChangesClient({
	initialPlayerValues,
	initialError
}: PriceChangesClientProps) {
	const t = useTranslations('PriceChanges')
	const formatter = useFormatter()
	const allPriceChanges = useMemo(
		() => initialPlayerValues?.map(toPriceChange) ?? [],
		[initialPlayerValues]
	)
	const priceChanges = useMemo(() => {
		if (!initialPlayerValues) return { rises: [] as PriceChange[], falls: [] as PriceChange[] }
		const { rises, falls } = computeRisesFalls(initialPlayerValues)
		return { rises, falls }
	}, [initialPlayerValues])
	const [allPlayers, setAllPlayers] = useState<PickerPlayer[]>([])
	const [hasLoadedPlayers, setHasLoadedPlayers] = useState<boolean>(false)
	const [isPlayersLoading, setIsPlayersLoading] = useState<boolean>(false)
	const [playersError, setPlayersError] = useState<string | null>(null)
	const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
	const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL')
	const [teamFilter, setTeamFilter] = useState<TeamFilter>('ALL')
	const [playerSearchTerm, setPlayerSearchTerm] = useState<string>('')
	const [activeTab, setActiveTab] = useState<string>('daily')
	const [playerHistoryRows, setPlayerHistoryRows] = useState<PriceHistoryRow[]>([])
	const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false)
	const [historyError, setHistoryError] = useState<string | null>(null)

	const shouldRequestPlayers =
		playerSearchTerm.trim().length > 0 ||
		teamFilter !== 'ALL' ||
		positionFilter !== 'ALL' ||
		selectedPlayerId.length > 0

	useEffect(() => {
		if (!shouldRequestPlayers || hasLoadedPlayers) return
		const fetchPlayersDirectory = async () => {
			try {
				setIsPlayersLoading(true)
				setPlayersError(null)
				const result = await executeQuery<PlayersForPickerResponse>(GET_PLAYERS_FOR_PICKER, {
					limit: PLAYER_PICKER_LIMIT,
					offset: 0
				})
				const mappedDirectory = result.players
					.map(toPickerPlayer)
					.sort((a, b) => a.name.localeCompare(b.name))
				setAllPlayers(mappedDirectory)
				setHasLoadedPlayers(true)
			} catch (fetchPlayersError) {
				console.error('Failed to fetch players directory:', fetchPlayersError)
				setPlayersError(t('directoryFailed'))
				setAllPlayers([])
			} finally {
				setIsPlayersLoading(false)
			}
		}
		void fetchPlayersDirectory()
	}, [shouldRequestPlayers, hasLoadedPlayers, t])

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
			if (positionFilter === 'ALL' || player.position === positionFilter) teams.add(player.teamShortName)
		})
		return Array.from(teams).sort((a, b) => {
			if (a === 'ALL') return -1
			if (b === 'ALL') return 1
			return (teamFullNames[a as Team] ?? a).localeCompare(teamFullNames[b as Team] ?? b)
		})
	}, [allPlayers, positionFilter, hasLoadedPlayers])

	const filteredPlayerOptions = useMemo(() => {
		const searchLower = playerSearchTerm.trim().toLowerCase()
		const effectiveTeamFilter = availableTeams.includes(teamFilter) ? teamFilter : 'ALL'
		if (searchLower.length > 0) {
			return allPlayers
				.filter(player => player.name.toLowerCase().includes(searchLower))
				.sort((a, b) => a.name.localeCompare(b.name))
		}
		return allPlayers
			.filter(player => {
				const matchesPosition = positionFilter === 'ALL' || player.position === positionFilter
				const matchesTeam = effectiveTeamFilter === 'ALL' || player.teamShortName === effectiveTeamFilter
				return matchesPosition && matchesTeam
			})
			.sort((a, b) => a.name.localeCompare(b.name))
	}, [allPlayers, availableTeams, positionFilter, teamFilter, playerSearchTerm])

	const shouldUseDefaultLimit = positionFilter === 'ALL' && playerSearchTerm.trim().length === 0

	const visiblePlayerOptions = useMemo(
		() => shouldUseDefaultLimit ? filteredPlayerOptions.slice(0, DEFAULT_VISIBLE_PLAYER_RESULTS) : filteredPlayerOptions,
		[filteredPlayerOptions, shouldUseDefaultLimit]
	)

	const hasMoreFilteredPlayers = shouldUseDefaultLimit && filteredPlayerOptions.length > DEFAULT_VISIBLE_PLAYER_RESULTS
	const playerDirectoryTotal = hasLoadedPlayers ? allPlayers.length : 0
	const selectTeamValue = availableTeams.includes(teamFilter) ? teamFilter : 'ALL'

	const selectedPlayerOutsideFilters = useMemo(
		() => Boolean(selectedPlayerId && selectedPlayer && !filteredPlayerOptions.some(player => player.id === selectedPlayerId)),
		[selectedPlayerId, selectedPlayer, filteredPlayerOptions]
	)

	useEffect(() => {
		if (!selectedPlayerId) {
			const resetTimer = window.setTimeout(() => {
				setPlayerHistoryRows([])
				setIsHistoryLoading(false)
				setHistoryError(null)
			}, 0)
			return () => window.clearTimeout(resetTimer)
		}
		let cancelled = false
		void Promise.resolve().then(async () => {
			if (cancelled) return
			try {
				setIsHistoryLoading(true)
				setHistoryError(null)
				const data = await executeQuery<PlayerValueHistoryResponse>(GET_PLAYER_VALUE_HISTORY, {
					playerId: Number(selectedPlayerId),
				})
				if (cancelled) return
				const mappedRows = data.playerValueHistory
					.slice(0, 30)
					.map(toPriceHistoryRow)
					.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
				setPlayerHistoryRows(mappedRows)
			} catch (fetchHistoryError) {
				if (cancelled) return
				console.error('Failed to fetch player value history:', fetchHistoryError)
				setHistoryError(t('historyFailed'))
				setPlayerHistoryRows([])
			} finally {
				if (!cancelled) {
					setIsHistoryLoading(false)
				}
			}
		})
		return () => {
			cancelled = true
		}
	}, [selectedPlayerId, t])

	const hasTransferData = useMemo(
		() => playerHistoryRows.some(row => typeof row.transfersIn === 'number' || typeof row.transfersOut === 'number'),
		[playerHistoryRows]
	)

	const hasDailyPriceChanges = priceChanges.rises.length > 0 || priceChanges.falls.length > 0

	const currentPlayerPrice = useMemo(() => {
		if (selectedPlayerPriceSnapshot) return selectedPlayerPriceSnapshot.newPrice
		if (playerHistoryRows.length > 0) return playerHistoryRows[0].newPrice
		return null
	}, [playerHistoryRows, selectedPlayerPriceSnapshot])

	const formatHistoryDate = (value: string): string => {
		const parsed = new Date(value)
		return Number.isNaN(parsed.getTime())
			? value
			: formatter.dateTime(parsed, { day: '2-digit', month: 'short', year: 'numeric' })
	}

	return (
		<PageShell>
			<div className="container max-w-4xl mx-auto px-4 py-8">
				<h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
				{initialError && (
					<Alert variant="destructive" className="mb-6">
						<AlertTitle>{t('dataUnavailable')}</AlertTitle>
						<AlertDescription>{initialError}</AlertDescription>
					</Alert>
				)}

				<div className="mb-6">
					<Card className="p-3 sm:p-4">
						<p className="text-sm text-muted-foreground mb-2">{t('selectPlayer')}</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
							<Select value={selectTeamValue} onValueChange={value => setTeamFilter(value)}>
								<SelectTrigger aria-label={t('filterTeam')}>
									<SelectValue placeholder={t('filterByTeam')} />
								</SelectTrigger>
								<SelectContent>
									{availableTeams.map(team => (
										<SelectItem key={team} value={team}>
											{team === 'ALL' ? t('allTeams') : (teamFullNames[team as Team] ?? team)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select value={positionFilter} onValueChange={value => setPositionFilter(value as PositionFilter)}>
								<SelectTrigger aria-label={t('filterPosition')}>
									<SelectValue placeholder={t('filterByPosition')} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">{t('allPositions')}</SelectItem>
									<SelectItem value="GKP">{t('goalkeeper')}</SelectItem>
									<SelectItem value="DEF">{t('defender')}</SelectItem>
									<SelectItem value="MID">{t('midfielder')}</SelectItem>
									<SelectItem value="FWD">{t('forward')}</SelectItem>
								</SelectContent>
							</Select>

							<div className="md:col-span-2 relative">
								<Input
									aria-label={t('searchPlayers')}
									value={playerSearchTerm}
									onChange={event => setPlayerSearchTerm(event.target.value)}
									placeholder={t('searchPlaceholder')}
									className={playerSearchTerm ? 'pr-10' : ''}
								/>
								{playerSearchTerm && (
									<button
										type="button"
										aria-label={t('clearSearch')}
										onClick={() => setPlayerSearchTerm('')}
										className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									>
										<X className="h-4 w-4" />
									</button>
								)}
							</div>
						</div>

						{selectedPlayerOutsideFilters && selectedPlayer && (
							<div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
								<span>{t('outsideFilters', { name: selectedPlayer.name })}</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => { setPositionFilter('ALL'); setTeamFilter('ALL'); setPlayerSearchTerm('') }}
								>
									{t('clearFilters')}
								</Button>
							</div>
						)}

						{selectedPlayer && (
							<div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border px-3 py-2">
								<p className="text-xs sm:text-sm text-muted-foreground">
									{t('selected', {
										name: selectedPlayer.name,
										position: selectedPlayer.position,
										team: selectedPlayer.teamShortName,
									})}
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => { setSelectedPlayerId(''); setActiveTab('daily') }}
								>
									{t('clearSelected')}
								</Button>
							</div>
						)}

						<div className="rounded-md border">
							<div className="max-h-64 sm:max-h-72 overflow-y-auto">
								{isPlayersLoading ? (
									<div className="p-3 text-sm text-muted-foreground">{t('loadingPlayers')}</div>
								) : !hasLoadedPlayers ? (
									<div className="p-3 text-sm text-muted-foreground">
										{t('loadPrompt')}
									</div>
								) : visiblePlayerOptions.length === 0 ? (
									<div className="p-3 text-sm text-muted-foreground">{t('noMatches')}</div>
								) : (
									visiblePlayerOptions.map(change => {
										const isSelected = selectedPlayerId === change.id
										return (
											<button
												key={change.id}
												type="button"
												onClick={() => { setSelectedPlayerId(change.id); setActiveTab('player') }}
												className={`flex w-full items-center justify-between gap-3 border-b px-3 py-3 text-left text-sm last:border-b-0 hover:bg-accent/50 ${isSelected ? 'bg-accent' : ''}`}
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
							{t('resultCount', {
								visible: visiblePlayerOptions.length,
								filtered: filteredPlayerOptions.length,
								total: playerDirectoryTotal,
							})}
						</p>
						{playersError && <p className="mt-1 text-xs text-destructive">{playersError}</p>}
						{hasMoreFilteredPlayers && (
							<p className="mt-1 text-xs text-muted-foreground">
								{t('defaultLimit')}
							</p>
						)}
					</Card>
				</div>

				<Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
					<TabsList className="grid grid-cols-2 mb-4">
						<TabsTrigger value="daily">{t('dailyTab')}</TabsTrigger>
						<TabsTrigger value="player" disabled={!selectedPlayerId}>
							{t('historyTab')}
						</TabsTrigger>
					</TabsList>

					<TabsContent value="daily">
						<Card className="p-6">
							<h2 className="text-2xl font-bold mb-2">{t('latest')}</h2>
							{!hasDailyPriceChanges ? (
								<div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
									{initialError
										? t('serviceRecovery')
										: t('noneToday')}
								</div>
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
									<PriceChangeList title={t('rises')} changes={priceChanges.rises} type="rise" />
									<PriceChangeList title={t('falls')} changes={priceChanges.falls} type="fall" />
								</div>
							)}
						</Card>
					</TabsContent>

					<TabsContent value="player">
						{selectedPlayer ? (
							<Card className="p-6">
								<h2 className="text-2xl font-bold mb-2">{t('historyFor', { name: selectedPlayer.name })}</h2>
								<p className="text-muted-foreground mb-6">
									{t('playerSummary', {
										position: selectedPlayer.position,
										team: selectedPlayer.teamShortName,
										price: currentPlayerPrice !== null ? `£${currentPlayerPrice.toFixed(1)}m` : '—',
									})}
								</p>

								{historyError && (
									<div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
										{historyError}
									</div>
								)}

								{isHistoryLoading ? (
									<div className="text-sm text-muted-foreground">{t('loadingHistory')}</div>
								) : playerHistoryRows.length === 0 ? (
									<div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
										{t('noHistory', { name: selectedPlayer.name })}
									</div>
								) : (
									<StatsTable
										title={t('historical')}
										data={playerHistoryRows}
										columns={[
											{ key: 'date', label: t('date'), format: value => formatHistoryDate(value as string) },
											{ key: 'oldPrice', label: t('oldPrice'), format: value => `£${(value as number).toFixed(1)}m` },
											{ key: 'newPrice', label: t('newPrice'), format: value => `£${(value as number).toFixed(1)}m` },
											{ key: 'movement', label: t('movement'), format: value => t(value as 'rise' | 'fall' | 'noChange') },
											{
												key: 'change',
												label: t('change'),
												format: (_, row) => {
													const typedRow = row as unknown as PriceHistoryRow
													const change = typedRow.change
													const className =
														change > 0 ? 'text-emerald-600'
														: change < 0 ? 'text-rose-600'
														: 'text-muted-foreground'
													return <span className={className}>{change > 0 ? '+' : ''}£{change.toFixed(1)}m</span>
												}
											},
											...(hasTransferData ? [{
												key: 'transferFlow',
												label: t('transfers'),
												format: (_value: unknown, row: Record<string, unknown>) => {
													const typedRow = row as unknown as PriceHistoryRow
													if (typedRow.transferFlow === 'in') return t('transfersInShort', { count: formatter.number(typedRow.transfersIn ?? 0) })
													if (typedRow.transferFlow === 'out') return t('transfersOutShort', { count: formatter.number(typedRow.transfersOut ?? 0) })
													return '—'
												},
											}] : [])
										]}
									/>
								)}
							</Card>
						) : (
							<Card className="p-6 text-sm text-muted-foreground">
								{t('selectForHistory')}
							</Card>
						)}
					</TabsContent>
				</Tabs>
			</div>
		</PageShell>
	)
}
