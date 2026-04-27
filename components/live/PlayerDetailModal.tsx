'use client'

import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { PlayerDetail } from '@/types/player-detail'
import {
	Award,
	TrendingUp,
	Users,
	Zap
} from 'lucide-react'
import Image from 'next/image'

interface PlayerDetailModalProps {
	player: PlayerDetail | null
	isOpen: boolean
	onClose: () => void
	isLoading?: boolean
}

export function PlayerDetailModal({
	player,
	isOpen,
	onClose,
	isLoading = false
}: PlayerDetailModalProps) {
	if (!player) return null

	// BPS color based on value
	const getBpsColor = (score: number) => {
		if (score >= 50) return 'text-emerald-500 dark:text-emerald-400'
		if (score >= 25) return 'text-blue-500 dark:text-blue-400'
		if (score >= 0) return 'text-gray-500 dark:text-gray-400'
		return 'text-rose-500 dark:text-rose-400'
	}

	const getBpsBgColor = (score: number) => {
		if (score >= 50) return 'bg-emerald-500/10 border-emerald-500/20'
		if (score >= 25) return 'bg-blue-500/10 border-blue-500/20'
		if (score >= 0) return 'bg-gray-500/10 border-gray-500/20'
		return 'bg-rose-500/10 border-rose-500/20'
	}

	// Calculate total positive and negative points
	const positivePoints = player.pointsBreakdown
		.filter(item => item.points > 0)
		.reduce((sum, item) => sum + item.points, 0)
	const negativePoints = Math.abs(
		player.pointsBreakdown
			.filter(item => item.points < 0)
			.reduce((sum, item) => sum + item.points, 0)
	)

	return (
		<Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
			<DialogContent className="max-w-lg p-0 overflow-hidden sm:max-w-lg">
				<DialogTitle className="sr-only">
					{player.name} - Player Details
				</DialogTitle>

				{/* Enhanced Header section */}
				<div className="relative bg-gradient-to-br from-primary/30 via-primary/20 to-primary/5 p-6 border-b border-border/50">
					<div className="flex items-start justify-between mb-4">
						<div className="flex items-center gap-3 flex-1 min-w-0">
							<div className="relative w-12 h-12 flex-shrink-0 rounded-full bg-background/50 p-1 border-2 border-primary/20">
								<Image
									alt={`${player.team} logo`}
									src={`/images/team-logos/${player.teamShort.toUpperCase()}.png`}
									width={40}
									height={40}
									className="rounded-full"
								/>
							</div>
							<div className="flex-1 min-w-0">
								<h2 className="text-2xl font-bold truncate mb-1">
									{player.name}
								</h2>
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<span>{player.team}</span>
									<span>•</span>
									<Badge variant="secondary" className="text-xs">
										{player.position}
									</Badge>
								</div>
							</div>
						</div>
					</div>

					{/* Points display */}
					<div className="flex items-end justify-between">
						<div className="flex flex-col">
							<span className="text-xs text-muted-foreground mb-1">
								Total Points
							</span>
							<div className="flex items-baseline gap-2">
								<span className="text-4xl font-bold text-primary">
									{player.points}
								</span>
								<span className="text-sm text-muted-foreground mb-1">pts</span>
							</div>
						</div>
						{player.bonusPoints > 0 && (
							<div className="flex items-center gap-2 bg-yellow-500/20 dark:bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/30">
								<Award className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
								<span className="text-sm font-semibold text-yellow-600 dark:text-yellow-500">
									+{player.bonusPoints} Bonus
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Main content */}
				<div className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
					{/* Stats overview cards */}
					<div className="grid grid-cols-2 gap-3">
						<div className="bg-card border rounded-lg p-4 hover:bg-accent/50 transition-colors">
							<div className="flex items-center gap-2 mb-2">
								<Users className="h-4 w-4 text-muted-foreground" />
								<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									Ownership
								</span>
							</div>
							<div className="text-2xl font-bold">{player.ownershipPercentage}%</div>
						</div>

						{player.bps > 0 ? (
							<div
								className={cn(
									'border rounded-lg p-4 hover:opacity-90 transition-opacity',
									getBpsBgColor(player.bps)
								)}
							>
								<div className="flex items-center gap-2 mb-2">
									<TrendingUp className="h-4 w-4 text-muted-foreground" />
									<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
										BPS
									</span>
								</div>
								<div className={cn('text-2xl font-bold', getBpsColor(player.bps))}>
									{player.bps}
								</div>
							</div>
						) : (
							<div className="bg-card border rounded-lg p-4 hover:bg-accent/50 transition-colors">
								<div className="flex items-center gap-2 mb-2">
									<Zap className="h-4 w-4 text-emerald-500" />
									<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
										Status
									</span>
								</div>
								<div className="text-lg font-semibold text-emerald-500">
									Active
								</div>
							</div>
						)}
					</div>

					{/* Point Breakdown Section */}
					<div>
						<div className="flex items-center gap-2 mb-4">
							<Zap className="h-5 w-5 text-primary" />
							<h3 className="text-lg font-semibold">Point Breakdown</h3>
						</div>

						<div className="space-y-1 rounded-lg border bg-card/50 p-1">
							{isLoading ? (
								<div className="px-3 py-4 text-sm text-muted-foreground text-center">
									Loading breakdown...
								</div>
							) : player.pointsBreakdown.length > 0 ? (
								player.pointsBreakdown.map((item, index) => (
									<div
										key={`${item.category}-${index}`}
										className="flex justify-between items-center px-3 py-2.5 rounded-md hover:bg-accent/50 transition-colors"
									>
										<div className="flex items-center gap-3">
											<div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
												<Zap className="h-4 w-4 text-primary" />
											</div>
											<div>
												<span className="text-sm font-medium">{item.category}</span>
												{item.value !== undefined && item.value !== 0 && (
													<span className="text-xs text-muted-foreground ml-1.5">({item.value})</span>
												)}
											</div>
										</div>
										<span
											className={cn(
												'font-semibold',
												item.points >= 0
													? 'text-emerald-600 dark:text-emerald-400'
													: 'text-rose-500 dark:text-rose-400'
											)}
										>
											{item.points >= 0 ? '+' : ''}
											{item.points}
										</span>
									</div>
								))
							) : (
								<div className="px-3 py-4 text-sm text-muted-foreground text-center">
									No point events available
								</div>
							)}
						</div>
					</div>

					{/* Points Summary */}
					<div className="pt-4 border-t border-border">
						<div className="flex items-center justify-between mb-3">
							<span className="text-sm font-medium text-muted-foreground">
								Positive Points
							</span>
							<span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
								+{positivePoints}
							</span>
						</div>
						{negativePoints > 0 && (
							<div className="flex items-center justify-between mb-3">
								<span className="text-sm font-medium text-muted-foreground">
									Negative Points
								</span>
								<span className="text-lg font-bold text-rose-500 dark:text-rose-400">
									-{negativePoints}
								</span>
							</div>
						)}
						<Separator className="my-3" />
						<div className="flex items-center justify-between">
							<span className="text-base font-semibold">Total Points</span>
							<span className="text-2xl font-bold text-primary">
								{player.points}
							</span>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
