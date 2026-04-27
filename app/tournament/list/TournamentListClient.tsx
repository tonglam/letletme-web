'use client'

import RootLayout from '@/components/layout/RootLayout'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY_TOURNAMENTS,
	type EntryTournament,
	type EntryTournamentsResponse
} from '@/lib/graphql/queries'
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
	Trophy,
	Users
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'


type TournamentRow = {
	id: string
	name: string
	managerName: string
	participantCount: number
	leagueType: string
	state: string
	groupFormat: 'none' | 'points' | 'headToHead'
	knockoutFormat: 'none' | 'single' | 'double'
	startGameweek: string
	endGameweek: string
	updatedAt: string
	progress: number
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
	const startGameweek = tournament.groupStartedEventId
		? `GW${tournament.groupStartedEventId}`
		: '-'
	const endGameweek = tournament.groupEndedEventId
		? `GW${tournament.groupEndedEventId}`
		: '-'
	const progress =
		tournament.state === 'COMPLETED' ? 100 : tournament.state === 'ACTIVE' ? 50 : 0

	return {
		id: String(tournament.id),
		name: tournament.name,
		managerName: tournament.creator,
		participantCount: tournament.totalTeamNum,
		leagueType: tournament.leagueType,
		state: tournament.state,
		groupFormat: mapGroupFormat(tournament.groupMode),
		knockoutFormat: mapKnockoutFormat(tournament.knockoutMode),
		startGameweek,
		endGameweek,
		updatedAt: tournament.updatedAt,
		progress
	}
}

const formatDate = (isoDate: string): string => {
	const parsed = new Date(isoDate)
	if (Number.isNaN(parsed.getTime())) {
		return '-'
	}
	return parsed.toLocaleDateString()
}

const getStateLabel = (state: string): string => {
	if (state === 'ACTIVE') {
		return 'Active'
	}
	if (state === 'COMPLETED') {
		return 'Completed'
	}
	if (state === 'PENDING') {
		return 'Pending'
	}
	return state
}

const getProgressLabel = (state: string): string => {
	if (state === 'COMPLETED') {
		return 'Finished'
	}
	if (state === 'ACTIVE') {
		return 'In progress'
	}
	if (state === 'PENDING') {
		return 'Not started'
	}
	return 'In progress'
}

