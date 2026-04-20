'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@/components/ui/tooltip'
import { Match, PlayerStat } from '@/types/match'
import { PlayerDetail } from '@/types/player-detail'
import { format } from 'date-fns'
import { Activity, AlertTriangle, Award, BarChart2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Eye, Save, Shield, Target, User, XCircle } from 'lucide-react'
import Image from 'next/image'
import { memo, useMemo, useRef, useState } from 'react'
import { PlayerDetailModal } from './PlayerDetailModal'

interface MatchCardProps {
	match: Match
	allMatches?: Match[]
	currentIndex?: number
}

function MatchCardComponent({ match, allMatches, currentIndex }: MatchCardProps) {
	const cardRef = useRef<HTMLDivElement>(null)
	const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetail | null>(
		null
	)
	const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
	const [isPlayerListExpanded, setIsPlayerListExpanded] = useState(
		match.status === 'LIVE' || match.status === 'HT'
	)

	// Get bonus points if available or create empty array
	const bonusPoints = match.bonusPoints || []

	const allPlayersWithTeam = useMemo(
		() => [
			...match.homeTeam.players.map(p => ({
				...p,
				team: match.homeTeam.shortName,
				teamName: match.homeTeam.name
			})),
			...match.awayTeam.players.map(p => ({
				...p,
				team: match.awayTeam.shortName,
				teamName: match.awayTeam.name
			}))
		],
		[
			match.homeTeam.players,
			match.awayTeam.players,
			match.homeTeam.shortName,
			match.homeTeam.name,
			match.awayTeam.shortName,
			match.awayTeam.name
		]
	)

	const bpsData = useMemo(
		() =>
			allPlayersWithTeam
			.filter(player => player.bps !== undefined && player.bps !== null)
			.map(player => ({
				player: player.player,
				team: player.team,
				score: player.bps || 0
			}))
			.sort((a, b) => b.score - a.score) // Sort by BPS descending
			.slice(0, 5), // Only top 5 players
		[allPlayersWithTeam]
	)

	const playersWithGoals = useMemo(
		() =>
			allPlayersWithTeam
			.filter(player => player.goals !== undefined && player.goals > 0)
			.map(player => ({
				player: player.player,
				team: player.team,
				value: player.goals || 0
			}))
			.sort((a, b) => b.value - a.value),
		[allPlayersWithTeam]
	)

	const playersWithAssists = useMemo(
		() =>
			allPlayersWithTeam
			.filter(player => player.assists !== undefined && player.assists > 0)
			.map(player => ({
				player: player.player,
				team: player.team,
				value: player.assists || 0
			}))
			.sort((a, b) => b.value - a.value),
		[allPlayersWithTeam]
	)

	const playersWithDefensiveContribution = useMemo(
		() =>
			allPlayersWithTeam
			.filter(player => {
				const defCont = player.defensiveContribution
				return defCont !== undefined && defCont !== null && defCont >= 10
			})
			.map(player => ({
				player: player.player,
				team: player.team,
				value: player.defensiveContribution || 0
			}))
			.sort((a, b) => b.value - a.value),
		[allPlayersWithTeam]
	)

	const playersWithSaves = useMemo(
		() =>
			allPlayersWithTeam
			.filter(player => player.saves !== undefined && player.saves > 0)
			.map(player => ({
				player: player.player,
				team: player.team,
				value: player.saves || 0
			}))
			.sort((a, b) => b.value - a.value),
		[allPlayersWithTeam]
	)

	const playersWithYellowCards = useMemo(
		() =>
			allPlayersWithTeam
			.filter(player => player.yellow_cards !== undefined && player.yellow_cards > 0)
			.map(player => ({
				player: player.player,
				team: player.team,
				value: player.yellow_cards || 0
			}))
			.sort((a, b) => b.value - a.value),
		[allPlayersWithTeam]
	)

	const playersWithRedCards = useMemo(
		() =>
			allPlayersWithTeam
			.filter(player => player.red_cards !== undefined && player.red_cards > 0)
			.map(player => ({
				player: player.player,
				team: player.team,
				value: player.red_cards || 0
			}))
			.sort((a, b) => b.value - a.value),
		[allPlayersWithTeam]
	)

	// Format match status for display
	const getStatusDisplay = () => {
		if (match.status === 'LIVE') {
			return (
					<div className="flex items-center gap-1">
						<Activity className="h-4 w-4 text-red-500 animate-pulse" />
						<span className="text-red-500 font-medium">
							{match.minute}
							{"'"}
						</span>
					</div>
				)
			} else if (match.status === 'HT') {
			return <span className="text-yellow-500 font-medium">Half Time</span>
		} else if (match.status === 'FT') {
			return (
				<span className="text-muted-foreground font-medium">Full Time</span>
			)
		} else if (match.status === 'NOT_STARTED') {
			return <span className="text-orange-500 font-medium">Not Started</span>
		} else {
			return <span className="text-blue-500 font-medium">Upcoming</span>
		}
	}

	// Helper function to get color based on BPS score
	const getBpsColor = (score: number) => {
		if (score >= 50) return 'text-emerald-500'
		if (score >= 25) return 'text-blue-500'
		if (score >= 0) return 'text-gray-500'
		if (score >= -25) return 'text-amber-500'
		return 'text-rose-500'
	}

	// Convert PlayerStat to PlayerDetail structure
	const openPlayerDetail = (
		player: PlayerStat,
		team: string,
		teamShort: string
	) => {
		const getPositionFromElementType = (
			elementType: number | undefined
		): 'GKP' | 'DEF' | 'MID' | 'FWD' => {
			switch (elementType) {
				case 1:
					return 'GKP'
				case 2:
					return 'DEF'
				case 3:
					return 'MID'
				case 4:
					return 'FWD'
				default:
					return 'MID'
			}
		}

		// Calculate points based on stats
		let totalPoints = 0
		const pointsBreakdown: { category: string; points: number }[] = []
		const position = getPositionFromElementType(player.elementType)

		if (player.goals && player.goals > 0) {
			const pointsPerGoal =
				position === 'FWD' ? 4 : position === 'MID' ? 5 : 6
			const goalPoints = player.goals * pointsPerGoal
			totalPoints += goalPoints
			pointsBreakdown.push({ category: 'Goals', points: goalPoints })
		}

		if (player.assists && player.assists > 0) {
			const assistPoints = player.assists * 3
			totalPoints += assistPoints
			pointsBreakdown.push({ category: 'Assists', points: assistPoints })
		}

		// Use live player minutes from data instead of a fixed value.
		const minutesPlayed = player.minutes ?? 0
		if (minutesPlayed >= 60) {
			totalPoints += 2
			pointsBreakdown.push({ category: 'Appearance', points: 2 })
		} else if (minutesPlayed > 0) {
			totalPoints += 1
			pointsBreakdown.push({ category: 'Appearance', points: 1 })
		}

		const cleanSheets = player.cleanSheets ?? 0
		if (cleanSheets > 0) {
			const csPoints =
				position === 'GKP' || position === 'DEF'
					? 4
					: position === 'MID'
					? 1
					: 0
			if (csPoints > 0) {
				totalPoints += csPoints
				pointsBreakdown.push({ category: 'Clean Sheet', points: csPoints })
			}
		}

		// Deduct for yellow cards
		if (player.yellow_cards && player.yellow_cards > 0) {
			const ycPoints = -1 * player.yellow_cards
			totalPoints += ycPoints
			pointsBreakdown.push({ category: 'Yellow Card', points: ycPoints })
		}

		// Deduct for red cards
		if (player.red_cards && player.red_cards > 0) {
			const rcPoints = -3 * player.red_cards
			totalPoints += rcPoints
			pointsBreakdown.push({ category: 'Red Card', points: rcPoints })
		}

		// Add bonus points if available
		const bonusPoints = player.bonus_points || 0
		if (bonusPoints > 0) {
			totalPoints += bonusPoints
			pointsBreakdown.push({ category: 'Bonus Points', points: bonusPoints })
		}

		const playerDetail: PlayerDetail = {
			id: player.player,
			name: player.player,
			team: team,
			teamShort: teamShort,
			position: position,
			points: player.totalPoints ?? totalPoints,
			ownershipPercentage: 0,
			bps: player.bps || 0,
			bonusPoints: player.bonus_points || 0,
			stats: {
				minutes: minutesPlayed,
				goals: player.goals || 0,
				assists: player.assists || 0,
				cleanSheets: cleanSheets,
				saves: player.saves || 0,
				penaltiesSaved: player.penalties_saved || 0,
				yellowCards: player.yellow_cards || 0,
				redCards: player.red_cards || 0
			},
			pointsBreakdown: pointsBreakdown
		}

		setSelectedPlayer(playerDetail)
		setIsDetailModalOpen(true)
	}

	const navigateToMatch = (direction: 'prev' | 'next') => {
		if (!allMatches || currentIndex === undefined) return
		
		const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
		
		if (targetIndex < 0 || targetIndex >= allMatches.length) return
		
		// Find the target match card element
		const targetMatchId = allMatches[targetIndex].id
		const targetElement = document.querySelector(`[data-match-id="${targetMatchId}"]`)
		
		if (targetElement) {
			targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}
	}

	const hasPrevious = currentIndex !== undefined && currentIndex > 0
	const hasNext = currentIndex !== undefined && allMatches && currentIndex < allMatches.length - 1

	return (
		<Card ref={cardRef} data-match-id={match.id} className="p-4 md:p-6 overflow-hidden relative">
			{/* Navigation Arrows */}
			{(hasPrevious || hasNext) && (
				<div className="absolute top-4 right-4 flex items-center gap-2 z-10">
					{hasPrevious && (
						<button
							onClick={() => navigateToMatch('prev')}
							className="p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-accent transition-colors"
							aria-label="Previous match"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
					)}
					{hasNext && (
						<button
							onClick={() => navigateToMatch('next')}
							className="p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-accent transition-colors"
							aria-label="Next match"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					)}
				</div>
			)}
			<div className="space-y-6">
				{/* Header with time and viewers */}
				<div className="flex items-center justify-between text-sm text-muted-foreground">
					<div className="flex items-center gap-1.5">
						{match.kickoff && (
							<>
								<Clock className="h-4 w-4 text-muted-foreground" />
								<span>
									{(() => {
										try {
											const date = new Date(match.kickoff);
											if (isNaN(date.getTime())) {
												return '';
											}
											return format(date, 'MMMM d, yyyy HH:mm');
										} catch {
											return '';
										}
									})()}
								</span>
							</>
						)}
					</div>
					{match.viewers > 0 && (
						<div className="flex items-center gap-1.5">
							<Eye className="h-4 w-4 text-muted-foreground" />
							<span>{new Intl.NumberFormat().format(match.viewers)}</span>
						</div>
					)}
				</div>

				{/* Score section */}
				<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
					{/* Home team */}
					<div className="text-right space-y-2">
						<div className="flex items-center justify-end gap-3">
							<span className="font-semibold">{match.homeTeam.name}</span>
							<div className="relative w-8 h-8">
								<Image
									alt={`${match.homeTeam.name} logo`}
									src={`/images/team-logos/${match.homeTeam.shortName.toUpperCase()}.png`}
									width={32}
									height={32}
									className="object-contain"
								/>
							</div>
						</div>
						{match.homeTeam.manager && (
							<div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
								<User className="h-3 w-3" />
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="cursor-pointer">
												{match.homeTeam.manager.team}
											</span>
										</TooltipTrigger>
										<TooltipContent>
											<p>{match.homeTeam.manager.name}</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<span className="font-medium text-primary">
									{match.homeTeam.manager.points} pts
								</span>
							</div>
						)}
					</div>

					{/* Score */}
					<div className="text-center">
						<div className="bg-background rounded-lg px-4 py-2 shadow-sm">
							<div className="text-2xl font-bold mb-1">
								{match.homeTeam.score} - {match.awayTeam.score}
							</div>
							<div className="flex items-center justify-center gap-1 text-sm">
								{getStatusDisplay()}
							</div>
						</div>
					</div>

					{/* Away team */}
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<div className="relative w-8 h-8">
								<Image
									alt={`${match.awayTeam.name} logo`}
									src={`/images/team-logos/${match.awayTeam.shortName.toUpperCase()}.png`}
									width={32}
									height={32}
									className="object-contain"
								/>
							</div>
							<span className="font-semibold">{match.awayTeam.name}</span>
						</div>
						{match.awayTeam.manager && (
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<User className="h-3 w-3" />
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="cursor-pointer">
												{match.awayTeam.manager.team}
											</span>
										</TooltipTrigger>
										<TooltipContent>
											<p>{match.awayTeam.manager.name}</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<span className="font-medium text-primary">
									{match.awayTeam.manager.points} pts
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Bonus Points Section */}
				{match.status !== 'UPCOMING' && match.status !== 'NOT_STARTED' && bonusPoints.length > 0 && (
					<div className="bg-accent/30 rounded-md p-3">
						<div className="flex items-center mb-2 gap-1.5">
							<Award className="h-4 w-4 text-yellow-500" />
							<h3 className="text-sm font-medium">Bonus Points</h3>
						</div>
						<div className="flex flex-wrap gap-2">
							{bonusPoints.map((bp, idx) => (
								<div
									key={idx}
									className="flex items-center gap-1 bg-background rounded-full px-3 py-1 text-xs"
								>
									<span className="font-medium">{bp.player}</span>
									<span className="text-muted-foreground">({bp.team})</span>
									<span
										className={`font-bold ${
											bp.points === 3
												? 'text-yellow-500'
												: bp.points === 2
												? 'text-gray-400'
												: 'text-amber-700'
										}`}
									>
										+{bp.points}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Goals Section */}
				{match.status !== 'UPCOMING' && match.status !== 'NOT_STARTED' && playersWithGoals.length > 0 && (
					<div className="bg-accent/30 rounded-md p-3">
						<div className="flex items-center mb-2 gap-1.5">
							<Target className="h-4 w-4 text-emerald-500" />
							<h3 className="text-sm font-medium">Goals</h3>
						</div>
						<div className="flex flex-wrap gap-2">
							{playersWithGoals.map((player, idx) => (
								<div
									key={idx}
									className="flex items-center gap-1 bg-background rounded-full px-3 py-1 text-xs"
								>
									<span className="font-medium">{player.player}</span>
									<span className="text-muted-foreground">({player.team})</span>
									<span className="font-bold text-emerald-600">
										⚽ {player.value}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Assists Section */}
				{match.status !== 'UPCOMING' && match.status !== 'NOT_STARTED' && playersWithAssists.length > 0 && (
					<div className="bg-accent/30 rounded-md p-3">
						<div className="flex items-center mb-2 gap-1.5">
							<Target className="h-4 w-4 text-blue-500" />
							<h3 className="text-sm font-medium">Assists</h3>
						</div>
						<div className="flex flex-wrap gap-2">
							{playersWithAssists.map((player, idx) => (
								<div
									key={idx}
									className="flex items-center gap-1 bg-background rounded-full px-3 py-1 text-xs"
								>
									<span className="font-medium">{player.player}</span>
									<span className="text-muted-foreground">({player.team})</span>
									<span className="font-bold text-blue-600">
										👟 {player.value}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Defensive Contribution Section (>= 10) */}
				{match.status !== 'UPCOMING' && match.status !== 'NOT_STARTED' && playersWithDefensiveContribution.length > 0 && (
					<div className="bg-accent/30 rounded-md p-3">
						<div className="flex items-center mb-2 gap-1.5">
							<Shield className="h-4 w-4 text-purple-500" />
							<h3 className="text-sm font-medium">Defensive Contribution</h3>
						</div>
						<div className="flex flex-wrap gap-2">
							{playersWithDefensiveContribution.map((player, idx) => (
								<div
									key={idx}
									className="flex items-center gap-1 bg-background rounded-full px-3 py-1 text-xs"
								>
									<span className="font-medium">{player.player}</span>
									<span className="text-muted-foreground">({player.team})</span>
									<span className="font-bold text-purple-600">
										🛡️ {player.value}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Saves Section */}
				{match.status !== 'UPCOMING' && match.status !== 'NOT_STARTED' && playersWithSaves.length > 0 && (
					<div className="bg-accent/30 rounded-md p-3">
						<div className="flex items-center mb-2 gap-1.5">
							<Save className="h-4 w-4 text-cyan-500" />
							<h3 className="text-sm font-medium">Saves</h3>
						</div>
						<div className="flex flex-wrap gap-2">
							{playersWithSaves.map((player, idx) => (
								<div
									key={idx}
									className="flex items-center gap-1 bg-background rounded-full px-3 py-1 text-xs"
								>
									<span className="font-medium">{player.player}</span>
									<span className="text-muted-foreground">({player.team})</span>
									<span className="font-bold text-cyan-600">
										🧤 {player.value}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Yellow Cards Section */}
				{match.status !== 'UPCOMING' && match.status !== 'NOT_STARTED' && playersWithYellowCards.length > 0 && (
					<div className="bg-accent/30 rounded-md p-3">
						<div className="flex items-center mb-2 gap-1.5">
							<AlertTriangle className="h-4 w-4 text-yellow-500" />
							<h3 className="text-sm font-medium">Yellow Cards</h3>
						</div>
						<div className="flex flex-wrap gap-2">
							{playersWithYellowCards.map((player, idx) => (
								<div
									key={idx}
									className="flex items-center gap-1 bg-background rounded-full px-3 py-1 text-xs"
								>
									<span className="font-medium">{player.player}</span>
									<span className="text-muted-foreground">({player.team})</span>
									<span className="font-bold text-yellow-600">
										🟨 {player.value}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Red Cards Section */}
				{match.status !== 'UPCOMING' && match.status !== 'NOT_STARTED' && playersWithRedCards.length > 0 && (
					<div className="bg-accent/30 rounded-md p-3">
						<div className="flex items-center mb-2 gap-1.5">
							<XCircle className="h-4 w-4 text-red-500" />
							<h3 className="text-sm font-medium">Red Cards</h3>
						</div>
						<div className="flex flex-wrap gap-2">
							{playersWithRedCards.map((player, idx) => (
								<div
									key={idx}
									className="flex items-center gap-1 bg-background rounded-full px-3 py-1 text-xs"
								>
									<span className="font-medium">{player.player}</span>
									<span className="text-muted-foreground">({player.team})</span>
									<span className="font-bold text-red-600">
										🟥 {player.value}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* BPS Section */}
				{match.status !== 'UPCOMING' && match.status !== 'NOT_STARTED' && bpsData.length > 0 && (
					<div className="bg-accent/30 rounded-md p-3">
						<div className="flex items-center mb-2 gap-1.5">
							<BarChart2 className="h-4 w-4 text-blue-500" />
							<h3 className="text-sm font-medium">Bonus Point System (BPS)</h3>
						</div>
						<div className="flex flex-wrap gap-2">
							{bpsData.map((bps, idx) => (
								<div
									key={idx}
									className="flex items-center gap-1 bg-background rounded-full px-3 py-1 text-xs"
								>
									<span className="font-medium">{bps.player}</span>
									<span className="text-muted-foreground">
										({bps.team})
									</span>
									<span className={`font-bold ${getBpsColor(bps.score)}`}>
										{bps.score}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Player stats tabs - one tab per team */}
				{match.status !== 'UPCOMING' && match.status !== 'NOT_STARTED' && (
					<div className="space-y-3">
						<button
							type="button"
							onClick={() => setIsPlayerListExpanded(prev => !prev)}
							className="w-full flex items-center justify-between rounded-md border bg-accent/20 px-3 py-2 text-sm font-medium hover:bg-accent/30 transition-colors"
							aria-expanded={isPlayerListExpanded}
						>
							<span>Player List</span>
							{isPlayerListExpanded ? (
								<ChevronUp className="h-4 w-4" />
							) : (
								<ChevronDown className="h-4 w-4" />
							)}
						</button>

						{isPlayerListExpanded && (
							<Tabs
								defaultValue={match.homeTeam.shortName}
								className="w-full"
							>
								<TabsList className="grid grid-cols-2 mb-2">
									<TabsTrigger
										value={match.homeTeam.shortName}
										className="flex items-center gap-2"
									>
										<div className="relative w-4 h-4">
											<Image
												src={`/images/team-logos/${match.homeTeam.shortName.toUpperCase()}.png`}
												alt={match.homeTeam.name}
												fill
												className="object-contain"
											/>
										</div>
										<span>{match.homeTeam.name}</span>
									</TabsTrigger>
									<TabsTrigger
										value={match.awayTeam.shortName}
										className="flex items-center gap-2"
									>
										<div className="relative w-4 h-4">
											<Image
												src={`/images/team-logos/${match.awayTeam.shortName.toUpperCase()}.png`}
												alt={match.awayTeam.name}
												fill
												className="object-contain"
											/>
										</div>
										<span>{match.awayTeam.name}</span>
									</TabsTrigger>
								</TabsList>

								{/* Home team players tab */}
								<TabsContent
									value={match.homeTeam.shortName}
									className="space-y-2"
								>
									{(() => {
										const playersWithPoints = match.homeTeam.players
											.filter(player => (player.totalPoints ?? 0) > 0)
											.sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))
										
										if (playersWithPoints.length === 0) {
											return (
												<div className="text-center text-muted-foreground py-4">
													No players with points yet
												</div>
											)
										}
										
										return playersWithPoints.map((player, index) => (
											<button
												key={index}
												className="text-sm p-3 bg-accent/30 rounded-lg w-full text-left transition-colors hover:bg-accent/50"
												onClick={() =>
													openPlayerDetail(
														player,
														match.homeTeam.name,
														match.homeTeam.shortName
													)
												}
											>
												<div className="flex justify-between items-start mb-2">
													<div className="font-medium">{player.player}</div>
													<div className="flex items-center gap-2">
														{player.bonus_points !== undefined && player.bonus_points > 0 && (
															<Badge
																variant="outline"
																className="text-xs font-bold text-yellow-500"
															>
																+{player.bonus_points}
															</Badge>
														)}
														{player.totalPoints !== undefined && (
															<Badge
																variant="outline"
																className="text-xs font-bold bg-primary/10 text-primary border-primary/20"
															>
																{player.totalPoints} pts
															</Badge>
														)}
													</div>
												</div>
												<div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
											{player.minutes !== undefined && player.minutes > 0 && (
												<div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-gray-700 dark:text-gray-300">
														⏱️ MIN
													</span>
													<span className="font-bold text-gray-900 dark:text-gray-100">
														{player.minutes}
													</span>
												</div>
											)}
											{player.goals !== undefined && player.goals > 0 && (
												<div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-emerald-700 dark:text-emerald-300">
														⚽ Goals
													</span>
													<span className="font-bold text-emerald-900 dark:text-emerald-100">
														{player.goals}
													</span>
												</div>
											)}
											{player.assists !== undefined && player.assists > 0 && (
												<div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-blue-700 dark:text-blue-300">
														👟 Assists
													</span>
													<span className="font-bold text-blue-900 dark:text-blue-100">
														{player.assists}
													</span>
												</div>
											)}
											{player.cleanSheets !== undefined && player.cleanSheets > 0 && (
												<div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-indigo-700 dark:text-indigo-300">
														🛡️ CS
													</span>
													<span className="font-bold text-indigo-900 dark:text-indigo-100">
														{player.cleanSheets}
													</span>
												</div>
											)}
											{player.defensiveContribution !== undefined && 
												((player.elementType === 2 && player.defensiveContribution >= 10) || 
												 (player.elementType === 3 && player.defensiveContribution >= 12) ||
												 (player.elementType === 4 && player.defensiveContribution >= 12)) && (
												<div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-purple-700 dark:text-purple-300">
														🛡️ Def
													</span>
													<span className="font-bold text-purple-900 dark:text-purple-100">
														{player.defensiveContribution}
													</span>
												</div>
											)}
											{player.saves !== undefined && player.saves >= 3 && (
												<div className="flex items-center gap-1 bg-cyan-50 dark:bg-cyan-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-cyan-700 dark:text-cyan-300">
														🧤 Saves
													</span>
													<span className="font-bold text-cyan-900 dark:text-cyan-100">
														{player.saves}
													</span>
												</div>
											)}
											{player.yellow_cards !== undefined && player.yellow_cards > 0 && (
												<div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-yellow-700 dark:text-yellow-300">
														🟨 YC
													</span>
													<span className="font-bold text-yellow-900 dark:text-yellow-100">
														{player.yellow_cards}
													</span>
												</div>
											)}
											{player.red_cards !== undefined && player.red_cards > 0 && (
												<div className="flex items-center gap-1 bg-red-50 dark:bg-red-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-red-700 dark:text-red-300">
														🟥 RC
													</span>
													<span className="font-bold text-red-900 dark:text-red-100">
														{player.red_cards}
													</span>
												</div>
											)}
											{player.penalties_saved !== undefined && player.penalties_saved > 0 && (
												<div className="flex items-center gap-1 bg-green-50 dark:bg-green-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-green-700 dark:text-green-300">
														🛡️ PS
													</span>
													<span className="font-bold text-green-900 dark:text-green-100">
														{player.penalties_saved}
													</span>
												</div>
											)}
											{player.penalties_missed !== undefined && player.penalties_missed > 0 && (
												<div className="flex items-center gap-1 bg-red-50 dark:bg-red-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-red-700 dark:text-red-300">
														❌ PM
													</span>
													<span className="font-bold text-red-900 dark:text-red-100">
														{player.penalties_missed}
													</span>
												</div>
											)}
											{player.ownGoals !== undefined && player.ownGoals > 0 && (
												<div className="flex items-center gap-1 bg-red-50 dark:bg-red-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-red-700 dark:text-red-300">
														❌ OG
													</span>
													<span className="font-bold text-red-900 dark:text-red-100">
														{player.ownGoals}
													</span>
												</div>
											)}
											{player.goalsConceded !== undefined && 
												player.goalsConceded >= 2 && 
												(player.elementType === 1 || player.elementType === 2) && (
												<div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-orange-700 dark:text-orange-300">
														⚽ GC
													</span>
													<span className="font-bold text-orange-900 dark:text-orange-100">
														{player.goalsConceded}
													</span>
												</div>
											)}
												</div>
											</button>
										))
									})()}
								</TabsContent>

								{/* Away team players tab */}
								<TabsContent
									value={match.awayTeam.shortName}
									className="space-y-2"
								>
									{(() => {
										const playersWithPoints = match.awayTeam.players
											.filter(player => (player.totalPoints ?? 0) > 0)
											.sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))
										
										if (playersWithPoints.length === 0) {
											return (
												<div className="text-center text-muted-foreground py-4">
													No players with points yet
												</div>
											)
										}
										
										return playersWithPoints.map((player, index) => (
											<button
												key={index}
												className="text-sm p-3 bg-accent/30 rounded-lg w-full text-left transition-colors hover:bg-accent/50"
												onClick={() =>
													openPlayerDetail(
														player,
														match.awayTeam.name,
														match.awayTeam.shortName
													)
												}
											>
												<div className="flex justify-between items-start mb-2">
													<div className="font-medium">{player.player}</div>
													<div className="flex items-center gap-2">
														{player.bonus_points !== undefined && player.bonus_points > 0 && (
															<Badge
																variant="outline"
																className="text-xs font-bold text-yellow-500"
															>
																+{player.bonus_points}
															</Badge>
														)}
														{player.totalPoints !== undefined && (
															<Badge
																variant="outline"
																className="text-xs font-bold bg-primary/10 text-primary border-primary/20"
															>
																{player.totalPoints} pts
															</Badge>
														)}
													</div>
												</div>
												<div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
											{player.minutes !== undefined && player.minutes > 0 && (
												<div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-gray-700 dark:text-gray-300">
														⏱️ MIN
													</span>
													<span className="font-bold text-gray-900 dark:text-gray-100">
														{player.minutes}
													</span>
												</div>
											)}
											{player.goals !== undefined && player.goals > 0 && (
												<div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-emerald-700 dark:text-emerald-300">
														⚽ Goals
													</span>
													<span className="font-bold text-emerald-900 dark:text-emerald-100">
														{player.goals}
													</span>
												</div>
											)}
											{player.assists !== undefined && player.assists > 0 && (
												<div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-blue-700 dark:text-blue-300">
														👟 Assists
													</span>
													<span className="font-bold text-blue-900 dark:text-blue-100">
														{player.assists}
													</span>
												</div>
											)}
											{player.cleanSheets !== undefined && player.cleanSheets > 0 && (
												<div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-indigo-700 dark:text-indigo-300">
														🛡️ CS
													</span>
													<span className="font-bold text-indigo-900 dark:text-indigo-100">
														{player.cleanSheets}
													</span>
												</div>
											)}
											{player.defensiveContribution !== undefined && 
												((player.elementType === 2 && player.defensiveContribution >= 10) || 
												 (player.elementType === 3 && player.defensiveContribution >= 12) ||
												 (player.elementType === 4 && player.defensiveContribution >= 12)) && (
												<div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-purple-700 dark:text-purple-300">
														🛡️ Def
													</span>
													<span className="font-bold text-purple-900 dark:text-purple-100">
														{player.defensiveContribution}
													</span>
												</div>
											)}
											{player.saves !== undefined && player.saves >= 3 && (
												<div className="flex items-center gap-1 bg-cyan-50 dark:bg-cyan-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-cyan-700 dark:text-cyan-300">
														🧤 Saves
													</span>
													<span className="font-bold text-cyan-900 dark:text-cyan-100">
														{player.saves}
													</span>
												</div>
											)}
											{player.yellow_cards !== undefined && player.yellow_cards > 0 && (
												<div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-yellow-700 dark:text-yellow-300">
														🟨 YC
													</span>
													<span className="font-bold text-yellow-900 dark:text-yellow-100">
														{player.yellow_cards}
													</span>
												</div>
											)}
											{player.red_cards !== undefined && player.red_cards > 0 && (
												<div className="flex items-center gap-1 bg-red-50 dark:bg-red-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-red-700 dark:text-red-300">
														🟥 RC
													</span>
													<span className="font-bold text-red-900 dark:text-red-100">
														{player.red_cards}
													</span>
												</div>
											)}
											{player.penalties_saved !== undefined && player.penalties_saved > 0 && (
												<div className="flex items-center gap-1 bg-green-50 dark:bg-green-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-green-700 dark:text-green-300">
														🛡️ PS
													</span>
													<span className="font-bold text-green-900 dark:text-green-100">
														{player.penalties_saved}
													</span>
												</div>
											)}
											{player.penalties_missed !== undefined && player.penalties_missed > 0 && (
												<div className="flex items-center gap-1 bg-red-50 dark:bg-red-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-red-700 dark:text-red-300">
														❌ PM
													</span>
													<span className="font-bold text-red-900 dark:text-red-100">
														{player.penalties_missed}
													</span>
												</div>
											)}
											{player.ownGoals !== undefined && player.ownGoals > 0 && (
												<div className="flex items-center gap-1 bg-red-50 dark:bg-red-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-red-700 dark:text-red-300">
														❌ OG
													</span>
													<span className="font-bold text-red-900 dark:text-red-100">
														{player.ownGoals}
													</span>
												</div>
											)}
											{player.goalsConceded !== undefined && 
												player.goalsConceded >= 2 && 
												(player.elementType === 1 || player.elementType === 2) && (
												<div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950 rounded px-2 py-1 text-xs">
													<span className="font-semibold text-orange-700 dark:text-orange-300">
														⚽ GC
													</span>
													<span className="font-bold text-orange-900 dark:text-orange-100">
														{player.goalsConceded}
													</span>
												</div>
											)}
												</div>
											</button>
										))
									})()}
								</TabsContent>
							</Tabs>
						)}
					</div>
				)}
			</div>

			{/* Player detail modal */}
			<PlayerDetailModal
				player={selectedPlayer}
				isOpen={isDetailModalOpen}
				onClose={() => setIsDetailModalOpen(false)}
			/>
		</Card>
	)
}

export const MatchCard = memo(MatchCardComponent)
