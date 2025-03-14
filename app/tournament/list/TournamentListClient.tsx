'use client'

import RootLayout from '@/components/layout/RootLayout'
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
	Filter,
	MoreHorizontal,
	Plus,
	Search,
	Trophy,
	Users
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

// Mock data for tournaments
const mockTournaments = [
	{
		id: 't1',
		name: 'Premier League Fan Cup',
		managerId: '12',
		managerName: 'tong',
		participantCount: 12,
		groupFormat: 'points',
		knockoutFormat: 'single',
		startGameweek: 'GW22',
		endGameweek: 'GW38',
		created: '2024-01-15',
		lastUpdated: '2024-04-10',
		isActive: true,
		progress: 65 // percent complete
	},
	{
		id: 't2',
		name: 'Champions League Fantasy',
		managerId: '12',
		managerName: 'tong',
		participantCount: 8,
		groupFormat: 'points',
		knockoutFormat: 'double',
		startGameweek: 'GW25',
		endGameweek: 'GW35',
		created: '2024-02-05',
		lastUpdated: '2024-04-08',
		isActive: true,
		progress: 40
	},
	{
		id: 't3',
		name: 'FPL Content Creators Cup',
		managerId: '15',
		managerName: 'Alex',
		participantCount: 16,
		groupFormat: 'headToHead',
		knockoutFormat: 'single',
		startGameweek: 'GW20',
		endGameweek: 'GW30',
		created: '2024-01-02',
		lastUpdated: '2024-03-28',
		isActive: false,
		progress: 100
	},
	{
		id: 't4',
		name: 'Mini-League Challenge',
		managerId: '12',
		managerName: 'tong',
		participantCount: 4,
		groupFormat: 'none',
		knockoutFormat: 'single',
		startGameweek: 'GW30',
		endGameweek: 'GW34',
		created: '2024-03-25',
		lastUpdated: '2024-04-01',
		isActive: true,
		progress: 20
	},
	{
		id: 't5',
		name: 'Work Colleagues Cup',
		managerId: '18',
		managerName: 'Sarah',
		participantCount: 6,
		groupFormat: 'points',
		knockoutFormat: 'none',
		startGameweek: 'GW15',
		endGameweek: 'GW38',
		created: '2023-12-10',
		lastUpdated: '2024-04-11',
		isActive: true,
		progress: 72
	}
]

export default function TournamentListClient() {
	const searchParams = useSearchParams()
	const mineParam = searchParams.get('mine')

	const [searchQuery, setSearchQuery] = useState('')
	const [showOnlyMine, setShowOnlyMine] = useState(mineParam === 'true')
	const [showOnlyActive, setShowOnlyActive] = useState(false)

	// Initialize showOnlyMine from URL parameter
	useEffect(() => {
		if (mineParam === 'true') {
			setShowOnlyMine(true)
		}
	}, [mineParam])

	// Filter tournaments based on search and filters
	const filteredTournaments = mockTournaments.filter(tournament => {
		const matchesSearch =
			tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			tournament.managerName.toLowerCase().includes(searchQuery.toLowerCase())

		const matchesMine = showOnlyMine ? tournament.managerId === '12' : true
		const matchesActive = showOnlyActive ? tournament.isActive : true

		return matchesSearch && matchesMine && matchesActive
	})

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
								variant={showOnlyMine ? 'default' : 'outline'}
								size="sm"
								onClick={() => setShowOnlyMine(!showOnlyMine)}
								className="flex items-center gap-2"
							>
								My Tournaments
							</Button>

							<Button
								variant={showOnlyActive ? 'default' : 'outline'}
								size="sm"
								onClick={() => setShowOnlyActive(!showOnlyActive)}
								className="flex items-center gap-2"
							>
								Active Only
							</Button>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="flex items-center gap-2"
									>
										<Filter className="h-4 w-4" />
										<span className="hidden sm:inline">More Filters</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="w-56"
								>
									<DropdownMenuLabel>Filter Options</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem>
										<div className="flex items-center w-full justify-between">
											<span>Group Stage Only</span>
											<input
												type="checkbox"
												className="h-4 w-4"
											/>
										</div>
									</DropdownMenuItem>
									<DropdownMenuItem>
										<div className="flex items-center w-full justify-between">
											<span>Knockout Only</span>
											<input
												type="checkbox"
												className="h-4 w-4"
											/>
										</div>
									</DropdownMenuItem>
									<DropdownMenuItem>
										<div className="flex items-center w-full justify-between">
											<span>Completed</span>
											<input
												type="checkbox"
												className="h-4 w-4"
											/>
										</div>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>

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
									<DropdownMenuItem>Newest First</DropdownMenuItem>
									<DropdownMenuItem>Oldest First</DropdownMenuItem>
									<DropdownMenuItem>Name (A-Z)</DropdownMenuItem>
									<DropdownMenuItem>Name (Z-A)</DropdownMenuItem>
									<DropdownMenuItem>Most Participants</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Tournament</TableHead>
									<TableHead>Manager</TableHead>
									<TableHead>Format</TableHead>
									<TableHead>Gameweeks</TableHead>
									<TableHead>Progress</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredTournaments.map(tournament => (
									<TableRow key={tournament.id}>
										<TableCell>
											<div className="font-medium">{tournament.name}</div>
											<div className="text-sm text-muted-foreground">
												{tournament.participantCount} participants
											</div>
										</TableCell>
										<TableCell>{tournament.managerName}</TableCell>
										<TableCell>
											<div className="flex flex-col gap-1">
												<Badge variant="outline">
													{tournament.groupFormat === 'none'
														? 'No Groups'
														: tournament.groupFormat === 'points'
														? 'Points Based'
														: 'Head-to-Head'}
												</Badge>
												<Badge variant="outline">
													{tournament.knockoutFormat === 'none'
														? 'No Knockout'
														: tournament.knockoutFormat === 'single'
														? 'Single Elimination'
														: 'Home & Away'}
												</Badge>
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
												{tournament.progress}%
											</div>
										</TableCell>
										<TableCell>
											<Badge
												variant={tournament.isActive ? 'default' : 'secondary'}
											>
												{tournament.isActive ? 'Active' : 'Completed'}
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
													{tournament.managerId === '12' && (
														<>
															<DropdownMenuItem>
																<Link
																	href={`/tournament/${tournament.id}/manage`}
																	className="flex items-center gap-2"
																>
																	<Users className="h-4 w-4" />
																	Manage Tournament
																</Link>
															</DropdownMenuItem>
														</>
													)}
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
