'use client'

import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'
import { SelectedFilterBadge } from '@/components/player/SelectedFilterBadge'
import { Badge } from '@/components/ui/badge'
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
import type {
	EntryLiveCompetitionCaptainMode,
	EntryLiveCompetitionPickScope,
	TournamentSelectionIndexResponse,
	TournamentSelectionIndexRow
} from '@/lib/graphql/operations/tournaments'
import {
	EMPTY_LIVE_BOARD_FILTERS,
	type LiveBoardFilterState
} from '@/lib/tournament/live-board'
import { resolveTeamDisplayName } from '@/lib/team-display'
import type { Position } from '@/types/common'
import { Filter, Plus, RotateCcw, Search, Shirt, Users, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Props = {
	tournamentId: number
	eventId: number
	scoreCoreRevision: string
	value: LiveBoardFilterState
	totalEntries: number
	filteredEntries: number
	disabled?: boolean
	onApply: (next: LiveBoardFilterState) => Promise<boolean>
	onRevisionGone?: () => Promise<unknown> | unknown
}

const scopes: EntryLiveCompetitionPickScope[] = ['ANY', 'STARTER', 'BENCH']
const captainModes: EntryLiveCompetitionCaptainMode[] = [
	'ANY',
	'CAPTAIN',
	'VICE'
]
const chipOptions = [
	'TRIPLE_CAPTAIN',
	'BENCH_BOOST',
	'WILDCARD',
	'FREE_HIT',
	'MANAGER'
] as const
const teamCountOptions = [1, 2, 3] as const

function isSelectionIndexRow(
	value: unknown
): value is TournamentSelectionIndexRow {
	if (!value || typeof value !== 'object') return false
	const row = value as Record<string, unknown>
	return (
		Number.isSafeInteger(row.playerId) &&
		Number(row.playerId) > 0 &&
		typeof row.playerName === 'string' &&
		row.playerName.length > 0 &&
		Number.isSafeInteger(row.teamId) &&
		Number(row.teamId) > 0 &&
		typeof row.teamName === 'string' &&
		typeof row.teamShortName === 'string' &&
		typeof row.position === 'string' &&
		typeof row.count === 'number' &&
		Number.isFinite(row.count) &&
		typeof row.percentage === 'number' &&
		Number.isFinite(row.percentage)
	)
}

const cloneFilters = (value: LiveBoardFilterState): LiveBoardFilterState => ({
	chips: [...value.chips],
	captainPlayerIds: [...value.captainPlayerIds],
	ownership: value.ownership
		? { ...value.ownership, playerIds: [...value.ownership.playerIds] }
		: null,
	teamCountRules: value.teamCountRules.map(rule => ({ ...rule }))
})

const selectionPositionToShort = (value: string): Position => {
	switch (value.toUpperCase()) {
		case 'GKP':
		case 'GOALKEEPER':
			return 'GKP'
		case 'DEF':
		case 'DEFENDER':
			return 'DEF'
		case 'MID':
		case 'MIDFIELDER':
			return 'MID'
		case 'FWD':
		case 'FORWARD':
			return 'FWD'
		default:
			return 'MID'
	}
}

const rowToPlayerOption = (
	row: TournamentSelectionIndexRow
): PlayerDirectoryOption => ({
	id: String(row.playerId),
	name: row.playerName,
	position: selectionPositionToShort(row.position),
	teamShortName: row.teamShortName,
	teamName: row.teamName,
	selectedByPercent: row.percentage
})

type LivePositionFilter = Position | 'ALL'

const livePositionOptions: LivePositionFilter[] = [
	'ALL',
	'GKP',
	'DEF',
	'MID',
	'FWD'
]

function LiveSelectionPlayerPicker({
	rows,
	excludedPlayerIds,
	onSelect,
	className = ''
}: {
	rows: TournamentSelectionIndexRow[]
	excludedPlayerIds?: string[]
	onSelect: (player: PlayerDirectoryOption) => void
	className?: string
}) {
	const t = useTranslations('PlayerDirectory')
	const [searchTerm, setSearchTerm] = useState('')
	const [teamFilter, setTeamFilter] = useState('ALL')
	const [positionFilter, setPositionFilter] =
		useState<LivePositionFilter>('ALL')
	const excludedIds = useMemo(
		() => new Set(excludedPlayerIds ?? []),
		[excludedPlayerIds]
	)
	const teams = useMemo(() => {
		const unique = new Map<
			number,
			{ id: number; name: string; shortName: string }
		>()
		for (const row of rows) {
			unique.set(row.teamId, {
				id: row.teamId,
				name: row.teamName,
				shortName: row.teamShortName
			})
		}
		return Array.from(unique.values()).sort((left, right) =>
			resolveTeamDisplayName(left.shortName, left.name).localeCompare(
				resolveTeamDisplayName(right.shortName, right.name)
			)
		)
	}, [rows])
	const availableRows = useMemo(
		() => rows.filter(row => !excludedIds.has(String(row.playerId))),
		[excludedIds, rows]
	)
	const visibleRows = useMemo(() => {
		const normalizedSearch = searchTerm.trim().toLocaleLowerCase()
		return [...availableRows]
			.filter(row => {
				const position = selectionPositionToShort(row.position)
				return (
					(normalizedSearch.length === 0 ||
						row.playerName.toLocaleLowerCase().includes(normalizedSearch)) &&
					(teamFilter === 'ALL' || String(row.teamId) === teamFilter) &&
					(positionFilter === 'ALL' || position === positionFilter)
				)
			})
			.sort(
				(left, right) =>
					right.count - left.count ||
					left.playerName.localeCompare(right.playerName)
			)
	}, [availableRows, positionFilter, searchTerm, teamFilter])

	const resetFilters = () => {
		setSearchTerm('')
		setTeamFilter('ALL')
		setPositionFilter('ALL')
	}

	return (
		<div className={className}>
			<p className="mb-1.5 eyebrow sm:text-caption">{t('findPlayer')}</p>
			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					aria-label={t('search')}
					value={searchTerm}
					onChange={event => setSearchTerm(event.target.value)}
					placeholder={t('searchPlaceholder')}
					className="pl-9 pr-9"
				/>
				{searchTerm.length > 0 ? (
					<button
						type="button"
						aria-label={t('clearSearch')}
						onClick={() => setSearchTerm('')}
						className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<X className="h-4 w-4" />
					</button>
				) : null}
			</div>

			<div className="mt-2 flex flex-wrap items-center gap-2">
				<Select
					value={teamFilter}
					onValueChange={setTeamFilter}
				>
					<SelectTrigger
						className="h-8 w-[min(100%,9rem)] text-xs"
						aria-label={t('filterTeam')}
					>
						<SelectValue placeholder={t('allTeams')} />
					</SelectTrigger>
					<SelectContent className="max-h-72">
						<SelectItem value="ALL">{t('allTeams')}</SelectItem>
						{teams.map(team => (
							<SelectItem
								key={team.id}
								value={String(team.id)}
							>
								{resolveTeamDisplayName(team.shortName, team.name)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={positionFilter}
					onValueChange={value =>
						setPositionFilter(value as LivePositionFilter)
					}
				>
					<SelectTrigger
						className="h-8 w-[min(100%,7rem)] text-xs"
						aria-label={t('filterPosition')}
					>
						<SelectValue placeholder={t('allPositions')} />
					</SelectTrigger>
					<SelectContent>
						{livePositionOptions.map(position => (
							<SelectItem
								key={position}
								value={position}
							>
								{position === 'ALL'
									? t('allPositions')
									: position === 'GKP'
										? t('goalkeeper')
										: position === 'DEF'
											? t('defender')
											: position === 'MID'
												? t('midfielder')
												: t('forward')}
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

			<div className="mt-3 rounded-md border">
				<div className="max-h-64 overflow-y-auto">
					{visibleRows.length === 0 ? (
						<div className="p-3 text-sm text-muted-foreground">
							{t('noPlayers')}
						</div>
					) : (
						visibleRows.map(row => (
							<button
								key={row.playerId}
								type="button"
								onClick={() => onSelect(rowToPlayerOption(row))}
								className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/50"
							>
								<span className="min-w-0 flex-1 truncate font-medium">
									{row.playerName}
								</span>
								<span className="shrink-0 text-label text-muted-foreground">
									{selectionPositionToShort(row.position)}
								</span>
								<span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
									{resolveTeamDisplayName(row.teamShortName, row.teamName)}
								</span>
								<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
									{row.percentage.toFixed(1)}%
								</span>
							</button>
						))
					)}
				</div>
			</div>

			<div className="mt-2 text-xs text-muted-foreground">
				{t('resultCount', {
					visible: visibleRows.length,
					total: availableRows.length
				})}
			</div>
		</div>
	)
}

const scopeLabel = (
	scope: EntryLiveCompetitionPickScope,
	t: (key: 'any' | 'starter' | 'bench') => string
) =>
	scope === 'ANY' ? t('any') : scope === 'STARTER' ? t('starter') : t('bench')

const captainModeLabel = (
	mode: EntryLiveCompetitionCaptainMode,
	t: (key: 'anyCaptain' | 'selectedCaptain' | 'selectedViceCaptain') => string
) =>
	mode === 'ANY'
		? t('anyCaptain')
		: mode === 'CAPTAIN'
			? t('selectedCaptain')
			: t('selectedViceCaptain')

export function LiveCompetitionBoardFilters({
	tournamentId,
	eventId,
	scoreCoreRevision,
	value,
	totalEntries,
	filteredEntries,
	disabled,
	onApply,
	onRevisionGone
}: Props) {
	const t = useTranslations('Filters')
	const liveT = useTranslations('LiveTournament')
	const [rows, setRows] = useState<TournamentSelectionIndexRow[]>([])
	const [loading, setLoading] = useState(true)
	const [loadError, setLoadError] = useState(false)
	const [applying, setApplying] = useState(false)
	const [draft, setDraft] = useState<LiveBoardFilterState>(() =>
		cloneFilters(value)
	)
	const [pendingCaptain, setPendingCaptain] = useState('')
	const [pendingTeam, setPendingTeam] = useState('')
	const [pendingCount, setPendingCount] = useState(1)
	const [pendingTeamScope, setPendingTeamScope] =
		useState<EntryLiveCompetitionPickScope>('ANY')
	const [isPlayerPickerOpen, setIsPlayerPickerOpen] = useState(false)
	const [isTeamPickerOpen, setIsTeamPickerOpen] = useState(false)
	const [selectedPlayerOptions, setSelectedPlayerOptions] = useState<
		Record<string, PlayerDirectoryOption>
	>({})
	const latestValueRef = useRef(value)
	const queuedFiltersRef = useRef<LiveBoardFilterState | null>(null)
	const applyPromiseRef = useRef<Promise<void> | null>(null)

	useEffect(() => {
		latestValueRef.current = value
		setDraft(cloneFilters(value))
	}, [value])

	useEffect(() => {
		const controller = new AbortController()
		setLoading(true)
		setLoadError(false)
		const params = new URLSearchParams({
			eventId: String(eventId),
			scoreCoreRevision
		})
		void fetch(
			`/api/live/competitions/${tournamentId}/selection-index?${params.toString()}`,
			{ cache: 'no-store', signal: controller.signal }
		)
			.then(async response => {
				const data = (await response.json().catch(() => null)) as {
					error?: unknown
				} | null
				if (!response.ok) {
					const error = new Error(
						`selection-index:${response.status}`
					) as Error & { code?: string; status?: number }
					error.code = typeof data?.error === 'string' ? data.error : undefined
					error.status = response.status
					throw error
				}
				return data as TournamentSelectionIndexResponse
			})
			.then(data => {
				const next = data.tournamentSelectionIndex?.rows
				if (!Array.isArray(next) || !next.every(isSelectionIndexRow)) {
					throw new Error('selection-index:invalid')
				}
				setRows(next)
			})
			.catch(error => {
				if (controller.signal.aborted) return
				const requestError = error as { code?: string; status?: number }
				if (
					requestError.status === 409 ||
					requestError.code === 'LIVE_SCORE_REVISION_GONE'
				) {
					setRows([])
					setLoadError(false)
					void onRevisionGone?.()
					return
				}
				console.warn('Tournament selection index unavailable', {
					name: error instanceof Error ? error.name : 'UnknownError'
				})
				setLoadError(true)
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false)
			})
		return () => controller.abort()
	}, [eventId, onRevisionGone, scoreCoreRevision, tournamentId])

	const selectedOwnerIds = useMemo(
		() => draft.ownership?.playerIds ?? [],
		[draft.ownership?.playerIds]
	)
	const selectedCaptainIds = new Set(draft.captainPlayerIds)
	const playerOptions = useMemo(
		() =>
			[...rows].sort(
				(left, right) =>
					right.count - left.count ||
					left.playerName.localeCompare(right.playerName)
			),
		[rows]
	)
	const playersById = useMemo(
		() => new Map(rows.map(row => [row.playerId, row])),
		[rows]
	)
	const teams = useMemo(() => {
		const unique = new Map<
			number,
			{ id: number; name: string; shortName: string }
		>()
		for (const row of rows) {
			unique.set(row.teamId, {
				id: row.teamId,
				name: row.teamName,
				shortName: row.teamShortName
			})
		}
		return Array.from(unique.values()).sort((left, right) =>
			left.name.localeCompare(right.name)
		)
	}, [rows])
	const teamsById = useMemo(
		() => new Map(teams.map(team => [team.id, team])),
		[teams]
	)
	const selectedTeamIds = useMemo(
		() => new Set(draft.teamCountRules.map(rule => rule.teamId)),
		[draft.teamCountRules]
	)
	const availableTeams = useMemo(
		() => teams.filter(team => !selectedTeamIds.has(team.id)),
		[selectedTeamIds, teams]
	)

	useEffect(() => {
		const activeIds = new Set(selectedOwnerIds)
		setSelectedPlayerOptions(current => {
			const next: Record<string, PlayerDirectoryOption> = {}
			let changed = false
			for (const [id, player] of Object.entries(current)) {
				if (activeIds.has(Number(id))) next[id] = player
				else changed = true
			}
			for (const row of rows) {
				const id = String(row.playerId)
				if (activeIds.has(row.playerId) && !next[id]) {
					next[id] = rowToPlayerOption(row)
					changed = true
				}
			}
			return changed ? next : current
		})
	}, [rows, selectedOwnerIds])

	const commitFilters = useCallback(
		(next: LiveBoardFilterState) => {
			const normalized = cloneFilters(next)
			setDraft(normalized)
			queuedFiltersRef.current = normalized
			if (applyPromiseRef.current) return

			const run = async () => {
				try {
					while (queuedFiltersRef.current) {
						const request = queuedFiltersRef.current
						queuedFiltersRef.current = null
						setApplying(true)
						let accepted = false
						try {
							accepted = await onApply(request)
						} catch {
							accepted = false
						}
						if (!accepted) {
							queuedFiltersRef.current = null
							setDraft(cloneFilters(latestValueRef.current))
							return
						}
					}
				} finally {
					setApplying(false)
				}
			}

			const promise = run()
			applyPromiseRef.current = promise
			void promise.then(
				() => {
					if (applyPromiseRef.current === promise)
						applyPromiseRef.current = null
				},
				() => {
					if (applyPromiseRef.current === promise)
						applyPromiseRef.current = null
				}
			)
		},
		[onApply]
	)

	const toggleChip = (chip: string) => {
		const next = cloneFilters(draft)
		next.chips = next.chips.includes(chip)
			? next.chips.filter(value => value !== chip)
			: [...next.chips, chip].slice(0, 5)
		commitFilters(next)
	}

	const addCaptain = () => {
		const playerId = Number(pendingCaptain)
		if (!playerId || selectedCaptainIds.has(playerId)) return
		const next = cloneFilters(draft)
		next.captainPlayerIds = [...next.captainPlayerIds, playerId].slice(0, 15)
		setPendingCaptain('')
		commitFilters(next)
	}

	const removeCaptain = (playerId: number) => {
		const next = cloneFilters(draft)
		next.captainPlayerIds = next.captainPlayerIds.filter(id => id !== playerId)
		commitFilters(next)
	}

	const addOwner = (player: PlayerDirectoryOption) => {
		const playerId = Number(player.id)
		if (
			!Number.isSafeInteger(playerId) ||
			playerId <= 0 ||
			selectedOwnerIds.includes(playerId) ||
			selectedOwnerIds.length >= 5
		)
			return
		const next = cloneFilters(draft)
		next.ownership = {
			playerIds: [...selectedOwnerIds, playerId].slice(0, 5),
			scope: draft.ownership?.scope ?? 'ANY',
			captainMode: draft.ownership?.captainMode ?? 'ANY'
		}
		setSelectedPlayerOptions(current => ({
			...current,
			[player.id]: player
		}))
		setIsPlayerPickerOpen(false)
		commitFilters(next)
	}

	const removeOwner = (playerId: number) => {
		const remaining = selectedOwnerIds.filter(id => id !== playerId)
		const next = cloneFilters(draft)
		next.ownership =
			remaining.length > 0 && draft.ownership
				? { ...draft.ownership, playerIds: remaining }
				: null
		setSelectedPlayerOptions(current => {
			const copy = { ...current }
			delete copy[String(playerId)]
			return copy
		})
		commitFilters(next)
	}

	const updateOwnership = (
		update: (
			ownership: NonNullable<LiveBoardFilterState['ownership']>
		) => NonNullable<LiveBoardFilterState['ownership']>
	) => {
		if (!draft.ownership) return
		const next = cloneFilters(draft)
		next.ownership = update(next.ownership!)
		commitFilters(next)
	}

	const clearOwnership = () => {
		const next = cloneFilters(draft)
		next.ownership = null
		setSelectedPlayerOptions({})
		commitFilters(next)
	}

	const addTeamRule = () => {
		const teamId = Number(pendingTeam)
		if (!teamId || draft.teamCountRules.length >= 4) return
		const next = cloneFilters(draft)
		next.teamCountRules = [
			...next.teamCountRules.filter(
				rule => !(rule.teamId === teamId && rule.scope === pendingTeamScope)
			),
			{ teamId, exactCount: pendingCount, scope: pendingTeamScope }
		].slice(0, 4)
		setPendingTeam('')
		setPendingCount(1)
		setIsTeamPickerOpen(false)
		commitFilters(next)
	}

	const removeTeamRule = (
		teamId: number,
		scope: EntryLiveCompetitionPickScope
	) => {
		const next = cloneFilters(draft)
		next.teamCountRules = next.teamCountRules.filter(
			rule => !(rule.teamId === teamId && rule.scope === scope)
		)
		commitFilters(next)
	}

	const clearTeams = () => {
		const next = cloneFilters(draft)
		next.teamCountRules = []
		setPendingTeam('')
		setPendingCount(1)
		setPendingTeamScope('ANY')
		commitFilters(next)
	}

	const clear = () => {
		setPendingCaptain('')
		setPendingTeam('')
		setPendingCount(1)
		setPendingTeamScope('ANY')
		setSelectedPlayerOptions({})
		setIsPlayerPickerOpen(false)
		setIsTeamPickerOpen(false)
		commitFilters(EMPTY_LIVE_BOARD_FILTERS)
	}

	const selectedPlayers = selectedOwnerIds.map(playerId => {
		const fromPicker = selectedPlayerOptions[String(playerId)]
		if (fromPicker) return fromPicker
		const row = playersById.get(playerId)
		if (row) return rowToPlayerOption(row)
		return {
			id: String(playerId),
			name: String(playerId),
			position: 'MID' as Position,
			teamShortName: '—',
			teamName: '—'
		}
	})

	const activeFilterCount =
		draft.chips.length +
		draft.captainPlayerIds.length +
		(draft.ownership ? 1 : 0) +
		draft.teamCountRules.length
	const controlsDisabled = Boolean(disabled || applying)
	const matchedPercentage =
		totalEntries > 0 ? Math.round((filteredEntries / totalEntries) * 100) : 0
	const matchedSummary = t('matched', {
		matched: filteredEntries,
		total: totalEntries,
		percentage: matchedPercentage
	})

	return (
		<div className="mb-6 space-y-4">
			<Card className="space-y-4 border-border/80 p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-2 text-sm font-medium">
						<Filter
							className="size-4 text-primary-ink"
							aria-hidden="true"
						/>
						{t('advancedFilters')}
						{activeFilterCount > 0 ? (
							<Badge
								variant="secondary"
								className="tabular-nums"
							>
								{activeFilterCount}
							</Badge>
						) : null}
					</div>
					{loading || applying ? (
						<span
							className="text-xs text-muted-foreground"
							role="status"
						>
							{liveT('loadingStandings')}
						</span>
					) : null}
				</div>

				{loadError ? (
					<p className="text-xs text-destructive">
						{liveT('filterOptionsUnavailable')}
					</p>
				) : null}

				<div className="space-y-2 rounded-lg border border-border/60 p-3">
					<p className="text-sm font-medium">{liveT('filterByChip')}</p>
					<div
						className="flex flex-wrap gap-2"
						role="group"
						aria-label={liveT('filterChip')}
					>
						{chipOptions.map(chip => {
							const label =
								chip === 'TRIPLE_CAPTAIN'
									? liveT('tripleCaptain')
									: chip === 'BENCH_BOOST'
										? liveT('benchBoost')
										: chip === 'WILDCARD'
											? liveT('wildcard')
											: chip === 'FREE_HIT'
												? liveT('freeHit')
												: liveT('assistantManager')
							return (
								<Button
									key={chip}
									type="button"
									size="sm"
									variant={draft.chips.includes(chip) ? 'default' : 'outline'}
									aria-pressed={draft.chips.includes(chip)}
									disabled={controlsDisabled}
									onClick={() => toggleChip(chip)}
								>
									{label}
								</Button>
							)
						})}
					</div>
				</div>

				<div className="space-y-2 rounded-lg border border-border/60 p-3">
					<p className="text-sm font-medium">{liveT('filterByCaptain')}</p>
					<div className="grid gap-2 sm:grid-cols-[1fr_auto]">
						<Select
							value={pendingCaptain}
							onValueChange={setPendingCaptain}
							disabled={controlsDisabled || loading || rows.length === 0}
						>
							<SelectTrigger aria-label={liveT('filterCaptain')}>
								<SelectValue placeholder={liveT('filterByCaptain')} />
							</SelectTrigger>
							<SelectContent className="max-h-72">
								{playerOptions
									.filter(player => !selectedCaptainIds.has(player.playerId))
									.map(player => (
										<SelectItem
											key={player.playerId}
											value={String(player.playerId)}
										>
											{player.playerName} · {player.position} ·{' '}
											{player.teamShortName}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							variant="outline"
							disabled={
								controlsDisabled ||
								!pendingCaptain ||
								selectedCaptainIds.size >= 15
							}
							onClick={addCaptain}
						>
							<Plus className="size-4" />
							{liveT('addCaptain')}
						</Button>
					</div>
					<div className="flex flex-wrap gap-2">
						{draft.captainPlayerIds.map(playerId => {
							const player = playersById.get(playerId)
							const name = player?.playerName ?? String(playerId)
							return (
								<Badge
									key={playerId}
									variant="outline"
									className="gap-1.5"
								>
									{name}
									<button
										type="button"
										aria-label={liveT('removeCaptain', { name })}
										disabled={controlsDisabled}
										onClick={() => removeCaptain(playerId)}
									>
										<X className="size-3" />
									</button>
								</Badge>
							)
						})}
					</div>
				</div>
			</Card>

			<Card className="space-y-3 border-border/80 p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-start gap-3">
						<Users className="mt-0.5 size-4 shrink-0 text-primary-ink" />
						<div>
							<p className="text-sm font-medium">{t('playerOwnership')}</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{matchedSummary}
							</p>
						</div>
					</div>
					<div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
						<Select
							value={draft.ownership?.scope ?? 'ANY'}
							onValueChange={scope =>
								updateOwnership(ownership => ({
									...ownership,
									scope: scope as EntryLiveCompetitionPickScope
								}))
							}
							disabled={controlsDisabled || !draft.ownership}
						>
							<SelectTrigger
								className="h-10 min-h-10 sm:h-9 sm:min-h-9 sm:w-[120px]"
								aria-label={t('ownershipScope')}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{scopes.map(scope => (
									<SelectItem
										key={scope}
										value={scope}
									>
										{scopeLabel(scope, t)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={draft.ownership?.captainMode ?? 'ANY'}
							onValueChange={mode =>
								updateOwnership(ownership => ({
									...ownership,
									captainMode: mode as EntryLiveCompetitionCaptainMode
								}))
							}
							disabled={controlsDisabled || !draft.ownership}
						>
							<SelectTrigger
								className="h-10 min-h-10 sm:h-9 sm:min-h-9 sm:w-[180px]"
								aria-label={t('captaincyFilter')}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{captainModes.map(mode => (
									<SelectItem
										key={mode}
										value={mode}
									>
										{captainModeLabel(mode, t)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							variant="outline"
							disabled={controlsDisabled || selectedOwnerIds.length >= 5}
							onClick={() => setIsPlayerPickerOpen(open => !open)}
						>
							<Plus className="size-4" />
							{t('addPlayer')}
						</Button>
					</div>
				</div>

				{selectedPlayers.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{selectedPlayers.map(player => (
							<SelectedFilterBadge
								key={player.id}
								name={player.name}
								details={[
									player.position,
									resolveTeamDisplayName(player.teamShortName, player.teamName),
									player.selectedByPercent == null
										? null
										: `${player.selectedByPercent.toFixed(1)}%`,
									scopeLabel(draft.ownership?.scope ?? 'ANY', t),
									captainModeLabel(draft.ownership?.captainMode ?? 'ANY', t)
								]
									.filter(Boolean)
									.join(' | ')}
								removeLabel={t('removePlayer', { name: player.name })}
								onRemove={() => removeOwner(Number(player.id))}
							/>
						))}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs"
							disabled={controlsDisabled}
							onClick={clearOwnership}
						>
							{t('clearAll')}
						</Button>
					</div>
				) : (
					<div className="rounded-md bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
						{t('noOwnershipFilter')}
					</div>
				)}

				{isPlayerPickerOpen ? (
					<LiveSelectionPlayerPicker
						key={`${tournamentId}:${eventId}:${scoreCoreRevision}`}
						rows={rows}
						className="mt-4"
						excludedPlayerIds={selectedOwnerIds.map(String)}
						onSelect={addOwner}
					/>
				) : null}
			</Card>

			<Card className="space-y-3 border-border/80 p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-start gap-3">
						<Shirt className="mt-0.5 size-4 shrink-0 text-primary-ink" />
						<div>
							<p className="text-sm font-medium">{t('teamExposure')}</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{matchedSummary}
							</p>
						</div>
					</div>
					<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
						<Select
							value={pendingTeam}
							onValueChange={value => {
								setPendingTeam(value)
								setIsTeamPickerOpen(false)
							}}
							open={isTeamPickerOpen}
							onOpenChange={setIsTeamPickerOpen}
							disabled={controlsDisabled || availableTeams.length === 0}
						>
							<SelectTrigger
								className="col-span-2 h-10 min-h-10 w-full sm:col-span-1 sm:h-9 sm:min-h-9 sm:w-[160px]"
								aria-label={t('selectTeamAria')}
							>
								<SelectValue placeholder={t('selectTeam')} />
							</SelectTrigger>
							<SelectContent>
								{availableTeams.map(team => (
									<SelectItem
										key={team.id}
										value={String(team.id)}
									>
										{team.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={String(pendingCount)}
							onValueChange={value => setPendingCount(Number(value))}
							disabled={controlsDisabled}
						>
							<SelectTrigger
								className="h-10 min-h-10 w-full sm:h-9 sm:min-h-9 sm:w-[80px]"
								aria-label={t('minimumPlayers')}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{teamCountOptions.map(count => (
									<SelectItem
										key={count}
										value={String(count)}
									>
										{count}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={pendingTeamScope}
							onValueChange={value =>
								setPendingTeamScope(value as EntryLiveCompetitionPickScope)
							}
							disabled={controlsDisabled}
						>
							<SelectTrigger
								className="col-span-2 h-10 min-h-10 w-full sm:col-span-1 sm:h-9 sm:min-h-9 sm:w-[110px]"
								aria-label={t('teamScope')}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{scopes.map(scope => (
									<SelectItem
										key={scope}
										value={scope}
									>
										{scopeLabel(scope, t)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							variant="outline"
							disabled={
								controlsDisabled ||
								!pendingTeam ||
								draft.teamCountRules.length >= 4
							}
							onClick={addTeamRule}
						>
							<Plus className="size-4" />
							{t('addTeam')}
						</Button>
					</div>
				</div>

				{draft.teamCountRules.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{draft.teamCountRules.map(rule => {
							const team = teamsById.get(rule.teamId)
							const key = `${rule.teamId}:${rule.scope}`
							return (
								<SelectedFilterBadge
									key={key}
									name={team?.name ?? String(rule.teamId)}
									details={`${team?.shortName ?? rule.teamId} · ${rule.exactCount} · ${scopeLabel(rule.scope, t)}`}
									removeLabel={t('removeTeamItem', {
										team: team?.name ?? String(rule.teamId)
									})}
									onRemove={() => removeTeamRule(rule.teamId, rule.scope)}
								/>
							)
						})}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs"
							disabled={controlsDisabled}
							onClick={clearTeams}
						>
							{t('clearAll')}
						</Button>
					</div>
				) : (
					<div className="rounded-md bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
						{t('noTeamFilter')}
					</div>
				)}
			</Card>

			<div className="flex justify-end">
				<Button
					type="button"
					variant="ghost"
					disabled={controlsDisabled || activeFilterCount === 0}
					onClick={clear}
				>
					{t('clearAll')}
				</Button>
			</div>
		</div>
	)
}
