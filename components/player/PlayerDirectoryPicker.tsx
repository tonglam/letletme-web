'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { executeQuery, GraphQLRequestError } from '@/lib/graphql-client'
import {
	GET_TEAMS_FOR_PICKER,
	SEARCH_PLAYERS_FOR_PICKER,
	type PlayerDirectoryItem,
	type PlayerPickerOwnershipBand,
	type PlayerSearchForPickerResponse,
	type TeamsForPickerResponse
} from '@/lib/graphql/operations/players'
import {
	filterDirectoryPlayers,
	formatMaxPriceLabel,
	MAX_PRICE_OPTIONS,
	OWN_BANDS,
	sortDirectoryPlayers,
	type MaxPrice,
	type OwnBand,
	type PlayerDirectorySort
} from '@/lib/player-directory-filters'
import {
	buildPlayerDirectoryQueryKey,
	type PlayerDirectorySeed
} from '@/lib/player-directory-seed'
import { resolveTeamDisplayName } from '@/lib/team-display'
import { type Position } from '@/types/common'
import { RotateCcw, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

type PositionFilter = Position | 'ALL'
type TeamFilter = 'ALL' | string

interface BrowseFilterSnapshot {
	teamFilter: TeamFilter
	positionFilter: PositionFilter
	positionFilterExplicit: boolean
	maxPrice: MaxPrice
	ownBand: OwnBand
}

const PLAYER_PICKER_PAGE_SIZE = 20
const PLAYER_PICKER_DEBOUNCE_MS = 300
// A non-empty name fragment is a valid FPL search. The backend safely
// normalizes short fragments, so do not silently turn a one-character query
// into an unfiltered roster request.
const MIN_SEARCH_LENGTH = 1

export interface PlayerDirectoryOption {
	id: string
	name: string
	position: Position
	teamShortName: string
	teamName: string
	price?: number
	selectedByPercent?: number | null
	totalPoints?: number | null
	form?: number | null
}

interface TeamDirectoryOption {
	id: number
	shortName: string
	name: string
}

interface PlayerDirectoryFilter {
	teamId?: number
	position?: PlayerDirectoryItem['position']
	maxPrice?: number
}

interface PlayerDirectoryPickerProps {
	onSelect: (player: PlayerDirectoryOption) => void
	excludedPlayerIds?: string[]
	className?: string
	defaultPosition?: Position | null
	statsAvailable?: boolean
	seed?: PlayerDirectorySeed
}

const directoryPositionToShort = (
	position: PlayerDirectoryItem['position']
): Position => {
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

const shortPositionToDirectory = (
	position: Exclude<PositionFilter, 'ALL'>
): PlayerDirectoryItem['position'] => {
	switch (position) {
		case 'GKP':
			return 'GOALKEEPER'
		case 'DEF':
			return 'DEFENDER'
		case 'MID':
			return 'MIDFIELDER'
		case 'FWD':
			return 'FORWARD'
	}
}

const formatPickerPrice = (raw: number | undefined) =>
	`£${((raw ?? 0) / 10).toFixed(1)}m`

const pickerSortToGraphql = (sort: PlayerDirectorySort) => {
	switch (sort) {
		case 'name':
			return 'NAME_ASC'
		case 'form_desc':
			return 'FORM_DESC'
		case 'price_asc':
			return 'PRICE_ASC'
		case 'price_desc':
			return 'PRICE_DESC'
		case 'own_desc':
			return 'OWNERSHIP_DESC'
		case 'total_desc':
		default:
			return 'TOTAL_POINTS_DESC'
	}
}

const ownBandToGraphql = (band: OwnBand): PlayerPickerOwnershipBand | null => {
	switch (band) {
		case 'LE5':
			return 'LE5'
		case '5_15':
			return 'GT5_LE15'
		case '15_40':
			return 'GT15_LE40'
		case 'GE40':
			return 'GT40'
		case 'ANY':
		default:
			return null
	}
}

const toPickerPlayer = (
	player: PlayerDirectoryItem
): PlayerDirectoryOption => ({
	id: player.id.toString(),
	name: player.webName,
	position: directoryPositionToShort(player.position),
	teamShortName: player.team.shortName,
	teamName: player.team.name,
	price: player.price,
	selectedByPercent: player.selectedByPercent,
	totalPoints: player.totalPoints,
	form: player.form
})

const toTeamOptions = (
	teams: PlayerDirectorySeed['teams']
): TeamDirectoryOption[] =>
	teams
		.map(team => ({
			id: team.id,
			name: team.name,
			shortName: team.shortName
		}))
		.sort((a, b) =>
			resolveTeamDisplayName(a.shortName, a.name).localeCompare(
				resolveTeamDisplayName(b.shortName, b.name)
			)
		)

const isCancelledRequest = (error: unknown) =>
	error instanceof GraphQLRequestError && error.code === 'REQUEST_CANCELLED'

const OWN_BAND_LABEL_KEYS: Record<
	OwnBand,
	'ownBandAny' | 'ownBandLe5' | 'ownBand5_15' | 'ownBand15_40' | 'ownBandGe40'
> = {
	ANY: 'ownBandAny',
	LE5: 'ownBandLe5',
	'5_15': 'ownBand5_15',
	'15_40': 'ownBand15_40',
	GE40: 'ownBandGe40'
}

export function PlayerDirectoryPicker({
	onSelect,
	excludedPlayerIds = [],
	className = '',
	defaultPosition = null,
	statsAvailable = true,
	seed
}: PlayerDirectoryPickerProps) {
	const t = useTranslations('PlayerDirectory')
	const [teams, setTeams] = useState<TeamDirectoryOption[]>(() =>
		seed ? toTeamOptions(seed.teams) : []
	)
	const [players, setPlayers] = useState<PlayerDirectoryOption[]>(() =>
		seed ? seed.players.map(toPickerPlayer) : []
	)
	const [totalPlayers, setTotalPlayers] = useState(seed?.totalCount ?? 0)
	const [nextPlayersCursor, setNextPlayersCursor] = useState<number | null>(
		seed?.playersState === 'ready' ? seed.nextCursor : null
	)
	const [nextPlayersQueryKey, setNextPlayersQueryKey] = useState<string | null>(
		seed?.playersState === 'ready' ? seed.queryKey : null
	)
	const [isTeamsLoading, setIsTeamsLoading] = useState(false)
	const [isPlayersLoading, setIsPlayersLoading] = useState(false)
	const [isMorePlayersLoading, setIsMorePlayersLoading] = useState(false)
	const [morePlayersError, setMorePlayersError] = useState<string | null>(null)
	const [teamsError, setTeamsError] = useState<string | null>(() =>
		seed?.teamsState === 'unavailable' ? t('teamsFailed') : null
	)
	const [error, setError] = useState<string | null>(() =>
		seed?.playersState === 'unavailable' ? t('playersFailed') : null
	)
	const [rateLimitSeconds, setRateLimitSeconds] = useState(0)
	const [positionFilter, setPositionFilter] = useState<PositionFilter>(
		defaultPosition ?? 'ALL'
	)
	const [positionFilterExplicit, setPositionFilterExplicit] = useState(false)
	const [teamFilter, setTeamFilter] = useState<TeamFilter>('ALL')
	const [searchTerm, setSearchTerm] = useState('')
	const [maxPrice, setMaxPrice] = useState<MaxPrice>(null)
	const [ownBand, setOwnBand] = useState<OwnBand>('ANY')
	const [sortBy, setSortBy] = useState<PlayerDirectorySort>(
		statsAvailable ? 'total_desc' : 'own_desc'
	)
	const browseFiltersBeforeSearchRef = useRef<BrowseFilterSnapshot | null>(null)
	const playerRequestVersionRef = useRef(0)
	const nextPlayersQueryKeyRef = useRef<string | null>(
		seed?.playersState === 'ready' ? seed.queryKey : null
	)
	const initialSeedQueryKeyRef = useRef<string | null>(
		seed?.playersState === 'ready' ? seed.queryKey : null
	)

	useEffect(() => {
		if (seed?.teamsState === 'ready') return
		let isCancelled = false
		const controller = new AbortController()

		const fetchTeams = async () => {
			try {
				setIsTeamsLoading(true)
				setTeamsError(null)
				const result = await executeQuery<TeamsForPickerResponse>(
					GET_TEAMS_FOR_PICKER,
					undefined,
					{
						signal: controller.signal
					}
				)

				if (isCancelled) return

				setTeams(toTeamOptions(result.teams))
			} catch (fetchError) {
				if (isCancelledRequest(fetchError)) return
				console.error('Failed to fetch teams directory:', fetchError)

				if (!isCancelled) {
					setTeamsError(t('teamsFailed'))
					setTeams([])
				}
			} finally {
				if (!isCancelled) {
					setIsTeamsLoading(false)
				}
			}
		}

		void fetchTeams()

		return () => {
			isCancelled = true
			controller.abort()
		}
	}, [seed, t])

	useEffect(() => {
		if (rateLimitSeconds <= 0) return
		const countdown = window.setInterval(
			() => setRateLimitSeconds(current => Math.max(0, current - 1)),
			1_000
		)
		return () => window.clearInterval(countdown)
	}, [rateLimitSeconds])

	const normalizedSearch = searchTerm.trim()
	const isNameSearchActive = normalizedSearch.length >= MIN_SEARCH_LENGTH
	const selectedTeam = useMemo(
		() => teams.find(team => team.shortName === teamFilter) ?? null,
		[teamFilter, teams]
	)
	const serverPlayerFilter = useMemo<PlayerDirectoryFilter | null>(() => {
		const filter: PlayerDirectoryFilter = {}
		if (selectedTeam) filter.teamId = selectedTeam.id
		if (positionFilter !== 'ALL') {
			filter.position = shortPositionToDirectory(positionFilter)
		}
		if (maxPrice != null) filter.maxPrice = maxPrice
		return Object.keys(filter).length > 0 ? filter : null
	}, [maxPrice, positionFilter, selectedTeam])
	const playerQueryKey = useMemo(
		() =>
			buildPlayerDirectoryQueryKey({
				search: isNameSearchActive ? normalizedSearch : null,
				teamId: serverPlayerFilter?.teamId ?? null,
				position: serverPlayerFilter?.position ?? null,
				maxPrice: serverPlayerFilter?.maxPrice ?? null,
				sortBy,
				ownBand
			}),
		[isNameSearchActive, normalizedSearch, serverPlayerFilter, sortBy, ownBand]
	)

	useEffect(() => {
		if (initialSeedQueryKeyRef.current === playerQueryKey) {
			initialSeedQueryKeyRef.current = null
			nextPlayersQueryKeyRef.current = playerQueryKey
			return
		}
		let isCancelled = false
		const controller = new AbortController()
		const requestVersion = ++playerRequestVersionRef.current
		nextPlayersQueryKeyRef.current = null
		setNextPlayersQueryKey(null)
		setNextPlayersCursor(null)

		const fetchPlayers = async () => {
			try {
				setIsPlayersLoading(true)
				setIsMorePlayersLoading(false)
				setMorePlayersError(null)
				setError(null)
				const result = await executeQuery<PlayerSearchForPickerResponse>(
					SEARCH_PLAYERS_FOR_PICKER,
					{
						search: isNameSearchActive ? normalizedSearch : null,
						filter: serverPlayerFilter,
						sort: pickerSortToGraphql(sortBy),
						ownershipBand: ownBandToGraphql(ownBand),
						limit: PLAYER_PICKER_PAGE_SIZE,
						cursor: null
					},
					{ signal: controller.signal }
				)

				if (isCancelled || requestVersion !== playerRequestVersionRef.current) {
					return
				}

				setPlayers(result.playersForPicker.items.map(toPickerPlayer))
				setTotalPlayers(result.playersForPicker.totalCount)
				setRateLimitSeconds(0)
				nextPlayersQueryKeyRef.current = playerQueryKey
				setNextPlayersQueryKey(playerQueryKey)
				setNextPlayersCursor(result.playersForPicker.nextCursor)
			} catch (fetchError) {
				if (isCancelledRequest(fetchError)) return
				console.error('Failed to fetch players directory:', fetchError)

				if (
					!isCancelled &&
					requestVersion === playerRequestVersionRef.current
				) {
					if (
						fetchError instanceof GraphQLRequestError &&
						fetchError.status === 429
					) {
						setError(null)
						setRateLimitSeconds(fetchError.retryAfterSeconds ?? 60)
					} else {
						setError(t('playersFailed'))
						setPlayers([])
						setTotalPlayers(0)
						nextPlayersQueryKeyRef.current = null
						setNextPlayersQueryKey(null)
						setNextPlayersCursor(null)
					}
				}
			} finally {
				if (
					!isCancelled &&
					requestVersion === playerRequestVersionRef.current
				) {
					setIsPlayersLoading(false)
				}
			}
		}

		const fetchTimer = window.setTimeout(
			() => void fetchPlayers(),
			PLAYER_PICKER_DEBOUNCE_MS
		)

		return () => {
			isCancelled = true
			window.clearTimeout(fetchTimer)
			controller.abort()
		}
	}, [
		isNameSearchActive,
		normalizedSearch,
		serverPlayerFilter,
		sortBy,
		ownBand,
		playerQueryKey,
		t
	])

	const excludedIds = useMemo(
		() => new Set(excludedPlayerIds),
		[excludedPlayerIds]
	)

	const availableTeams = useMemo(
		() => ['ALL', ...teams.map(team => team.shortName)],
		[teams]
	)

	useEffect(() => {
		if (!availableTeams.includes(teamFilter)) {
			const resetTimer = window.setTimeout(() => setTeamFilter('ALL'), 0)
			return () => window.clearTimeout(resetTimer)
		}
	}, [availableTeams, teamFilter])

	const filteredPlayers = useMemo(() => {
		const filtered = filterDirectoryPlayers(players, {
			excludedIds,
			positionFilter,
			teamShortName: teamFilter === 'ALL' ? null : teamFilter,
			maxPrice,
			ownBand
		})
		return sortDirectoryPlayers(filtered, sortBy)
	}, [
		excludedIds,
		players,
		positionFilter,
		teamFilter,
		maxPrice,
		ownBand,
		sortBy
	])

	const loadMorePlayers = async () => {
		if (
			isMorePlayersLoading ||
			nextPlayersCursor === null ||
			nextPlayersQueryKeyRef.current !== playerQueryKey
		) {
			return
		}
		const requestVersion = playerRequestVersionRef.current
		const requestQueryKey = playerQueryKey
		setMorePlayersError(null)

		try {
			setIsMorePlayersLoading(true)
			const result = await executeQuery<PlayerSearchForPickerResponse>(
				SEARCH_PLAYERS_FOR_PICKER,
				{
					search: isNameSearchActive ? normalizedSearch : null,
					filter: serverPlayerFilter,
					sort: pickerSortToGraphql(sortBy),
					ownershipBand: ownBandToGraphql(ownBand),
					limit: PLAYER_PICKER_PAGE_SIZE,
					cursor: nextPlayersCursor
				}
			)

			if (
				requestVersion !== playerRequestVersionRef.current ||
				nextPlayersQueryKeyRef.current !== requestQueryKey
			) {
				return
			}

			setPlayers(currentPlayers => {
				const byId = new Map(
					currentPlayers.map(player => [player.id, player] as const)
				)
				for (const player of result.playersForPicker.items.map(
					toPickerPlayer
				)) {
					byId.set(player.id, player)
				}
				return Array.from(byId.values())
			})
			setTotalPlayers(result.playersForPicker.totalCount)
			nextPlayersQueryKeyRef.current = requestQueryKey
			setNextPlayersQueryKey(requestQueryKey)
			setNextPlayersCursor(result.playersForPicker.nextCursor)
		} catch (fetchError) {
			console.error('Failed to fetch more players:', fetchError)
			if (requestVersion === playerRequestVersionRef.current) {
				if (
					fetchError instanceof GraphQLRequestError &&
					fetchError.status === 429
				) {
					setRateLimitSeconds(fetchError.retryAfterSeconds ?? 60)
				} else {
					setMorePlayersError(t('loadMoreFailed'))
				}
			}
		} finally {
			if (requestVersion === playerRequestVersionRef.current) {
				setIsMorePlayersLoading(false)
			}
		}
	}

	const visiblePlayers = filteredPlayers
	const canLoadMorePlayers =
		nextPlayersCursor !== null && nextPlayersQueryKey === playerQueryKey

	const isLoading = isTeamsLoading || isPlayersLoading

	const updateNameSearch = (value: string) => {
		const nextIsNameSearchActive = value.trim().length >= MIN_SEARCH_LENGTH
		if (nextIsNameSearchActive && !isNameSearchActive) {
			browseFiltersBeforeSearchRef.current = {
				teamFilter,
				positionFilter,
				positionFilterExplicit,
				maxPrice,
				ownBand
			}
			setTeamFilter('ALL')
			setPositionFilter('ALL')
			setPositionFilterExplicit(false)
			setMaxPrice(null)
			setOwnBand('ANY')
		} else if (!nextIsNameSearchActive && isNameSearchActive) {
			const previous = browseFiltersBeforeSearchRef.current
			if (previous) {
				setTeamFilter(previous.teamFilter)
				setPositionFilter(previous.positionFilter)
				setPositionFilterExplicit(previous.positionFilterExplicit)
				setMaxPrice(previous.maxPrice)
				setOwnBand(previous.ownBand)
			}
			browseFiltersBeforeSearchRef.current = null
		}
		setSearchTerm(value)
	}

	const resetFilters = () => {
		browseFiltersBeforeSearchRef.current = null
		setSearchTerm('')
		setPositionFilterExplicit(false)
		setPositionFilter(defaultPosition ?? 'ALL')
		setTeamFilter('ALL')
		setMaxPrice(null)
		setOwnBand('ANY')
		setSortBy(statsAvailable ? 'total_desc' : 'own_desc')
	}

	const maxPriceSelectValue =
		maxPrice == null ? 'any' : formatMaxPriceLabel(maxPrice)

	return (
		<div className={className}>
			<p className="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
				{t('findPlayer')}
			</p>
			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					aria-label={t('search')}
					value={searchTerm}
					onChange={event => updateNameSearch(event.target.value)}
					placeholder={t('searchPlaceholder')}
					className="pl-9 pr-9"
				/>
				{searchTerm.trim().length > 0 && (
					<button
						type="button"
						aria-label={t('clearSearch')}
						onClick={() => updateNameSearch('')}
						className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>

			<div className="mt-2 flex flex-wrap items-center gap-2">
				<Select
					value={teamFilter}
					onValueChange={value => setTeamFilter(value)}
					disabled={isTeamsLoading || isNameSearchActive}
				>
					<SelectTrigger
						className="h-8 w-[min(100%,9rem)] text-xs"
						aria-label={t('filterTeam')}
					>
						<SelectValue
							placeholder={isTeamsLoading ? t('loadingTeams') : t('allTeams')}
						/>
					</SelectTrigger>
					<SelectContent className="max-h-72">
						{availableTeams.map(team => (
							<SelectItem
								key={team}
								value={team}
							>
								{team === 'ALL'
									? t('allTeams')
									: resolveTeamDisplayName(
											team,
											teams.find(item => item.shortName === team)?.name
										)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={positionFilter}
					disabled={isNameSearchActive}
					onValueChange={value => {
						setPositionFilterExplicit(true)
						setPositionFilter(value as PositionFilter)
					}}
				>
					<SelectTrigger
						className="h-8 w-[min(100%,7rem)] text-xs"
						aria-label={t('filterPosition')}
					>
						<SelectValue placeholder={t('allPositions')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">{t('allPositions')}</SelectItem>
						<SelectItem value="GKP">{t('goalkeeper')}</SelectItem>
						<SelectItem value="DEF">{t('defender')}</SelectItem>
						<SelectItem value="MID">{t('midfielder')}</SelectItem>
						<SelectItem value="FWD">{t('forward')}</SelectItem>
					</SelectContent>
				</Select>

				<Select
					value={sortBy}
					onValueChange={value => setSortBy(value as PlayerDirectorySort)}
				>
					<SelectTrigger
						className="h-8 w-[min(100%,9.5rem)] text-xs"
						aria-label={t('sortLabel')}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{statsAvailable ? (
							<>
								<SelectItem value="total_desc">{t('sortTotalDesc')}</SelectItem>
								<SelectItem value="form_desc">{t('sortFormDesc')}</SelectItem>
							</>
						) : null}
						<SelectItem value="price_desc">{t('sortPriceDesc')}</SelectItem>
						<SelectItem value="price_asc">{t('sortPriceAsc')}</SelectItem>
						<SelectItem value="own_desc">{t('sortOwnDesc')}</SelectItem>
						<SelectItem value="name">{t('sortName')}</SelectItem>
					</SelectContent>
				</Select>

				<Select
					value={maxPriceSelectValue}
					disabled={isNameSearchActive}
					onValueChange={value => {
						if (value === 'any') {
							setMaxPrice(null)
							return
						}
						const raw = value.replace(/^le_/, '')
						const parsed = Number(raw)
						setMaxPrice(Number.isFinite(parsed) ? parsed : null)
					}}
				>
					<SelectTrigger
						className="h-8 w-[min(100%,6.5rem)] text-xs"
						aria-label={t('maxPriceLabel')}
					>
						<SelectValue placeholder={t('maxPriceAny')} />
					</SelectTrigger>
					<SelectContent className="max-h-64">
						{MAX_PRICE_OPTIONS.map(option => {
							const value = option == null ? 'any' : formatMaxPriceLabel(option)
							return (
								<SelectItem
									key={value}
									value={value}
								>
									{option == null
										? t('maxPriceAny')
										: t('maxPriceLe', { price: (option / 10).toFixed(1) })}
								</SelectItem>
							)
						})}
					</SelectContent>
				</Select>

				<Select
					value={ownBand}
					disabled={isNameSearchActive}
					onValueChange={value => setOwnBand(value as OwnBand)}
				>
					<SelectTrigger
						className="h-8 w-[min(100%,6.5rem)] text-xs"
						aria-label={t('ownBandLabel')}
					>
						{ownBand === 'ANY' ? (
							<span>{t('ownBandLabel')}</span>
						) : (
							<SelectValue />
						)}
					</SelectTrigger>
					<SelectContent>
						{OWN_BANDS.map(band => (
							<SelectItem
								key={band}
								value={band}
							>
								{t(OWN_BAND_LABEL_KEYS[band])}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 gap-1 px-2 text-xs"
					onClick={resetFilters}
				>
					<RotateCcw
						className="size-3.5"
						aria-hidden="true"
					/>
					{t('resetFilters')}
				</Button>
			</div>

			{rateLimitSeconds > 0 ? (
				<p
					className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground"
					role="status"
				>
					{t('rateLimited', { seconds: rateLimitSeconds })}
				</p>
			) : null}
			{teamsError ? (
				<p
					className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
					role="alert"
				>
					{teamsError}
				</p>
			) : null}

			<div
				className="mt-3 rounded-md border"
				aria-busy={isLoading}
			>
				<div className="max-h-64 overflow-y-auto">
					{error ? (
						<div
							role="alert"
							className="p-3 text-sm text-destructive"
						>
							{error}
						</div>
					) : isLoading && visiblePlayers.length === 0 ? (
						<div className="p-3 text-sm text-muted-foreground">
							{t('loadingPlayers')}
						</div>
					) : visiblePlayers.length === 0 && !canLoadMorePlayers ? (
						<div className="space-y-2 p-3 text-sm text-muted-foreground">
							<p>{t('noPlayers')}</p>
							{normalizedSearch && positionFilter !== 'ALL' ? (
								<div className="flex flex-wrap items-center gap-2">
									<p className="text-xs">
										{t('noPlayersTryAllPositions', {
											query: normalizedSearch,
											position: t(
												positionFilter === 'GKP'
													? 'goalkeeper'
													: positionFilter === 'DEF'
														? 'defender'
														: positionFilter === 'MID'
															? 'midfielder'
															: 'forward'
											)
										})}
									</p>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 px-2 text-xs"
										onClick={() => setPositionFilter('ALL')}
									>
										{t('searchAllPositions')}
									</Button>
								</div>
							) : null}
						</div>
					) : (
						visiblePlayers.map(player => (
							<button
								key={player.id}
								type="button"
								onClick={() => {
									onSelect(player)
									resetFilters()
								}}
								className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/50"
							>
								<span className="min-w-0 flex-1 truncate font-medium">
									{player.name}
								</span>
								<span className="shrink-0 text-[10px] text-muted-foreground">
									{player.position}
								</span>
								<span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
									{resolveTeamDisplayName(
										player.teamShortName,
										player.teamName
									)}
								</span>
								{statsAvailable ? (
									<>
										<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
											{t('totalPtsShort')}{' '}
											<span className="font-medium text-foreground">
												{player.totalPoints ?? '—'}
											</span>
										</span>
										<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
											{t('formShort')}{' '}
											<span className="font-medium text-foreground">
												{player.form ?? '—'}
											</span>
										</span>
									</>
								) : null}
								<span className="shrink-0 text-xs tabular-nums font-medium">
									{formatPickerPrice(player.price)}
								</span>
								<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
									{player.selectedByPercent == null
										? '—'
										: `${player.selectedByPercent.toFixed(1)}%`}
								</span>
							</button>
						))
					)}
				</div>
				{canLoadMorePlayers && !error && !isPlayersLoading ? (
					<div className="border-t p-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="w-full"
							disabled={isMorePlayersLoading}
							onClick={() => void loadMorePlayers()}
						>
							{t(isMorePlayersLoading ? 'loadingMore' : 'loadMore')}
						</Button>
						{morePlayersError ? (
							<p
								role="status"
								className="mt-1 text-center text-xs text-destructive"
							>
								{morePlayersError}
							</p>
						) : null}
					</div>
				) : null}
			</div>

			<div className="mt-2 text-xs text-muted-foreground">
				{t('resultCount', {
					visible: visiblePlayers.length,
					total: totalPlayers
				})}
			</div>
		</div>
	)
}
