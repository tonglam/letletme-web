'use client'

import { PlayerDetailModal } from '@/components/live/PlayerDetailModal'
import { useMatchPlayerDetail } from '@/components/live/match-card/useMatchPlayerDetail'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { Card } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import type { HomeGameweek } from '@/lib/graphql/operations/home'
import { formatCompactNumber } from '@/lib/utils'
import { ArrowRight, ArrowRightCircle, Crown, Trophy, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

type HomeGameweekOverview = NonNullable<
	HomeGameweek['gameweekDesk']['overview']
>

interface StatsSectionProps {
	currentEventId: number | null
	overview: HomeGameweekOverview | null
}

type PlayerDetailTarget = {
	player: {
		player: string
		element: number
		elementType: number
		totalPoints: number
	}
	team: string
	teamShort: string
}

type HomeStat = {
	label: string
	value: string
	href: string | null
	detailTarget: PlayerDetailTarget | null
	icon: ReactNode
}

const tileIconStyles = [
	'bg-plum text-electric',
	'bg-electric text-plum',
	'bg-pink text-fascia-foreground',
	'bg-secondary text-foreground'
] as const

export function StatsSection({ currentEventId, overview }: StatsSectionProps) {
	const t = useTranslations('Home')
	const playerDetail = useMatchPlayerDetail(currentEventId ?? undefined)
	const makeDetailTarget = (
		player: {
			id: number
			teamShortName?: string | null
			webName: string
		},
		points: number
	): PlayerDetailTarget => {
		const teamShort = player.teamShortName?.trim() || '—'
		return {
			player: {
				player: player.webName,
				element: player.id,
				elementType: 3,
				totalPoints: points
			},
			team: teamShort,
			teamShort
		}
	}
	const header = (
		<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 className="flex items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide">
					<GameweekBadge
						gameweek={currentEventId}
						size="sm"
						fontFamily="display"
					/>
					<span>{t('homeGameweekOverview')}</span>
				</h2>
			</div>
			<Link
				href="/explore/gameweek"
				prefetch={false}
				className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
			>
				{t('viewGameweekStats')}
				<ArrowRight
					aria-hidden="true"
					className="size-4"
				/>
			</Link>
		</div>
	)

	if (!overview || !currentEventId) {
		return (
			<Card className="p-4 sm:p-6 lg:p-8">
				{header}
				<div className="py-12 text-center text-muted-foreground">
					<p className="text-sm">{t('noStats')}</p>
				</div>
			</Card>
		)
	}

	const chipLabels: Record<string, string> = {
		bboost: t('benchBoost'),
		'3xc': t('tripleCaptain'),
		wildcard: t('wildcard'),
		freehit: t('freeHit')
	}
	const stats: HomeStat[] = [
		{
			label: t('highestScore'),
			value: overview.highestPoints?.toString() ?? '0',
			href: overview.highestScoringEntry && currentEventId
				? `/live/points/${overview.highestScoringEntry}?gw=${currentEventId}`
				: null,
			detailTarget: null,
			icon: (
				<Trophy
					aria-hidden="true"
					className="size-5"
				/>
			)
		},
		{
			label: t('topScorer'),
			value: overview.topScorer
				? `${overview.topScorer.webName} (${overview.topScorer.points})`
				: 'N/A',
			href: null,
			detailTarget: overview.topScorer
				? makeDetailTarget(overview.topScorer, overview.topScorer.points)
				: null,
			icon: (
				<Zap
					aria-hidden="true"
					className="size-5"
				/>
			)
		},
		{
			label: t('mostSelectedCaptain'),
			value: overview.mostCaptained?.webName ?? 'N/A',
			href: null,
			detailTarget: overview.mostCaptained
				? makeDetailTarget(overview.mostCaptained, 0)
				: null,
			icon: (
				<Crown
					aria-hidden="true"
					className="size-5"
				/>
			)
		},
		{
			label: t('topChipPlayed'),
			value: overview.mostPlayedChip
				? `${chipLabels[overview.mostPlayedChip.name] ?? overview.mostPlayedChip.name} (${formatCompactNumber(overview.mostPlayedChip.numberPlayed)})`
				: t('unknownChip'),
			href: null,
			detailTarget: null,
			icon: (
				<ArrowRightCircle
					aria-hidden="true"
					className="size-5"
				/>
			)
		}
	] as const

	return (
		<>
			<Card className="p-4 sm:p-6 lg:p-8">
				{header}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{stats.map((stat, index) => {
						const tile = (
							<>
								<div
									className={`mb-3 inline-flex rounded-md p-2.5 ${tileIconStyles[index % tileIconStyles.length]}`}
								>
									{stat.icon}
								</div>
								<div className="space-y-1">
									<p className="eyebrow">{stat.label}</p>
									<p className="whitespace-normal break-words font-display text-2xl font-bold text-foreground">
										{stat.value}
									</p>
								</div>
							</>
						)
						const tileClassName =
							'block rounded-lg border bg-background p-4 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-electric/50 hover:shadow-sticker-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
						const detailTarget = stat.detailTarget

						return stat.href ? (
							<Link
								key={stat.label}
								href={stat.href}
								className={tileClassName}
								aria-label={`${stat.label}: ${stat.value}`}
							>
								{tile}
							</Link>
						) : detailTarget ? (
							<button
								key={stat.label}
								type="button"
								className={`${tileClassName} w-full text-left`}
								aria-label={`${stat.label}: ${stat.value}`}
								onClick={() =>
									void playerDetail.openPlayerDetail(
										detailTarget.player,
										detailTarget.team,
										detailTarget.teamShort
									)
								}
							>
								{tile}
							</button>
						) : (
							<div
								key={stat.label}
								className={tileClassName}
							>
								{tile}
							</div>
						)
					})}
				</div>
			</Card>
			<PlayerDetailModal
				player={playerDetail.selectedPlayer}
				isOpen={playerDetail.isOpen}
				onClose={playerDetail.closePlayerDetail}
				isLoading={playerDetail.isLoading}
			/>
		</>
	)
}
