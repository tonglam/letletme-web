'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { Filter, Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

type Props = {
	tournamentId: number
	eventId: number
	playerRevision: string
	value: LiveBoardFilterState
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
	'FREE_HIT'
] as const

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

export function LiveCompetitionBoardFilters({
	tournamentId,
	eventId,
	playerRevision,
	value,
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
	const [pendingOwner, setPendingOwner] = useState('')
	const [pendingTeam, setPendingTeam] = useState('')
	const [pendingCount, setPendingCount] = useState(1)
	const [pendingTeamScope, setPendingTeamScope] =
		useState<EntryLiveCompetitionPickScope>('ANY')

	useEffect(() => setDraft(cloneFilters(value)), [value])

	useEffect(() => {
		const controller = new AbortController()
		setLoading(true)
		setLoadError(false)
		const params = new URLSearchParams({
			eventId: String(eventId),
			revision: playerRevision
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
					) as Error & {
						code?: string
						status?: number
					}
					error.code = typeof data?.error === 'string' ? data.error : undefined
					error.status = response.status
					throw error
				}
				return data as TournamentSelectionIndexResponse
			})
			.then(data => {
				const next = data.tournamentSelectionIndex?.rows
				if (!Array.isArray(next) || !next.every(isSelectionIndexRow))
					throw new Error('selection-index:invalid')
				setRows(next)
			})
			.catch(error => {
				if (controller.signal.aborted) return
				const requestError = error as { code?: string; status?: number }
				if (
					requestError.status === 409 ||
					requestError.code === 'LIVE_BOARD_REVISION_GONE' ||
					requestError.code === 'LIVE_REVISION_GONE'
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
	}, [eventId, onRevisionGone, playerRevision, tournamentId])

	const selectedOwnerIds = new Set(draft.ownership?.playerIds ?? [])
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

	const toggleChip = (chip: string) =>
		setDraft(current => ({
			...current,
			chips: current.chips.includes(chip)
				? current.chips.filter(value => value !== chip)
				: [...current.chips, chip].slice(0, 5)
		}))

	const addCaptain = () => {
		const playerId = Number(pendingCaptain)
		if (!playerId || selectedCaptainIds.has(playerId)) return
		setDraft(current => ({
			...current,
			captainPlayerIds: [...current.captainPlayerIds, playerId].slice(0, 15)
		}))
		setPendingCaptain('')
	}

	const addOwner = () => {
		const playerId = Number(pendingOwner)
		if (!playerId || selectedOwnerIds.has(playerId)) return
		setDraft(current => ({
			...current,
			ownership: {
				playerIds: [...(current.ownership?.playerIds ?? []), playerId].slice(
					0,
					5
				),
				scope: current.ownership?.scope ?? 'ANY',
				captainMode: current.ownership?.captainMode ?? 'ANY'
			}
		}))
		setPendingOwner('')
	}

	const addTeamRule = () => {
		const teamId = Number(pendingTeam)
		if (!teamId || draft.teamCountRules.length >= 4) return
		setDraft(current => ({
			...current,
			teamCountRules: [
				...current.teamCountRules.filter(
					rule => !(rule.teamId === teamId && rule.scope === pendingTeamScope)
				),
				{ teamId, exactCount: pendingCount, scope: pendingTeamScope }
			].slice(0, 4)
		}))
		setPendingTeam('')
		setPendingCount(1)
	}

	const apply = async () => {
		setApplying(true)
		const accepted = await onApply(cloneFilters(draft)).finally(() =>
			setApplying(false)
		)
		if (!accepted) setDraft(cloneFilters(value))
	}

	const clear = async () => {
		const next = cloneFilters(EMPTY_LIVE_BOARD_FILTERS)
		setDraft(next)
		setApplying(true)
		const accepted = await onApply(next).finally(() => setApplying(false))
		if (!accepted) setDraft(cloneFilters(value))
	}

	return (
		<Card className="mb-6 space-y-4 border-border/80 p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2 text-sm font-medium">
					<Filter
						className="size-4 text-primary-ink"
						aria-hidden="true"
					/>
					{t('advancedFilters')}
				</div>
				{loading ? (
					<span className="text-xs text-muted-foreground">
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
										: liveT('freeHit')
						return (
							<Button
								key={chip}
								type="button"
								size="sm"
								variant={draft.chips.includes(chip) ? 'default' : 'outline'}
								aria-pressed={draft.chips.includes(chip)}
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
						disabled={loading || rows.length === 0}
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
						onClick={addCaptain}
						disabled={!pendingCaptain || selectedCaptainIds.size >= 15}
					>
						<Plus className="size-4" />
						{liveT('addCaptain')}
					</Button>
				</div>
				<div className="flex flex-wrap gap-2">
					{draft.captainPlayerIds.map(playerId => {
						const player = playersById.get(playerId)
						return (
							<Badge
								key={playerId}
								variant="outline"
								className="gap-1.5"
							>
								{player?.playerName ?? playerId}
								<button
									type="button"
									aria-label={liveT('removeCaptain', {
										name: player?.playerName ?? String(playerId)
									})}
									onClick={() =>
										setDraft(current => ({
											...current,
											captainPlayerIds: current.captainPlayerIds.filter(
												id => id !== playerId
											)
										}))
									}
								>
									<X className="size-3" />
								</button>
							</Badge>
						)
					})}
				</div>
			</div>

			<div className="space-y-2 rounded-lg border border-border/60 p-3">
				<p className="text-sm font-medium">{t('playerOwnership')}</p>
				<div className="grid gap-2 sm:grid-cols-[1fr_auto]">
					<Select
						value={pendingOwner}
						onValueChange={setPendingOwner}
						disabled={loading}
					>
						<SelectTrigger aria-label={t('addPlayer')}>
							<SelectValue placeholder={t('addPlayer')} />
						</SelectTrigger>
						<SelectContent className="max-h-72">
							{playerOptions
								.filter(player => !selectedOwnerIds.has(player.playerId))
								.map(player => (
									<SelectItem
										key={player.playerId}
										value={String(player.playerId)}
									>
										{player.playerName} · {player.position} ·{' '}
										{player.teamShortName} · {player.percentage.toFixed(1)}%
									</SelectItem>
								))}
						</SelectContent>
					</Select>
					<Button
						type="button"
						variant="outline"
						onClick={addOwner}
						disabled={!pendingOwner || selectedOwnerIds.size >= 5}
					>
						<Plus className="size-4" />
						{t('addPlayer')}
					</Button>
				</div>
				<div className="grid gap-2 sm:grid-cols-2">
					<Select
						value={draft.ownership?.scope ?? 'ANY'}
						onValueChange={scope =>
							setDraft(current => ({
								...current,
								ownership: current.ownership
									? {
											...current.ownership,
											scope: scope as EntryLiveCompetitionPickScope
										}
									: null
							}))
						}
						disabled={!draft.ownership}
					>
						<SelectTrigger aria-label={t('ownershipScope')}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{scopes.map(scope => (
								<SelectItem
									key={scope}
									value={scope}
								>
									{scope === 'ANY'
										? t('any')
										: scope === 'STARTER'
											? t('starter')
											: t('bench')}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={draft.ownership?.captainMode ?? 'ANY'}
						onValueChange={mode =>
							setDraft(current => ({
								...current,
								ownership: current.ownership
									? {
											...current.ownership,
											captainMode: mode as EntryLiveCompetitionCaptainMode
										}
									: null
							}))
						}
						disabled={!draft.ownership}
					>
						<SelectTrigger aria-label={t('captaincyFilter')}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{captainModes.map(mode => (
								<SelectItem
									key={mode}
									value={mode}
								>
									{mode === 'ANY'
										? t('anyCaptain')
										: mode === 'CAPTAIN'
											? t('selectedCaptain')
											: t('selectedViceCaptain')}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-wrap gap-2">
					{(draft.ownership?.playerIds ?? []).map(playerId => {
						const player = rows.find(row => row.playerId === playerId)
						return (
							<Badge
								key={playerId}
								variant="outline"
								className="gap-1.5"
							>
								{player?.playerName ?? playerId}
								<button
									type="button"
									aria-label={t('removePlayer', {
										name: player?.playerName ?? String(playerId)
									})}
									onClick={() =>
										setDraft(current => ({
											...current,
											ownership:
												current.ownership &&
												current.ownership.playerIds.length > 1
													? {
															...current.ownership,
															playerIds: current.ownership.playerIds.filter(
																id => id !== playerId
															)
														}
													: null
										}))
									}
								>
									<X className="size-3" />
								</button>
							</Badge>
						)
					})}
				</div>
			</div>

			<div className="space-y-2 rounded-lg border border-border/60 p-3">
				<p className="text-sm font-medium">{t('teamExposure')}</p>
				<div className="grid gap-2 sm:grid-cols-4">
					<Select
						value={pendingTeam}
						onValueChange={setPendingTeam}
						disabled={loading}
					>
						<SelectTrigger aria-label={t('selectTeamAria')}>
							<SelectValue placeholder={t('selectTeam')} />
						</SelectTrigger>
						<SelectContent>
							{teams.map(team => (
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
					>
						<SelectTrigger aria-label={t('minimumPlayers')}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{Array.from({ length: 15 }, (_, index) => index + 1).map(
								count => (
									<SelectItem
										key={count}
										value={String(count)}
									>
										{count}
									</SelectItem>
								)
							)}
						</SelectContent>
					</Select>
					<Select
						value={pendingTeamScope}
						onValueChange={value =>
							setPendingTeamScope(value as EntryLiveCompetitionPickScope)
						}
					>
						<SelectTrigger aria-label={t('teamScope')}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{scopes.map(scope => (
								<SelectItem
									key={scope}
									value={scope}
								>
									{scope === 'ANY'
										? t('any')
										: scope === 'STARTER'
											? t('starter')
											: t('bench')}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						type="button"
						variant="outline"
						onClick={addTeamRule}
						disabled={!pendingTeam || draft.teamCountRules.length >= 4}
					>
						<Plus className="size-4" />
						{t('addTeam')}
					</Button>
				</div>
				<div className="flex flex-wrap gap-2">
					{draft.teamCountRules.map(rule => {
						const team = teams.find(option => option.id === rule.teamId)
						const key = `${rule.teamId}:${rule.scope}`
						return (
							<Badge
								key={key}
								variant="outline"
								className="gap-1.5"
							>
								{team?.shortName ?? rule.teamId} · {rule.exactCount}
								<button
									type="button"
									aria-label={t('removeTeamItem', {
										team: team?.name ?? String(rule.teamId)
									})}
									onClick={() =>
										setDraft(current => ({
											...current,
											teamCountRules: current.teamCountRules.filter(
												item => `${item.teamId}:${item.scope}` !== key
											)
										}))
									}
								>
									<X className="size-3" />
								</button>
							</Badge>
						)
					})}
				</div>
			</div>

			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="ghost"
					onClick={() => void clear()}
					disabled={disabled || applying}
				>
					{t('clearAll')}
				</Button>
				<Button
					type="button"
					onClick={() => void apply()}
					disabled={disabled || applying}
				>
					{applying ? liveT('loadingStandings') : liveT('applyFilters')}
				</Button>
			</div>
		</Card>
	)
}
