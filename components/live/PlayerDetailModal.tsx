'use client'

import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { teamCrestSrc } from '@/lib/team-crest'
import { cn } from '@/lib/utils'
import type { PlayerDetail } from '@/types/player-detail'
import { Zap } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

interface PlayerDetailModalProps {
	player: PlayerDetail | null
	isOpen: boolean
	onClose: () => void
	isLoading?: boolean
}

function coreMatchStatKeys(position: string): Array<{
	labelKey:
		| 'minutesPlayed'
		| 'goals'
		| 'assists'
		| 'cleanSheets'
		| 'saves'
		| 'penaltiesSaved'
		| 'goalsConceded'
		| 'defensiveContribution'
		| 'yellowCards'
		| 'redCards'
		| 'bonusPoints'
	getValue: (p: PlayerDetail) => number
}> {
	const common = [
		{
			labelKey: 'minutesPlayed' as const,
			getValue: (p: PlayerDetail) => p.stats.minutes,
		},
		{
			labelKey: 'goals' as const,
			getValue: (p: PlayerDetail) => p.stats.goals,
		},
		{
			labelKey: 'assists' as const,
			getValue: (p: PlayerDetail) => p.stats.assists,
		},
		{
			labelKey: 'yellowCards' as const,
			getValue: (p: PlayerDetail) => p.stats.yellowCards,
		},
		{
			labelKey: 'redCards' as const,
			getValue: (p: PlayerDetail) => p.stats.redCards,
		},
		{
			labelKey: 'bonusPoints' as const,
			getValue: (p: PlayerDetail) => p.bonusPoints,
		},
	]

	if (position === 'GKP') {
		return [
			common[0],
			{
				labelKey: 'saves',
				getValue: p => p.stats.saves ?? 0,
			},
			{
				labelKey: 'cleanSheets',
				getValue: p => p.stats.cleanSheets,
			},
			{
				labelKey: 'goalsConceded',
				getValue: p => p.stats.goalsConceded ?? 0,
			},
			{
				labelKey: 'penaltiesSaved',
				getValue: p => p.stats.penaltiesSaved ?? 0,
			},
			common[3],
			common[4],
			common[5],
		]
	}

	if (position === 'DEF') {
		return [
			common[0],
			common[1],
			common[2],
			{
				labelKey: 'cleanSheets',
				getValue: p => p.stats.cleanSheets,
			},
			{
				labelKey: 'goalsConceded',
				getValue: p => p.stats.goalsConceded ?? 0,
			},
			{
				labelKey: 'defensiveContribution',
				getValue: p => p.stats.defensiveContribution ?? 0,
			},
			common[3],
			common[4],
			common[5],
		]
	}

	if (position === 'MID') {
		return [
			common[0],
			common[1],
			common[2],
			{
				labelKey: 'cleanSheets',
				getValue: p => p.stats.cleanSheets,
			},
			{
				labelKey: 'defensiveContribution',
				getValue: p => p.stats.defensiveContribution ?? 0,
			},
			common[3],
			common[4],
			common[5],
		]
	}

	// FWD
	return [
		common[0],
		common[1],
		common[2],
		{
			labelKey: 'defensiveContribution',
			getValue: p => p.stats.defensiveContribution ?? 0,
		},
		common[3],
		common[4],
		common[5],
	]
}

