'use client'

import PageShell from '@/components/layout/PageShell'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { TournamentLifecycleBadge } from '@/components/tournament/TournamentLifecycleBadge'
import type { EntryTournamentListItem } from '@/lib/graphql/operations/tournaments'
import { mapTournamentGroupFormat } from '@/lib/tournament/liveTournament'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table'
import {
	ArrowUpDown,
	Calendar,
	ExternalLink,
	MoreHorizontal,
	Plus,
	Search,
	Settings,
} from 'lucide-react'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'

/** Membership lists are usually small; still progressive for heavy accounts. */
const PREVIEW_ROWS = 20
const ROW_STEP = 20

type TournamentRow = {
	tournament: EntryTournamentListItem
	id: string
	adminEntryId: number
	name: string
	creatorName: string
	/** Official FPL league name when copied (Classic import). */
	sourceLeagueName: string | null
	participantCount: number
	leagueType: string
	state: string
	groupFormat: ReturnType<typeof mapTournamentGroupFormat>
	knockoutFormat: 'none' | 'single' | 'double'
	startGameweek: number | null
	endGameweek: number | null
	updatedAt: string
}

type SortOption =
	| 'updatedDesc'
	| 'updatedAsc'
	| 'nameAsc'
	| 'nameDesc'
	| 'participantsDesc'

/**
 * League type — Classic (copy official FPL league) is the common path.
 * Exclusive chips.
 */
type TypeFilter = 'all' | 'CLASSIC' | 'H2H'

/** Lifecycle state filter — exclusive (not multi-select). */
type StatusFilter = 'all' | 'ACTIVE' | 'FINISHED' | 'INACTIVE'

const TYPE_FILTERS: ReadonlyArray<TypeFilter> = ['all', 'CLASSIC', 'H2H']

const STATUS_FILTERS: ReadonlyArray<StatusFilter> = [
	'all',
	'ACTIVE',
	'FINISHED',
	'INACTIVE',
]

const mapKnockoutFormat = (knockoutMode: string): TournamentRow['knockoutFormat'] => {
	if (knockoutMode === 'SINGLE_ELIMINATION') {
		return 'single'
	}
	if (knockoutMode === 'DOUBLE_ELIMINATION') {
		return 'double'
	}
	return 'none'
}

const mapTournamentToRow = (tournament: EntryTournamentListItem): TournamentRow => {
	return {
		tournament,
		id: String(tournament.id),
		adminEntryId: tournament.adminEntryId,
		name: tournament.name,
		creatorName: tournament.creator,
		sourceLeagueName: tournament.sourceLeagueName,
		participantCount: tournament.totalTeamNum,
		leagueType: tournament.leagueType,
		state: tournament.state,
		groupFormat: mapTournamentGroupFormat(tournament.groupMode),
		knockoutFormat: mapKnockoutFormat(tournament.knockoutMode),
		startGameweek: tournament.groupStartedEventId,
		endGameweek: tournament.groupEndedEventId,
		updatedAt: tournament.updatedAt,
	}
}

