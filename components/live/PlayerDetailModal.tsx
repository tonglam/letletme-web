'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PlayerDetail } from '@/types/player-detail'
import { Award, Clock, Goal, ShieldCheck, Shirt, Zap } from 'lucide-react'
import Image from 'next/image'

interface PlayerDetailModalProps {
	player: PlayerDetail | null
	isOpen: boolean
	onClose: () => void
}

export function PlayerDetailModal({
	player,
	isOpen,
	onClose
}: PlayerDetailModalProps) {
	if (!player) return null

	// BPS color based on value
	const getBpsColor = (score: number) => {
		if (score >= 50) return 'text-emerald-500'
		if (score >= 25) return 'text-blue-500'
		if (score >= 0) return 'text-gray-500'
		return 'text-rose-500'
	}

	return (
		<Dialog
			open={isOpen}
			onOpenChange={open => !open && onClose()}
		>
			<DialogContent className="max-w-md p-0 overflow-hidden">
				<DialogTitle className="sr-only">
					{player.name} - Player Details
				</DialogTitle>

				{/* Header section with gradient background */}
				<div className="bg-gradient-to-r from-primary/20 to-primary/5 p-5">
					<div className="flex justify-between items-center mb-3">
						<div className="flex items-center gap-2">
							<div className="relative w-8 h-8">
								<Image
									alt={`${player.team} logo`}
									src={`/images/team-logos/${player.teamShort.toUpperCase()}.png`}
									width={24}
									height={24}
								/>
							</div>
							<h2 className="text-xl font-bold">{player.name}</h2>
						</div>
						<span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-semibold">
							{player.position}
						</span>
					</div>

					<div className="flex items-center justify-between">
						<div className="text-muted-foreground text-sm">{player.team}</div>
						<div className="flex items-center gap-2">
							<span className="text-2xl font-bold text-primary">
								{player.points}
							</span>
							<span className="text-muted-foreground text-sm">pts</span>
						</div>
					</div>
				</div>

				{/* Main content */}
				<div className="p-5">
					{/* Stats overview */}
					<div className="grid grid-cols-2 gap-4 mb-5">
						<div className="bg-accent/30 rounded-lg p-3 flex flex-col items-center justify-center">
							<span className="text-muted-foreground text-xs mb-1">
								Ownership
							</span>
							<span className="text-lg font-semibold">
								{player.ownershipPercentage}%
							</span>
						</div>

						{player.bps > 0 ? (
							<div className="bg-accent/30 rounded-lg p-3 flex flex-col items-center justify-center">
								<span className="text-muted-foreground text-xs mb-1">BPS</span>
								<span
									className={`text-lg font-semibold ${getBpsColor(player.bps)}`}
								>
									{player.bps}
								</span>
							</div>
						) : (
							<div className="bg-accent/30 rounded-lg p-3 flex flex-col items-center justify-center">
								<span className="text-muted-foreground text-xs mb-1">
									Status
								</span>
								<span className="text-lg font-semibold text-emerald-500">
									Active
								</span>
							</div>
						)}
					</div>

					{player.bonusPoints > 0 && (
						<div className="bg-yellow-500/10 rounded-lg p-3 mb-5 flex items-center">
							<Award className="h-5 w-5 text-yellow-500 mr-3" />
							<div>
								<h3 className="font-medium text-sm">Bonus Points</h3>
								<p className="text-lg font-bold text-yellow-500">
									+{player.bonusPoints}
								</p>
							</div>
						</div>
					)}

					<h3 className="font-medium text-lg mb-3 flex items-center">
						<Zap className="h-4 w-4 mr-2 text-primary" />
						Point Breakdown
					</h3>

					<div className="space-y-2 rounded-lg bg-accent/20 p-3">
						{player.stats.minutes > 0 && (
							<div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
								<div className="flex items-center">
									<Clock className="h-4 w-4 text-muted-foreground mr-2" />
									<span>Appearance ({player.stats.minutes} min)</span>
								</div>
								<span className="font-semibold text-primary">
									{player.stats.minutes >= 60 ? 2 : 1}
								</span>
							</div>
						)}

						{player.stats.goals > 0 && (
							<div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
								<div className="flex items-center">
									<Goal className="h-4 w-4 text-muted-foreground mr-2" />
									<span>
										Goal{player.stats.goals > 1 ? 's' : ''} (
										{player.stats.goals})
									</span>
								</div>
								<span className="font-semibold text-primary">
									{player.stats.goals * 5}
								</span>
							</div>
						)}

						{player.stats.assists > 0 && (
							<div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
								<div className="flex items-center">
									<Shirt className="h-4 w-4 text-muted-foreground mr-2" />
									<span>
										Assist{player.stats.assists > 1 ? 's' : ''} (
										{player.stats.assists})
									</span>
								</div>
								<span className="font-semibold text-primary">
									{player.stats.assists * 3}
								</span>
							</div>
						)}

						{player.stats.cleanSheets > 0 && (
							<div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
								<div className="flex items-center">
									<ShieldCheck className="h-4 w-4 text-muted-foreground mr-2" />
									<span>Clean Sheet</span>
								</div>
								<span className="font-semibold text-primary">
									{player.position === 'GKP' || player.position === 'DEF'
										? 4
										: player.position === 'MID'
										? 1
										: 0}
								</span>
							</div>
						)}

						{player.stats.saves && player.stats.saves > 0 && (
							<div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
								<div className="flex items-center">
									<span className="w-4 h-4 flex items-center justify-center mr-2 text-muted-foreground">
										🧤
									</span>
									<span>Saves ({player.stats.saves})</span>
								</div>
								<span className="font-semibold text-primary">
									{Math.floor(player.stats.saves / 3)}
								</span>
							</div>
						)}

						{player.stats.penaltiesSaved && player.stats.penaltiesSaved > 0 && (
							<div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
								<div className="flex items-center">
									<span className="w-4 h-4 flex items-center justify-center mr-2 text-muted-foreground">
										✋
									</span>
									<span>Penalty Saved</span>
								</div>
								<span className="font-semibold text-primary">
									{player.stats.penaltiesSaved * 5}
								</span>
							</div>
						)}

						{player.stats.yellowCards > 0 && (
							<div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
								<div className="flex items-center">
									<div className="w-4 h-4 bg-yellow-400 rounded-sm mr-2"></div>
									<span>
										Yellow Card{player.stats.yellowCards > 1 ? 's' : ''}
									</span>
								</div>
								<span className="font-semibold text-rose-500">
									-{player.stats.yellowCards}
								</span>
							</div>
						)}

						{player.stats.redCards > 0 && (
							<div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
								<div className="flex items-center">
									<div className="w-4 h-4 bg-red-600 rounded-sm mr-2"></div>
									<span>Red Card{player.stats.redCards > 1 ? 's' : ''}</span>
								</div>
								<span className="font-semibold text-rose-500">
									-{player.stats.redCards * 3}
								</span>
							</div>
						)}

						{player.bonusPoints > 0 && (
							<div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
								<div className="flex items-center">
									<Award className="h-4 w-4 text-yellow-500 mr-2" />
									<span>Bonus</span>
								</div>
								<span className="font-semibold text-yellow-500">
									{player.bonusPoints}
								</span>
							</div>
						)}
					</div>

					{/* Total points summary */}
					<div className="mt-5 pt-3 border-t border-border flex justify-between items-center">
						<span className="font-semibold">TOTAL POINTS</span>
						<span className="text-xl font-bold text-primary">
							{player.points}
						</span>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