export default function TournamentListClient({ entryId }: { entryId: number }) {
	const [searchQuery, setSearchQuery] = useState('')
	const [showOnlyActive, setShowOnlyActive] = useState(false)
	const [showOnlyKnockout, setShowOnlyKnockout] = useState(false)
	const [tournaments, setTournaments] = useState<TournamentRow[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [sortOption, setSortOption] = useState<SortOption>('updatedDesc')

	useEffect(() => {
		let isCancelled = false

		const loadEntryTournaments = async () => {
			try {
				setIsLoading(true)
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
				setTournaments(data.entryTournaments.map(mapTournamentToRow))
			} catch (error) {
				if (isCancelled) {
					return
				}
				const message =
					error instanceof Error ? error.message : 'Failed to load tournaments'
				setLoadError(message)
				setTournaments([])
			} finally {
				if (!isCancelled) {
					setIsLoading(false)
				}
			}
		}

		loadEntryTournaments()

		return () => {
			isCancelled = true
		}
	}, [])

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
		<RootLayout>
			<div className="container max-w-6xl mx-auto px-4 py-8">
				<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
					<div className="flex items-center gap-3">
						<Trophy className="h-8 w-8 text-primary" />
						<h1 className="text-3xl font-bold">Tournaments</h1>
					</div>

					<Link href="/tournament/create">
						<Button className="flex items-center gap-2">
							<Plus className="h-4 w-4" />
							Create Tournament
						</Button>
					</Link>
				</div>

				<Card className="p-6 mb-8">
					{loadError && (
						<div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
							{loadError}
						</div>
					)}
					<div className="flex flex-col md:flex-row gap-4 mb-6">
						<div className="relative flex-1">
							<Search className="absolute top-1/2 left-3 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search tournaments..."
								value={searchQuery}
								onChange={e => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
						</div>

						<div className="flex flex-wrap gap-2">
							<Button
								variant="default"
								size="sm"
								className="flex items-center gap-2"
								disabled
							>
								Joined Tournaments
							</Button>

							<Button
								variant={showOnlyActive ? 'default' : 'outline'}
								size="sm"
								onClick={() => setShowOnlyActive(!showOnlyActive)}
								className="flex items-center gap-2"
							>
								Active Only
							</Button>
							<Button
								variant={showOnlyKnockout ? 'default' : 'outline'}
								size="sm"
								onClick={() => setShowOnlyKnockout(!showOnlyKnockout)}
								className="flex items-center gap-2"
							>
								Knockout Only
							</Button>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="flex items-center gap-2"
									>
										<ArrowUpDown className="h-4 w-4" />
										<span className="hidden sm:inline">Sort</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="w-56"
								>
									<DropdownMenuLabel>Sort Options</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={() => setSortOption('updatedDesc')}>
										Last Updated (Newest)
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setSortOption('updatedAsc')}>
										Last Updated (Oldest)
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setSortOption('nameAsc')}>
										Name (A-Z)
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setSortOption('nameDesc')}>
										Name (Z-A)
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => setSortOption('participantsDesc')}
									>
										Most Participants
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Tournament</TableHead>
									<TableHead>Participants</TableHead>
									<TableHead>Manager</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Format</TableHead>
									<TableHead>Gameweeks</TableHead>
									<TableHead>Progress</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading && (
									<TableRow>
										<TableCell
											colSpan={9}
											className="text-center text-muted-foreground"
										>
											Loading tournaments...
										</TableCell>
									</TableRow>
								)}
								{!isLoading && filteredTournaments.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={9}
											className="text-center text-muted-foreground"
										>
											{loadError
												? 'Unable to show tournaments.'
												: 'No tournaments match your filters.'}
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
											<Badge variant="outline">{tournament.leagueType}</Badge>
										</TableCell>
										<TableCell>
											<div className="text-sm leading-5">
												<div>
													{tournament.groupFormat === 'none'
														? 'No Groups'
														: tournament.groupFormat === 'points'
														? 'Points Based'
														: 'Head-to-Head'}
												</div>
												<div className="text-muted-foreground">
													{tournament.knockoutFormat === 'none'
														? 'No Knockout'
														: tournament.knockoutFormat === 'single'
														? 'Single Elimination'
														: 'Home & Away'}
												</div>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<Calendar className="h-4 w-4 text-muted-foreground" />
												<span>
													{tournament.startGameweek} - {tournament.endGameweek}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
												<div
													className="bg-primary h-full transition-all duration-300"
													style={{ width: `${tournament.progress}%` }}
												/>
											</div>
											<div className="text-sm text-muted-foreground mt-1">
												{getProgressLabel(tournament.state)}
											</div>
										</TableCell>
										<TableCell>
											<Badge
												variant={
													tournament.state === 'ACTIVE' ? 'default' : 'secondary'
												}
											>
												{getStateLabel(tournament.state)}
											</Badge>
										</TableCell>
										<TableCell>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="sm"
													>
														<MoreHorizontal className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem>
														<Link
															href={`/tournament/${tournament.id}`}
															className="flex items-center gap-2"
														>
															<ExternalLink className="h-4 w-4" />
															View Details
														</Link>
													</DropdownMenuItem>
													<DropdownMenuItem>
														<Link
															href={`/tournament/${tournament.id}/manage`}
															className="flex items-center gap-2"
														>
															<Users className="h-4 w-4" />
															Manage Tournament
														</Link>
													</DropdownMenuItem>
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
		</RootLayout>
	)
}
