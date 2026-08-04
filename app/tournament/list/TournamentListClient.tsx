'use client'

import PageShell from '@/components/layout/PageShell'
import { TournamentLifecycleBadge } from '@/components/tournament/TournamentLifecycleBadge'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
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
	Trophy
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

type TournamentRow = {
	tournament: EntryTournament
	id: string
	adminEntryId: number
	name: string
	managerName: string
	participantCount: number
	leagueType: string
	state: string
	groupFormat: 'none' | 'points' | 'headToHead'
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

const mapGroupFormat = (groupMode: string): TournamentRow['groupFormat'] => {
	if (groupMode === 'POINTS_RACES') {
		return 'points'
	}
	if (groupMode === 'H2H') {
		return 'headToHead'
	}
	return 'none'
}

const mapKnockoutFormat = (knockoutMode: string): TournamentRow['knockoutFormat'] => {
	if (knockoutMode === 'SINGLE_ELIMINATION') {
		return 'single'
	}
	if (knockoutMode === 'DOUBLE_ELIMINATION') {
		return 'double'
	}
	return 'none'
}

const mapTournamentToRow = (tournament: EntryTournament): TournamentRow => {
	return {
		tournament,
		id: String(tournament.id),
		adminEntryId: tournament.adminEntryId,
		name: tournament.name,
		managerName: tournament.creator,
		participantCount: tournament.totalTeamNum,
		leagueType: tournament.leagueType,
		state: tournament.state,
		groupFormat: mapGroupFormat(tournament.groupMode),
		knockoutFormat: mapKnockoutFormat(tournament.knockoutMode),
		startGameweek: tournament.groupStartedEventId,
		endGameweek: tournament.groupEndedEventId,
		updatedAt: tournament.updatedAt
	}
}

export default function TournamentListClient({
	currentEntryId,
	initialTournaments,
	initialError,
}: {
	currentEntryId: number
	initialTournaments: EntryTournament[]
	initialError: string | null
}) {
	const t = useTranslations('TournamentList')
	const [searchQuery, setSearchQuery] = useState('')
	const [showOnlyActive, setShowOnlyActive] = useState(false)
	const [showOnlyKnockout, setShowOnlyKnockout] = useState(false)
	const tournaments = useMemo(
		() => initialTournaments.map(mapTournamentToRow),
		[initialTournaments],
	)
	const [sortOption, setSortOption] = useState<SortOption>('updatedDesc')
	const getLeagueType = (type: string) => type === 'H2H' ? t('headToHead') : type === 'CLASSIC' ? t('classic') : type

	// Filter tournaments based on search and filters
	const filteredTournaments = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase()
		const filtered = tournaments.filter(tournament => {
			const matchesSearch =
				tournament.name.toLowerCase().includes(normalizedQuery) ||
				tournament.managerName.toLowerCase().includes(normalizedQuery)

			const matchesActive = showOnlyActive
				? tournament.state === 'ACTIVE'
				: true
			const matchesKnockout = showOnlyKnockout
				? tournament.knockoutFormat !== 'none'
				: true

			return matchesSearch && matchesActive && matchesKnockout
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
	}, [searchQuery, showOnlyActive, showOnlyKnockout, sortOption, tournaments])

	return (
		<PageShell>
			<div className="container max-w-6xl mx-auto px-4 py-8">
				<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
					<div className="flex items-center gap-3">
						<Trophy className="h-8 w-8 text-primary-ink" />
						<h1 className="text-3xl font-bold">{t('title')}</h1>
					</div>

					<Button className="flex items-center gap-2" asChild>
						<Link href="/tournament/create">
							<Plus className="h-4 w-4" />
							{t('create')}
						</Link>
					</Button>
				</div>

				<Card className="p-6 mb-8">
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

						<div className="flex flex-wrap gap-2">
							<Button
								variant={showOnlyActive ? 'default' : 'outline'}
								size="sm"
								onClick={() => setShowOnlyActive(!showOnlyActive)}
								aria-pressed={showOnlyActive}
								className="flex items-center gap-2"
							>
								{t('activeOnly')}
							</Button>
							<Button
								variant={showOnlyKnockout ? 'default' : 'outline'}
								size="sm"
								onClick={() => setShowOnlyKnockout(!showOnlyKnockout)}
								aria-pressed={showOnlyKnockout}
								className="flex items-center gap-2"
							>
								{t('knockoutOnly')}
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
									<TableHead>{t('manager')}</TableHead>
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
								{filteredTournaments.map(tournament => (
									<TableRow key={tournament.id}>
										<TableCell>
											<div className="font-medium">{tournament.name}</div>
										</TableCell>
										<TableCell>{tournament.participantCount}</TableCell>
										<TableCell>{tournament.managerName}</TableCell>
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
															href={`/live/tournament/${tournament.id}`}
															className="flex items-center gap-2"
														>
															<ExternalLink className="h-4 w-4" />
															{t('viewLive')}
												</Link>
											</DropdownMenuItem>
											{tournament.adminEntryId === currentEntryId ? (
												<DropdownMenuItem asChild>
													<Link
														href={`/tournament/${tournament.id}/manage`}
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
				</Card>
			</div>
		</PageShell>
	)
}
