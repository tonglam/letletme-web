'use client'

import { StatsMetricTile } from '@/components/stats/StatsSurfaces'
import type { EntrySummary } from '@/lib/graphql/operations/entries'
import { cn } from '@/lib/utils'
import { Crown, Repeat, Trophy, Zap } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { memo, type ReactNode } from 'react'
import type { NumberFormatOptions } from 'use-intl'

export type LiveTeamOverall = Pick<
	EntrySummary,
	'overallPoints' | 'overallRank' | 'teamValue' | 'bank' | 'totalTransfers'
>

interface TeamStatsProps {
	overall?: LiveTeamOverall
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

function TeamStatsComponent({ overall, stats }: TeamStatsProps) {
	const t = useTranslations('LivePoints')
	const format = useFormatter()
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
	const formatMetric = (
		value: number | null,
		options?: NumberFormatOptions,
	) => (value == null || value <= 0 ? '—' : format.number(value, options))
	const formatMoney = (value: number | null) =>
		value == null ? '—' : `£${(value / 10).toFixed(1)}m`

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
						<MetaItem
							label={t('chip')}
							value={chipDisplay}
							valueClassName={
								chipActive ? 'text-primary-ink' : 'text-muted-foreground'
							}
						/>
					</div>
				</div>

				{overall ? (
					<div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-border/60 bg-muted/20 px-3 py-3 font-mono text-xs tabular-nums sm:mb-6 sm:px-4">
						<MetaItem
							label={t('overallPoints')}
							value={formatMetric(overall.overallPoints)}
						/>
						<MetaItem
							label={t('overallRank')}
							value={formatMetric(overall.overallRank, { notation: 'compact' })}
							valueClassName="text-primary-ink"
						/>
						<MetaItem
							label={t('teamValue')}
							value={formatMoney(overall.teamValue)}
						/>
						<MetaItem
							label={t('bank')}
							value={formatMoney(overall.bank)}
						/>
						<MetaItem
							label={t('totalTransfers')}
							value={formatMetric(overall.totalTransfers)}
						/>
					</div>
				) : null}

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
