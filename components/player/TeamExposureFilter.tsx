'use client'

import { Button } from '@/components/ui/button'
import { SelectedFilterBadge } from '@/components/player/SelectedFilterBadge'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { type OwnershipScope } from '@/lib/player-ownership-filter'
import {
	getTeamExposureFilterSummary,
	type TeamExposureEntry,
	type TeamExposureRule
} from '@/lib/team-exposure-filter'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_TEAMS_FOR_PICKER,
	type TeamsForPickerResponse
} from '@/lib/graphql/operations/players'
import { cn } from '@/lib/utils'
import { Plus, Shirt, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

interface TeamExposureFilterProps {
	entries: TeamExposureEntry[]
	onMatchedEntryIdsChange: (entryIds: string[] | null) => void
	className?: string
	onDismiss?: () => void
}

type SelectedTeam = {
	shortName: string
	name: string
	count: number
}

export function TeamExposureFilter({
	entries,
	onMatchedEntryIdsChange,
	className,
	onDismiss
}: TeamExposureFilterProps) {
	const t = useTranslations('Filters')
	const [pendingTeam, setPendingTeam] = useState<string>('')
	const [pendingCount, setPendingCount] = useState<number>(1)
	const [scope, setScope] = useState<OwnershipScope>('any')
	const [selectedTeams, setSelectedTeams] = useState<SelectedTeam[]>([])
	const [isTeamPickerOpen, setIsTeamPickerOpen] = useState(false)
	const [allTeams, setAllTeams] = useState<
		{ shortName: string; name: string }[]
	>([])

	useEffect(() => {
		executeQuery<TeamsForPickerResponse>(GET_TEAMS_FOR_PICKER)
			.then(data =>
				setAllTeams(
					data.teams
						.map(team => ({ shortName: team.shortName, name: team.name }))
						.sort((a, b) => a.name.localeCompare(b.name))
				)
			)
			.catch(error => {
				console.warn('Team directory unavailable for exposure filter:', error)
			})
	}, [])

	// Teams present in current standings (with display names from picker when possible)
	const teamsInStandings = useMemo(() => {
		const byShort = new Map<string, string>()
		for (const entry of entries) {
			for (const pick of entry.picks) {
				if (!pick.teamShortName) continue
				if (!byShort.has(pick.teamShortName)) {
					byShort.set(pick.teamShortName, pick.teamName || pick.teamShortName)
				}
			}
		}
		return byShort
	}, [entries])

	const selectedShortNames = useMemo(
		() => new Set(selectedTeams.map(team => team.shortName)),
		[selectedTeams]
	)

	const teamOptions = useMemo(() => {
		const nameByShort = new Map(allTeams.map(t => [t.shortName, t.name]))
		return Array.from(teamsInStandings.entries())
			.filter(([shortName]) => !selectedShortNames.has(shortName))
			.map(([shortName, fallbackName]) => ({
				shortName,
				name: nameByShort.get(shortName) ?? fallbackName
			}))
			.sort((a, b) => a.name.localeCompare(b.name))
	}, [allTeams, selectedShortNames, teamsInStandings])

	const rules: TeamExposureRule[] = useMemo(
		() =>
			selectedTeams.map(team => ({
				teamShortName: team.shortName,
				exactCount: team.count
			})),
		[selectedTeams]
	)

	const summary = useMemo(
		() => getTeamExposureFilterSummary(entries, rules, scope),
		[entries, rules, scope]
	)

	const isActive = selectedTeams.length > 0
	const scopeLabels: Record<OwnershipScope, string> = {
		any: t('any'),
		starter: t('starter'),
		bench: t('bench')
	}

	useEffect(() => {
		onMatchedEntryIdsChange(isActive ? summary.matchedEntryIds : null)
	}, [isActive, onMatchedEntryIdsChange, summary.matchedEntryIds])

	const addTeam = () => {
		if (!pendingTeam) return
		if (selectedShortNames.has(pendingTeam)) return
		const option = teamOptions.find(team => team.shortName === pendingTeam)
		const name =
			option?.name ??
			allTeams.find(team => team.shortName === pendingTeam)?.name ??
			pendingTeam

		setSelectedTeams(current => [
			...current,
			{ shortName: pendingTeam, name, count: pendingCount }
		])
		setPendingTeam('')
		setPendingCount(1)
	}

	const handleAddTeamClick = () => {
		if (!pendingTeam) {
			setIsTeamPickerOpen(true)
			return
		}
		addTeam()
	}

	const removeTeam = (shortName: string) => {
		setSelectedTeams(current =>
			current.filter(team => team.shortName !== shortName)
		)
	}

	const handleClear = () => {
		setSelectedTeams([])
		setPendingTeam('')
		setPendingCount(1)
		setScope('any')
	}

	return (
		<div
			className={cn(
				'mb-4 rounded-lg border bg-card p-4 last:mb-0 md:mb-6',
				className
			)}
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 items-start justify-between gap-3">
					<div>
						<div className="flex items-center gap-2 text-sm font-medium">
							<Shirt className="h-4 w-4 text-primary-ink" />
							{t('teamExposure')}
						</div>
						<div className="mt-1 text-xs text-muted-foreground">
							{t('matched', {
								matched: summary.matchedCount,
								total: summary.totalCount,
								percentage: summary.percentage
							})}
						</div>
					</div>
					{onDismiss ? (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-8 shrink-0"
							aria-label={t('hideFilter', { name: t('teamExposure') })}
							title={t('hideFilter', { name: t('teamExposure') })}
							onClick={onDismiss}
						>
							<X className="h-4 w-4" />
						</Button>
					) : null}
				</div>

				<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
					{/* Shared scope for all selected teams */}
					<Select
						value={scope}
						onValueChange={v => setScope(v as OwnershipScope)}
					>
						<SelectTrigger
							className="col-span-2 h-10 min-h-10 w-full sm:col-span-1 sm:h-9 sm:min-h-9 sm:w-[110px]"
							aria-label={t('teamScope')}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="any">{t('any')}</SelectItem>
							<SelectItem value="starter">{t('starter')}</SelectItem>
							<SelectItem value="bench">{t('bench')}</SelectItem>
						</SelectContent>
					</Select>

					{/* Pending team + count, then add like ownership */}
					<Select
						value={pendingTeam}
						onValueChange={value => {
							setPendingTeam(value)
							setIsTeamPickerOpen(false)
						}}
						open={isTeamPickerOpen}
						onOpenChange={setIsTeamPickerOpen}
						disabled={teamOptions.length === 0}
					>
						<SelectTrigger
							className="col-span-2 h-10 min-h-10 w-full sm:col-span-1 sm:h-9 sm:min-h-9 sm:w-[160px]"
							aria-label={t('selectTeamAria')}
						>
							<SelectValue placeholder={t('selectTeam')} />
						</SelectTrigger>
						<SelectContent>
							{teamOptions.map(team => (
								<SelectItem
									key={team.shortName}
									value={team.shortName}
								>
									{team.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={String(pendingCount)}
						onValueChange={v => setPendingCount(Number(v))}
					>
						<SelectTrigger
							className="h-10 min-h-10 w-full sm:h-9 sm:min-h-9 sm:w-[80px]"
							aria-label={t('minimumPlayers')}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="1">1</SelectItem>
							<SelectItem value="2">2</SelectItem>
							<SelectItem value="3">3</SelectItem>
						</SelectContent>
					</Select>

					<Button
						type="button"
						variant="outline"
						className="h-10 min-h-10 w-full sm:h-9 sm:min-h-9 sm:w-auto"
						disabled={teamOptions.length === 0}
						onClick={handleAddTeamClick}
					>
						<Plus className="h-4 w-4" />
						{t('addTeam')}
					</Button>
				</div>
			</div>

			{selectedTeams.length > 0 ? (
				<div className="mt-3 flex flex-wrap gap-2">
					{selectedTeams.map(team => (
						<SelectedFilterBadge
							key={team.shortName}
							name={team.name}
							details={`${team.shortName} · ${team.count} · ${scopeLabels[scope]}`}
							removeLabel={t('removeTeamItem', { team: team.name })}
							onRemove={() => removeTeam(team.shortName)}
						/>
					))}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={handleClear}
					>
						{t('clearAll')}
					</Button>
				</div>
			) : (
				<div className="mt-3 rounded-md bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
					{t('noTeamFilter')}
				</div>
			)}
		</div>
	)
}