export function PlayerDetailModal({
	player,
	isOpen,
	onClose,
	isLoading = false,
}: PlayerDetailModalProps) {
	const t = useTranslations('LivePoints')
	if (!player) return null

	const breakdownLabels: Record<string, string> = {
		Appearance: t('appearance'),
		'Minutes Played': t('minutesPlayed'),
		Goals: t('goals'),
		'Goals Scored': t('goalsScored'),
		Assists: t('assists'),
		'Clean Sheet': t('cleanSheet'),
		Saves: t('saves'),
		'Penalty Saved': t('penaltySaved'),
		'Penalty Missed': t('penaltyMissed'),
		'Own Goal': t('ownGoal'),
		'Goals Conceded': t('goalsConceded'),
		'Defensive Contribution': t('defensiveContribution'),
		'Yellow Card': t('yellowCard'),
		'Red Card': t('redCard'),
		Bonus: t('bonusPoints'),
		'Bonus Points': t('bonusPoints'),
		'Total Points': t('totalPoints'),
	}

	const getBpsColor = (score: number) => {
		if (score >= 50) return 'text-success'
		if (score >= 25) return 'text-info'
		if (score >= 0) return 'text-foreground'
		return 'text-destructive'
	}

	const getBpsBgColor = (score: number) => {
		if (score >= 50) return 'bg-success/10 border-success/25'
		if (score >= 25) return 'bg-info/10 border-info/25'
		if (score >= 0) return 'bg-muted/40 border-border/70'
		return 'bg-destructive/10 border-destructive/25'
	}

	const breakdownSum = player.pointsBreakdown.reduce(
		(sum, item) => sum + item.points,
		0,
	)

	// Always show position-relevant match stats (including zeros) so the panel
	// is not an empty grid when only minutes are non-zero.
	const matchStatRows = coreMatchStatKeys(player.position).map(row => ({
		label: t(row.labelKey),
		value: row.getValue(player),
	}))

	// Optional extras that are usually zero — only show when non-zero
	const extraRows = [
		{
			label: t('ownGoal'),
			value: player.stats.ownGoals ?? 0,
		},
		{
			label: t('penaltyMissed'),
			value: player.stats.penaltiesMissed ?? 0,
		},
	].filter(row => row.value !== 0)

	const allStatRows = [...matchStatRows, ...extraRows]

	const statusLabel =
		player.playingStatus === 'PLAYING'
			? t('statusPlaying')
			: player.playingStatus === 'FINISHED'
				? t('statusFinished')
				: player.playingStatus === 'NOT_STARTED'
					? t('statusNotStarted')
					: t('active')

	return (
		<Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
			<DialogContent className="max-w-lg overflow-hidden p-0 sm:max-w-lg">
				<DialogTitle className="sr-only">
					{t('playerDetails', { player: player.name })}
				</DialogTitle>

				{/* Header: logo | name column (chips align with name left edge) */}
				<div className="relative border-b border-border/50 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-5 pr-12 sm:p-6 sm:pr-14">
					<div className="flex items-start gap-3">
						<div className="relative size-12 shrink-0 rounded-full border-2 border-primary/20 bg-background/50 p-1">
							<Image
								alt={t('teamLogo', { team: player.team })}
								src={teamCrestSrc(player.teamShort)}
								width={40}
								height={40}
								unoptimized
								className="rounded-full object-contain"
							/>
						</div>
						{/* Name + chips share one column so chips line up with the name */}
						<div className="min-w-0 flex-1">
							<h2 className="truncate font-display text-xl font-bold uppercase tracking-wide sm:text-2xl">
								{player.name}
							</h2>
							<div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
								<span className="truncate">{player.team}</span>
								<span aria-hidden="true">·</span>
								<Badge variant="secondary" className="text-xs">
									{player.position}
								</Badge>
								<span aria-hidden="true">·</span>
								<span className="text-xs font-medium uppercase tracking-wide">
									{statusLabel}
								</span>
							</div>

							{/* Meta chips: PTS then BPS — left edge = player name */}
							<div className="mt-3 flex flex-wrap items-center gap-2">
								<div
									className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5"
									aria-label={
										player.bonusPoints > 0
											? t('pointsIncludingBonus', {
													points: player.points,
													bonus: player.bonusPoints,
												})
											: t('pointsTotalOnly', { points: player.points })
									}
								>
									<span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
										{t('pointsAbbreviation')}
									</span>
									<span className="font-mono text-base font-bold tabular-nums text-primary-ink">
										{player.points}
									</span>
									{player.bonusPoints > 0 ? (
										<span className="font-mono text-xs font-semibold tabular-nums text-warning">
											+{player.bonusPoints}
										</span>
									) : null}
								</div>
								{typeof player.bps === 'number' ? (
									<div
										className={cn(
											'inline-flex items-center gap-2 rounded-md border px-3 py-1.5',
											getBpsBgColor(player.bps),
										)}
									>
										<span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
											BPS
										</span>
										<span
											className={cn(
												'font-mono text-base font-bold tabular-nums',
												getBpsColor(player.bps),
											)}
										>
											{player.bps}
										</span>
									</div>
								) : null}
							</div>
						</div>
					</div>
				</div>

				<div className="max-h-[min(60vh,28rem)] space-y-5 overflow-y-auto p-5 sm:p-6">
					{/* Match stats — always show core grid */}
					<div>
						<div className="mb-3 flex items-center gap-2">
							<Zap className="size-4 text-primary-ink" aria-hidden="true" />
							<h3 className="font-display text-sm font-bold uppercase tracking-caps text-muted-foreground">
								{t('matchStats')}
							</h3>
						</div>
						<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
							{allStatRows.map(row => (
								<div
									key={row.label}
									className="rounded-lg border border-border/70 bg-card/60 px-2.5 py-2"
								>
									<div className="truncate text-label font-semibold uppercase tracking-wide text-muted-foreground">
										{row.label}
									</div>
									<div
										className={cn(
											'mt-0.5 font-mono text-base font-bold tabular-nums sm:text-lg',
											row.value !== 0 ? 'text-foreground' : 'text-muted-foreground/70',
										)}
									>
										{row.value}
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Point breakdown — no second total strip */}
					<div>
						<div className="mb-2 flex items-end justify-between gap-2">
							<h3 className="font-display text-sm font-bold uppercase tracking-caps text-muted-foreground">
								{t('pointBreakdown')}
							</h3>
							{player.breakdownSource === 'provisional' ? (
								<span className="text-label font-medium uppercase tracking-wide text-muted-foreground">
									{t('breakdownProvisional')}
								</span>
							) : null}
						</div>
						{player.breakdownSource === 'provisional' ? (
							<p className="mb-2 text-xs text-muted-foreground">
								{t('breakdownProvisionalHint')}
							</p>
						) : null}
						<div className="overflow-hidden rounded-lg border border-border/70 bg-card/50">
							{isLoading ? (
								<div className="px-3 py-4 text-center text-sm text-muted-foreground">
									{t('loadingBreakdown')}
								</div>
							) : player.pointsBreakdown.length > 0 ? (
								<ul className="divide-y divide-border/60">
									{player.pointsBreakdown.map((item, index) => {
										const label =
											breakdownLabels[item.category] ?? item.category
										const isMinutes =
											item.category === 'Appearance' ||
											item.category === 'Minutes Played'
										// Parenthetical count — never "×N" (reads like multiplication).
										const countLabel =
											item.value !== undefined && item.value !== 0
												? isMinutes
													? t('breakdownMinutesCount', {
															minutes: item.value,
														})
													: t('breakdownEventCount', {
															count: item.value,
														})
												: null
										return (
											<li
												key={`${item.category}-${index}`}
												className="flex items-center justify-between gap-3 px-3 py-2.5"
											>
												<span className="min-w-0 text-sm">
													<span className="font-medium">{label}</span>
													{countLabel ? (
														<span className="ml-1.5 text-xs text-muted-foreground">
															{countLabel}
														</span>
													) : null}
												</span>
												<span
													className={cn(
														'shrink-0 font-mono text-sm font-semibold tabular-nums',
														item.points >= 0
															? 'text-success'
															: 'text-destructive',
													)}
												>
													{item.points >= 0 ? '+' : ''}
													{item.points}
												</span>
											</li>
										)
									})}
									{/* Single reconciliation row — not a second hero total */}
									<li className="flex items-center justify-between gap-3 bg-primary/5 px-3 py-2.5">
										<span className="text-sm font-semibold">{t('breakdownSum')}</span>
										<span className="font-mono text-sm font-bold tabular-nums text-primary-ink">
											{breakdownSum >= 0 ? '+' : ''}
											{breakdownSum}
											{breakdownSum !== player.points ? (
												<span className="ml-1.5 text-xs font-medium text-muted-foreground">
													({t('liveTotalShort')}: {player.points})
												</span>
											) : null}
										</span>
									</li>
								</ul>
							) : (
								<div className="px-3 py-4 text-center text-sm text-muted-foreground">
									{player.breakdownPending
										? t('breakdownPending')
										: t('noPointEvents')}
								</div>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
