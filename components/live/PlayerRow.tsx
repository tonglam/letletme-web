'use client'

import { resolvePointsBreakdown } from '@/app/live/points/_lib/live-points-breakdown'
import { liveExplanationMatchesCurrentStats } from '@/app/live/points/_lib/live-points-model'
import { Badge } from '@/components/ui/badge'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip'
import { positionBadgeClass } from '@/lib/position-style'
import { cn } from '@/lib/utils'
import type { Player } from '@/types/player'
import type { PlayerDetail } from '@/types/player-detail'
import { CheckCircle2, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { PlayerDetailModal } from './PlayerDetailModal'

interface PlayerRowProps {
	player: Player
}

interface StatConfig {
	label: string
	key: keyof Player['stats']
	description: string
}

const breakdownLabelMap: Record<string, string> = {
	minutes: 'Appearance',
	goals_scored: 'Goals',
	assists: 'Assists',
	clean_sheets: 'Clean Sheet',
	saves: 'Saves',
	penalties_saved: 'Penalty Saved',
	penalties_missed: 'Penalty Missed',
	yellow_cards: 'Yellow Card',
	red_cards: 'Red Card',
	own_goals: 'Own Goal',
	goals_conceded: 'Goals Conceded',
	defensive_contribution: 'Defensive Contribution',
	bonus: 'Bonus Points',
	total: 'Total Points',
	total_points: 'Total Points',
}

const breakdownOrder = [
	'minutes',
	'goals_scored',
	'assists',
	'clean_sheets',
	'saves',
	'penalties_saved',
	'penalties_missed',
	'yellow_cards',
	'red_cards',
	'own_goals',
	'goals_conceded',
	'defensive_contribution',
	'bonus',
	'total',
	'total_points',
] as const

/** Full position stats — MIN / xG / scoring events. */
const positionStats: Record<Player['position'], StatConfig[]> = {
	GKP: [
		{ label: 'MIN', key: 'minutes', description: 'Minutes Played' },
		{ label: 'XGC', key: 'expectedGoalsConceded', description: 'Expected Goals Conceded' },
		{ label: 'CS', key: 'cleanSheets', description: 'Clean Sheets' },
		{ label: 'SV', key: 'saves', description: 'Saves' },
		{ label: 'PS', key: 'savePenalty', description: 'Penalties Saved' },
		{ label: 'YC', key: 'yellowCards', description: 'Yellow Cards' },
		{ label: 'RC', key: 'redCards', description: 'Red Cards' },
	],
	DEF: [
		{ label: 'MIN', key: 'minutes', description: 'Minutes Played' },
		{ label: 'XGC', key: 'expectedGoalsConceded', description: 'Expected Goals Conceded' },
		{ label: 'CS', key: 'cleanSheets', description: 'Clean Sheets' },
		{ label: 'G', key: 'goals', description: 'Goals' },
		{ label: 'A', key: 'assists', description: 'Assists' },
		{ label: 'YC', key: 'yellowCards', description: 'Yellow Cards' },
		{ label: 'RC', key: 'redCards', description: 'Red Cards' },
	],
	MID: [
		{ label: 'MIN', key: 'minutes', description: 'Minutes Played' },
		{ label: 'XGI', key: 'expectedGoalInvolvements', description: 'Expected Goal Involvements' },
		{ label: 'G', key: 'goals', description: 'Goals' },
		{ label: 'A', key: 'assists', description: 'Assists' },
		{ label: 'CS', key: 'cleanSheets', description: 'Clean Sheets' },
		{ label: 'YC', key: 'yellowCards', description: 'Yellow Cards' },
		{ label: 'RC', key: 'redCards', description: 'Red Cards' },
	],
	FWD: [
		{ label: 'MIN', key: 'minutes', description: 'Minutes Played' },
		{ label: 'XG', key: 'expectedGoals', description: 'Expected Goals' },
		{ label: 'XA', key: 'expectedAssists', description: 'Expected Assists' },
		{ label: 'G', key: 'goals', description: 'Goals' },
		{ label: 'A', key: 'assists', description: 'Assists' },
		{ label: 'YC', key: 'yellowCards', description: 'Yellow Cards' },
		{ label: 'RC', key: 'redCards', description: 'Red Cards' },
	],
}

function formatStatValue(value: number | undefined | null): string {
	if (value === undefined || value === null) return '0'
	if (typeof value === 'number' && !Number.isInteger(value)) return value.toFixed(1)
	return String(value)
}

export function PlayerRow({ player }: PlayerRowProps) {
	const t = useTranslations('LivePoints')
	const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

	const stats = useMemo(() => positionStats[player.position], [player.position])

	const statDescriptions: Record<string, string> = {
		'Minutes Played': t('minutesPlayed'),
		'Expected Goals Conceded': t('expectedGoalsConceded'),
		'Clean Sheets': t('cleanSheets'),
		Saves: t('saves'),
		'Penalties Saved': t('penaltiesSaved'),
		'Yellow Cards': t('yellowCards'),
		'Red Cards': t('redCards'),
		Goals: t('goals'),
		Assists: t('assists'),
		'Expected Goal Involvements': t('expectedGoalInvolvements'),
		'Expected Goals': t('expectedGoals'),
		'Expected Assists': t('expectedAssists'),
	}

	const breakdownFromExplain = useMemo(() => {
		if (!player.breakdownStats || player.breakdownStats.length === 0) {
			return []
		}

		const totals = player.breakdownStats.reduce<
			Map<string, { points: number; value: number }>
		>((acc, stat) => {
			const current = acc.get(stat.identifier) ?? { points: 0, value: 0 }
			acc.set(stat.identifier, {
				points: current.points + stat.points,
				value: current.value + (stat.value ?? 0),
			})
			return acc
		}, new Map())

		const orderedKeys = new Set<string>(breakdownOrder)

		const orderedBreakdown = breakdownOrder
			.map(identifier => {
				const entry = totals.get(identifier)
				if (!entry || entry.points === 0) {
					return null
				}
				return {
					category: breakdownLabelMap[identifier] ?? identifier,
					points: entry.points,
					value: entry.value || undefined,
				}
			})
			.filter(Boolean) as { category: string; points: number; value?: number }[]

		const remaining = Array.from(totals.entries())
			.filter(([identifier, entry]) => !orderedKeys.has(identifier) && entry.points !== 0)
			.map(([identifier, entry]) => ({
				category: breakdownLabelMap[identifier] ?? identifier,
				points: entry.points,
				value: entry.value || undefined,
			}))

		return [...orderedBreakdown, ...remaining]
	}, [player.breakdownStats])

	const playerDetail: PlayerDetail = useMemo(() => {
		const hasExplanation =
			player.breakdownStats !== undefined && player.breakdownStats.length > 0
		const explanationMatchesCurrentStats = liveExplanationMatchesCurrentStats(player)
		const officialSum = breakdownFromExplain.reduce((sum, item) => sum + item.points, 0)
		const officialMatchesTotal =
			hasExplanation &&
			explanationMatchesCurrentStats &&
			officialSum === player.stats.points

		const resolved = resolvePointsBreakdown({
			official: breakdownFromExplain,
			officialMatchesTotal,
			player,
		})

		return {
			id: player.id,
			name: player.name,
			team: player.team,
			teamShort: player.teamShort,
			position: player.position,
			points: player.stats.points,
			ownershipPercentage: null,
			bps: typeof player.bps === 'number' ? player.bps : null,
			bonusPoints: player.stats.bonusPoints,
			playingStatus: player.playingStatus,
			breakdownPending: resolved.pending,
			breakdownSource: resolved.source,
			stats: {
				minutes: player.stats.minutes,
				goals: player.stats.goals,
				assists: player.stats.assists,
				cleanSheets: player.stats.cleanSheets,
				saves: player.stats.saves,
				penaltiesSaved: player.stats.savePenalty,
				yellowCards: player.stats.yellowCards,
				redCards: player.stats.redCards,
				goalsConceded: player.stats.goalsConceded,
				defensiveContribution: player.stats.defensiveContribution,
				ownGoals: player.stats.ownGoals,
				penaltiesMissed: player.stats.penaltiesMissed,
			},
			pointsBreakdown: resolved.lines,
		}
	}, [player, breakdownFromExplain])

	const statusIcon =
		player.playingStatus === 'FINISHED' ? (
			<CheckCircle2 aria-hidden="true" className="size-3.5 text-primary-ink" />
		) : player.playingStatus === 'NOT_STARTED' ? (
			<Clock aria-hidden="true" className="size-3.5 text-muted-foreground" />
		) : (
			<span className="live-dot" aria-hidden="true" />
		)

	const statusText =
		player.playingStatus === 'PLAYING'
			? t('statusPlaying')
			: player.playingStatus === 'FINISHED'
				? t('statusFinished')
				: t('statusNotStarted')

	const formatValue = (key: keyof Player['stats']) =>
		formatStatValue(player.stats[key] as number | undefined | null)

	return (
		<>
			<div
				className={cn(
					'group cursor-pointer rounded-lg border bg-card px-2.5 py-2 transition-colors sm:px-3 sm:py-2.5',
					'hover:border-electric/30 hover:bg-accent/30',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
					player.isBench && 'border-dashed bg-muted/25',
					player.playingStatus === 'PLAYING' && 'border-success/20 bg-success/[0.03]',
				)}
				role="button"
				tabIndex={0}
				aria-label={t('viewPlayer', { player: player.name })}
				onClick={() => setIsDetailModalOpen(true)}
				onKeyDown={event => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault()
						setIsDetailModalOpen(true)
					}
				}}
			>
				{/*
				  Single-row scoreboard:
				  [status][POS][TEAM][NAME····]  [MIN][XG][…][YC][RC]  [PTS]
				  Identity is fixed-width; stats share remaining space equally; PTS is fixed.
				*/}
				<div
					className="grid w-full items-center gap-x-2 sm:gap-x-3"
					style={{
						gridTemplateColumns: `auto auto auto minmax(4.5rem, 9rem) minmax(0, 1fr) 2.75rem`,
					}}
				>
					{/* Status */}
					<span
						className="flex size-5 shrink-0 items-center justify-center"
						title={statusText}
						aria-label={statusText}
					>
						{statusIcon}
					</span>

					{/* Position */}
					<Badge
						className={cn(
							'h-5 shrink-0 px-1.5 font-display text-label font-bold tracking-wide',
							positionBadgeClass(player.position),
						)}
					>
						{player.position}
					</Badge>

					{/* Team */}
					<span className="w-8 shrink-0 font-mono text-caption font-semibold uppercase tracking-wide text-muted-foreground">
						{player.teamShort}
					</span>

					{/* Name + C/V */}
					<div className="flex min-w-0 items-center gap-1">
						<span className="truncate font-display text-sm font-bold uppercase tracking-wide">
							{player.name}
						</span>
						{player.isCaptain ? (
							<span className="shrink-0 rounded-sm bg-plum px-1 py-px font-mono text-label font-bold text-electric">
								C
							</span>
						) : null}
						{player.isViceCaptain ? (
							<span className="shrink-0 rounded-sm border border-plum/30 bg-plum/10 px-1 py-px font-mono text-label font-bold text-plum">
								V
							</span>
						) : null}
					</div>

					{/* Stats — equal share of remaining width.
					    Do not stopPropagation: the whole row opens the detail modal.
					    Tooltips still work on hover without blocking the click. */}
					<TooltipProvider delayDuration={250}>
						<div
							className="grid min-w-0"
							style={{
								gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
							}}
						>
							{stats.map(stat => {
								const value = formatValue(stat.key)
								const description =
									statDescriptions[stat.description] ?? stat.description
								const highlight =
									stat.key === 'goals' ||
									stat.key === 'assists' ||
									stat.key === 'saves' ||
									stat.key === 'cleanSheets' ||
									stat.key === 'minutes'
								return (
									<Tooltip key={stat.key}>
										<TooltipTrigger asChild>
											<div
												className="min-w-0 px-0.5 text-center"
												aria-label={t('statValue', {
													stat: description,
													value,
												})}
											>
												<div className="truncate font-display text-micro font-semibold uppercase tracking-wider text-muted-foreground">
													{stat.label}
												</div>
												<div
													className={cn(
														'truncate font-mono text-xs font-semibold tabular-nums sm:text-sm',
														highlight ? 'text-primary-ink' : 'text-foreground',
													)}
												>
													{value}
												</div>
											</div>
										</TooltipTrigger>
										<TooltipContent>
											<p>
												{t('statValue', {
													stat: description,
													value,
												})}
											</p>
										</TooltipContent>
									</Tooltip>
								)
							})}
						</div>
					</TooltipProvider>

					{/* Points */}
					<div
						className="flex h-9 w-11 shrink-0 flex-col items-center justify-center justify-self-end rounded-md border border-primary/15 bg-primary/10"
						aria-label={
							player.stats.bonusPoints > 0
								? t('pointsIncludingBonus', {
										points: player.stats.points,
										bonus: player.stats.bonusPoints,
									})
								: t('pointsTotalOnly', { points: player.stats.points })
						}
					>
						<span className="font-mono text-base font-bold tabular-nums leading-none text-primary-ink">
							{player.stats.points}
						</span>
						{player.stats.bonusPoints > 0 ? (
							<span className="mt-0.5 font-mono text-micro font-semibold leading-none text-warning">
								+{player.stats.bonusPoints}
							</span>
						) : null}
					</div>
				</div>
			</div>

			<PlayerDetailModal
				player={playerDetail}
				isOpen={isDetailModalOpen}
				onClose={() => setIsDetailModalOpen(false)}
			/>
		</>
	)
}
