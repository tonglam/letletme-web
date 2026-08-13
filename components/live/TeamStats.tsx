'use client'

import { StatsMetricTile } from '@/components/stats/StatsSurfaces'
import { cn } from '@/lib/utils'
import { Crown, Repeat, Trophy, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { memo, type ReactNode } from 'react'

interface TeamStatsProps {
	stats: {
		teamName: string
		playerName: string
		livePoints: number
		transferCost: number
		captainName: string
		liveTotalPoints: number
		played: string
		chips: {
			bench: boolean
			triple: boolean
			wildcard: boolean
			freeHit?: boolean
		}
	}
}

function MetaItem({
	label,
	value,
	valueClassName,
}: {
	label: string
	value: ReactNode
	valueClassName?: string
}) {
	return (
		<div className="flex min-w-0 items-baseline gap-2">
			<span className="eyebrow shrink-0">
				{label}
			</span>
			<span
				className={cn(
					'truncate font-mono text-sm font-semibold tabular-nums text-foreground',
					valueClassName,
				)}
			>
				{value}
			</span>
		</div>
	)
}

function TeamStatsComponent({ stats }: TeamStatsProps) {
	const t = useTranslations('LivePoints')
	const chipLabels: Record<string, string> = {
		bench: t('benchBoost'),
		triple: t('tripleCaptain'),
		wildcard: t('wildcard'),
		freeHit: t('freeHit'),
	}
	const activeChipNames = Object.entries(stats.chips)
		.filter(([, active]) => active)
		.map(([chip]) => chipLabels[chip] ?? chip)
	const chipActive = activeChipNames.length > 0
	const chipDisplay = chipActive ? activeChipNames.join(' · ') : t('noActiveChips')

	return (
		<div className="mb-8 overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
			<div className="p-4 sm:p-6">
				{/* Team identity + light meta (not metric tiles) */}
				<div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
					<div className="min-w-0">
						<p className="chyron">{t('livePoints')}</p>
						<h2 className="mt-1 truncate font-display text-2xl font-bold uppercase tracking-wide">
							{stats.teamName}
						</h2>
						{stats.playerName ? (
							<p className="mt-1 truncate text-sm text-muted-foreground">
								{stats.playerName}
							</p>
						) : null}
					</div>

					<div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-3 sm:border-t-0 sm:pt-0">
						<MetaItem label={t('played')} value={stats.played} />
						<span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
						<MetaItem
							label={t('chip')}
							value={chipDisplay}
							valueClassName={
								chipActive ? 'text-primary-ink' : 'text-muted-foreground'
							}
						/>
					</div>
				</div>

				{/* Core score metrics only — roomy 4-up grid */}
				<div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
					<StatsMetricTile
						className="surface-inset"
						icon={<Zap className="size-3.5 sm:size-4" aria-hidden="true" />}
						label={t('livePoints')}
						value={stats.livePoints}
						valueClassName="text-primary-ink"
					/>
					<StatsMetricTile
						className="surface-inset"
						icon={<Repeat className="size-3.5 sm:size-4" aria-hidden="true" />}
						label={t('transferCost')}
						value={
							stats.transferCost > 0 ? (
								<span className="text-destructive">-{stats.transferCost}</span>
							) : (
								0
							)
						}
					/>
					<StatsMetricTile
						className="surface-inset"
						icon={<Crown className="size-3.5 sm:size-4" aria-hidden="true" />}
						label={t('captain')}
						value={stats.captainName || '—'}
						valueClassName="text-lg sm:text-xl"
					/>
					<StatsMetricTile
						className="surface-inset"
						icon={<Trophy className="size-3.5 sm:size-4" aria-hidden="true" />}
						label={t('liveTotal')}
						value={stats.liveTotalPoints}
					/>
				</div>
			</div>
		</div>
	)
}

export const TeamStats = memo(TeamStatsComponent)