export default function TournamentListClient({
	currentEntryId,
	initialTournaments,
	initialError,
	initialAdminOnly = false,
}: {
	currentEntryId: number
	initialTournaments: EntryTournamentListItem[]
	initialError: string | null
	/** From ?mine=true — filter to tournaments this entry administers */
	initialAdminOnly?: boolean
}) {
	const t = useTranslations('TournamentList')
	const router = useRouter()
	const pathname = usePathname()
	const [searchQuery, setSearchQuery] = useState('')
	/**
	 * Default Classic — most LetLetMe tournaments are copied official Classic leagues.
	 * Users can switch to All / H2H.
	 */
	const [typeFilter, setTypeFilter] = useState<TypeFilter>('CLASSIC')
	/** Exclusive status chip: all | active | finished | paused */
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
	/** Show only tournaments this entry administers */
	const [adminOnly, setAdminOnly] = useState(initialAdminOnly)
	const tournaments = useMemo(
		() => initialTournaments.map(mapTournamentToRow),
		[initialTournaments],
	)

	const setAdminOnlyAndUrl = useCallback(
		(next: boolean) => {
			setAdminOnly(next)
			const params = new URLSearchParams(
				typeof window !== 'undefined' ? window.location.search : '',
			)
			if (next) {
				params.set('mine', 'true')
			} else {
				params.delete('mine')
			}
			const qs = params.toString()
			router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
		},
		[pathname, router],
	)
	const [sortOption, setSortOption] = useState<SortOption>('updatedDesc')
	const getLeagueType = (type: string) => type === 'H2H' ? t('headToHead') : type === 'CLASSIC' ? t('classic') : type

	const typeFilterLabel = (filter: TypeFilter): string => {
		switch (filter) {
			case 'CLASSIC':
				return t('filterClassic')
			case 'H2H':
				return t('filterH2h')
			default:
				return t('filterAll')
		}
	}

	const statusFilterLabel = (filter: StatusFilter): string => {
		switch (filter) {
			case 'ACTIVE':
				return t('filterActive')
			case 'FINISHED':
				return t('filterFinished')
			case 'INACTIVE':
				return t('filterPaused')
			default:
				return t('filterAll')
		}
	}

	// Filter tournaments based on search and filters
	const filteredTournaments = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase()
		const filtered = tournaments.filter(tournament => {
			const matchesSearch =
				!normalizedQuery ||
				tournament.name.toLowerCase().includes(normalizedQuery) ||
				tournament.creatorName.toLowerCase().includes(normalizedQuery) ||
				(tournament.sourceLeagueName?.toLowerCase().includes(normalizedQuery) ??
					false)

			const matchesType =
				typeFilter === 'all' || tournament.leagueType === typeFilter

			const matchesStatus =
				statusFilter === 'all' || tournament.state === statusFilter

			const matchesAdmin =
				!adminOnly || tournament.adminEntryId === currentEntryId

			return matchesSearch && matchesType && matchesStatus && matchesAdmin
		})

		return filtered.sort((a, b) => {
			if (sortOption === 'nameAsc') {
				return a.name.localeCompare(b.name)
			}
			if (sortOption === 'nameDesc') {
				return b.name.localeCompare(a.name)
			}
			if (sortOption === 'participantsDesc') {
				return b.participantCount - a.participantCount
			}

			const aUpdatedAt = new Date(a.updatedAt).getTime()
			const bUpdatedAt = new Date(b.updatedAt).getTime()
			if (sortOption === 'updatedAsc') {
				return aUpdatedAt - bUpdatedAt
			}
			return bUpdatedAt - aUpdatedAt
		})
	}, [
		adminOnly,
		currentEntryId,
		searchQuery,
		sortOption,
		statusFilter,
		tournaments,
		typeFilter,
	])

	const [visibleCount, setVisibleCount] = useState(PREVIEW_ROWS)
	useEffect(() => {
		setVisibleCount(PREVIEW_ROWS)
	}, [adminOnly, searchQuery, sortOption, statusFilter, typeFilter, tournaments])

	const totalFiltered = filteredTournaments.length
	const visibleTournaments = filteredTournaments.slice(0, visibleCount)
	const hasMore = totalFiltered > visibleCount
	const remaining = Math.max(0, totalFiltered - visibleCount)
	const canCollapse = visibleCount > PREVIEW_ROWS && totalFiltered > PREVIEW_ROWS
	const nextStep = Math.min(ROW_STEP, remaining)

	return (
		<PageShell>
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<StatsPageHeader
					eyebrow={t('eyebrow')}
					title={t('title')}
					badge={
						<Button className="gap-2 shadow-sm" asChild>
							<Link href="/competitions/create">
								<Plus className="size-4" aria-hidden="true" />
								{t('create')}
							</Link>
						</Button>
					}
				/>

				<Card className="mb-8 border-border/80 p-4 shadow-sm sm:p-6">
					{initialError && (
						<div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
							{initialError}
						</div>
					)}
					<div className="flex flex-col md:flex-row gap-4 mb-6">
						<div className="relative flex-1">
							<Search className="absolute top-1/2 left-3 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								aria-label={t('search')}
								placeholder={t('searchPlaceholder')}
								value={searchQuery}
								onChange={e => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
						</div>

						<div
							className="flex flex-wrap items-center gap-2"
							role="toolbar"
							aria-label={t('filters')}
						>
							{/* Type first — Classic (official league copy) is the main product path */}
							<div
								className="flex flex-wrap gap-1.5"
								role="group"
								aria-label={t('filterType')}
							>
								{TYPE_FILTERS.map(filter => (
									<Button
										key={filter}
										variant={typeFilter === filter ? 'default' : 'outline'}
										size="sm"
										onClick={() => setTypeFilter(filter)}
										aria-pressed={typeFilter === filter}
									>
										{typeFilterLabel(filter)}
									</Button>
								))}
							</div>
							<div
								className="flex flex-wrap gap-1.5"
								role="group"
								aria-label={t('filterStatus')}
							>
								{STATUS_FILTERS.map(filter => (
									<Button
										key={filter}
										variant={
											statusFilter === filter ? 'default' : 'outline'
										}
										size="sm"
										onClick={() => setStatusFilter(filter)}
										aria-pressed={statusFilter === filter}
									>
										{statusFilterLabel(filter)}
									</Button>
								))}
							</div>
							<Button
								variant={adminOnly ? 'default' : 'outline'}
								size="sm"
								onClick={() => setAdminOnlyAndUrl(!adminOnly)}
								aria-pressed={adminOnly}
							>
								{t('filterAdminOnly')}
							</Button>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="flex items-center gap-2"
									>
										<ArrowUpDown className="h-4 w-4" />
										<span className="hidden sm:inline">{t('sort')}</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="w-56"
								>
									<DropdownMenuLabel>{t('sortOptions')}</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={() => setSortOption('updatedDesc')}>
										{t('updatedNewest')}
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setSortOption('updatedAsc')}>
										{t('updatedOldest')}
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setSortOption('nameAsc')}>
										{t('nameAscending')}
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setSortOption('nameDesc')}>
										{t('nameDescending')}
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => setSortOption('participantsDesc')}
									>
										{t('mostParticipants')}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('tournament')}</TableHead>
									<TableHead>{t('participants')}</TableHead>
									<TableHead>{t('creator')}</TableHead>
									<TableHead>{t('type')}</TableHead>
									<TableHead>{t('format')}</TableHead>
									<TableHead>{t('gameweeks')}</TableHead>
									<TableHead>{t('status')}</TableHead>
									<TableHead>{t('actions')}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredTournaments.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={8}
											className="text-center text-muted-foreground"
										>
											{initialError
												? t('unable')
												: t('noMatches')}
										</TableCell>
									</TableRow>
								)}
								{visibleTournaments.map(tournament => (
									<TableRow key={tournament.id}>
										<TableCell>
											<div className="font-medium">{tournament.name}</div>
										</TableCell>
										<TableCell>{tournament.participantCount}</TableCell>
										<TableCell>{tournament.creatorName}</TableCell>
										<TableCell>
											<Badge variant="outline">{getLeagueType(tournament.leagueType)}</Badge>
										</TableCell>
										<TableCell>
											<div className="text-sm leading-5">
												<div>
													{tournament.groupFormat === 'none'
												? t('noGroups')
														: tournament.groupFormat === 'points'
												? t('pointsBased')
												: t('headToHead')}
												</div>
												<div className="text-muted-foreground">
													{tournament.knockoutFormat === 'none'
												? t('noKnockout')
														: tournament.knockoutFormat === 'single'
												? t('singleElimination')
												: t('homeAway')}
												</div>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<Calendar className="h-4 w-4 text-muted-foreground" />
												<span>
												{tournament.startGameweek ? t('gameweek', { gameweek: tournament.startGameweek }) : '—'} – {tournament.endGameweek ? t('gameweek', { gameweek: tournament.endGameweek }) : '—'}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<TournamentLifecycleBadge tournament={tournament.tournament} />
										</TableCell>
										<TableCell>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														aria-label={t('actionsFor', { name: tournament.name })}
													>
														<MoreHorizontal className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem asChild>
														<Link
															href={`/live/competitions/${tournament.id}`}
															className="flex items-center gap-2"
														>
															<ExternalLink className="h-4 w-4" />
															{t('viewLive')}
														</Link>
													</DropdownMenuItem>
													{tournament.adminEntryId === currentEntryId ? (
														<DropdownMenuItem asChild>
															<Link
																href={`/competitions/${tournament.id}/manage`}
																className="flex items-center gap-2"
															>
																<Settings className="h-4 w-4" />
																{t('manage')}
															</Link>
														</DropdownMenuItem>
													) : null}
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					{hasMore || canCollapse ? (
						<div className="mt-4 flex flex-wrap items-center justify-center gap-2">
							{totalFiltered > PREVIEW_ROWS ? (
								<p className="w-full text-center text-xs text-muted-foreground">
									{t('showingTournaments', {
										shown: Math.min(visibleCount, totalFiltered),
										total: totalFiltered,
									})}
								</p>
							) : null}
							{hasMore ? (
								<>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="text-xs"
										onClick={() =>
											setVisibleCount(c =>
												Math.min(c + ROW_STEP, totalFiltered),
											)
										}
									>
										{t('showMoreTournaments', { count: nextStep })}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-xs"
										onClick={() => setVisibleCount(totalFiltered)}
									>
										{t('showAllTournaments', { count: totalFiltered })}
									</Button>
								</>
							) : null}
							{canCollapse ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="text-xs"
									onClick={() => setVisibleCount(PREVIEW_ROWS)}
								>
									{t('showLessTournaments')}
								</Button>
							) : null}
						</div>
					) : null}
				</Card>
			</div>
		</PageShell>
	)
}
