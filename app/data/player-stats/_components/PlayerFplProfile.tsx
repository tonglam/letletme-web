'use client'

import type {
	PlayerDetailData,
	PlayerRadarAxis,
	PlayerRadarProfile,
	PlayerStateProfileData
} from '@/lib/graphql/operations/players'
import { RadarChart as ProfileRadarChart } from '@/components/charts/RadarChart'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { PlayerStatsSection } from './PlayerStatsSection'

type RadarPlayer = {
	id: string
	name: string
	profile: PlayerRadarProfile
}

const POSITION_LABELS: Record<
	number,
	'goalkeeper' | 'defender' | 'midfielder' | 'forward'
> = {
	1: 'goalkeeper',
	2: 'defender',
	3: 'midfielder',
	4: 'forward'
}

const POSITION_CODES: Record<number, string> = {
	1: 'GKP',
	2: 'DEF',
	3: 'MID',
	4: 'FWD'
}

function axisLabel(
	code: string,
	t: ReturnType<typeof useTranslations<'PlayerStats.profile'>>
) {
	const labels: Record<string, string> = {
		FPL_POINTS_PER_90: t('axis.pointsPer90'),
		FPL_CLEAN_SHEETS_PER_START: t('axis.cleanSheetsPerStart'),
		FPL_SAVES_PER_90: t('axis.savesPer90'),
		FPL_BONUS_PER_90: t('axis.bonusPer90'),
		FPL_BPS_PER_90: t('axis.bpsPer90'),
		FPL_XGI_PER_90: t('axis.xgiPer90'),
		FPL_ATTACKING_RETURNS_PER_90: t('axis.attackingReturnsPer90'),
		FPL_GOALS_PER_90: t('axis.goalsPer90'),
		FPL_ASSISTS_PER_90: t('axis.assistsPer90')
	}
	return labels[code] ?? code.replace(/^FPL_/, '').replaceAll('_', ' ')
}

function axisValue(axis: PlayerRadarAxis) {
	if (!axis.available || axis.value === null) return '—'
	if (axis.unit === 'per90') return axis.value.toFixed(2)
	if (axis.unit === 'rate') return `${axis.value.toFixed(1)}%`
	return axis.value.toFixed(1)
}

function percentileValue(value: number | null) {
	return value === null || !Number.isFinite(value)
		? '—'
		: `${Math.round(value)}%`
}

function RadarChartView({
	players,
	t
}: {
	players: RadarPlayer[]
	t: ReturnType<typeof useTranslations<'PlayerStats.profile'>>
}) {
	const first = players[0]
	if (!first) return null
	const title = players.map(player => player.name).join(` ${t('versus')} `)
	const chartData = first.profile.axes.map((axis, index) => ({
		key: axis.code,
		label: axisLabel(axis.code, t),
		values: Object.fromEntries(
			players.map(player => {
				const playerAxis =
					player.profile.axes.find(candidate => candidate.code === axis.code) ??
					player.profile.axes[index]
				return [
					player.id,
					playerAxis?.available && playerAxis.percentile !== null
						? Math.max(0, Math.min(100, playerAxis.percentile))
						: undefined
				]
			})
		)
	}))

	return (
		<div className="flex min-w-0 items-center justify-center">
			<ProfileRadarChart
				data={chartData}
				series={players.map((player, index) => ({
					key: player.id,
					color: index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
					fillOpacity: index === 0 ? 0.12 : 0.06
				}))}
				ariaLabel={t('chartLabel', { players: title })}
			/>
		</div>
	)
}

function RadarLegend({
	players,
	t
}: {
	players: RadarPlayer[]
	t: ReturnType<typeof useTranslations<'PlayerStats.profile'>>
}) {
	const axes = players[0]?.profile.axes ?? []
	return (
		<div className="space-y-2">
			<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				{players.map((player, index) => (
					<div
						key={player.id}
						className="flex items-center gap-1.5"
					>
						<span
							className="size-2 rounded-full"
							style={{
								backgroundColor:
									index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--foreground))'
							}}
							aria-hidden="true"
						/>
						<span>{player.name}</span>
					</div>
				))}
			</div>
			<div className="divide-y divide-border/60 rounded-lg border border-border/60">
				{axes.map((axis, index) => (
					<div
						key={axis.code}
						className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-sm"
					>
						<div className="min-w-0">
							<p className="truncate text-muted-foreground">
								{axisLabel(axis.code, t)}
							</p>
							<p className="text-caption text-muted-foreground/70">
								{axis.available && axis.percentile !== null
									? t('positionPercentile', {
											value: percentileValue(axis.percentile)
										})
									: t('notAvailable')}
							</p>
						</div>
						<div className="flex gap-3 text-right font-display font-semibold tabular-nums">
							{players.map(player => {
								const value =
									player.profile.axes.find(
										candidate => candidate.code === axis.code
									) ?? player.profile.axes[index]
								return (
									<span key={player.id}>{value ? axisValue(value) : '—'}</span>
								)
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function ProfileCard({
	player,
	t
}: {
	player: RadarPlayer
	t: ReturnType<typeof useTranslations<'PlayerStats.profile'>>
}) {
	const validAxes = player.profile.axes.filter(
		axis => axis.available && axis.percentile !== null
	).length
	if (validAxes < 3) {
		return (
			<div className="rounded-lg border border-border/60 px-3 py-4 text-sm text-muted-foreground">
				{t('notRated')}
			</div>
		)
	}
	return (
		<div className="space-y-4">
			<RadarChartView
				players={[player]}
				t={t}
			/>
			<RadarLegend
				players={[player]}
				t={t}
			/>
		</div>
	)
}

function profileFromState(
	player: PlayerDetailData,
	profile: PlayerStateProfileData | null
): RadarPlayer | null {
	if (!profile?.profileRadar) return null
	return {
		id: String(player.id),
		name: player.webName,
		profile: profile.profileRadar
	}
}

export function PlayerFplProfile({
	player,
	comparison,
	profile,
	comparisonProfile,
	seasonStatsAvailable,
	isLoading,
	isComparisonLoading
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData | null
	comparisonProfile: PlayerStateProfileData | null
	seasonStatsAvailable: boolean
	isLoading: boolean
	isComparisonLoading: boolean
}) {
	const t = useTranslations('PlayerStats.profile')
	const first = useMemo(
		() => profileFromState(player, profile),
		[player, profile]
	)
	const second = useMemo(
		() => (comparison ? profileFromState(comparison, comparisonProfile) : null),
		[comparison, comparisonProfile]
	)
	const samePosition = Boolean(
		second && first && first.profile.position === second.profile.position
	)
	const canOverlay = Boolean(
		samePosition &&
		first &&
		(!second ||
			(first.profile.axes.filter(
				axis => axis.available && axis.percentile !== null
			).length >= 3 &&
				second.profile.axes.filter(
					axis => axis.available && axis.percentile !== null
				).length >= 3))
	)

	if (!seasonStatsAvailable) {
		return (
			<PlayerStatsSection
				id="ps-profile"
				title={t('title')}
				hint={t('preseasonHint')}
			>
				<p className="rounded-lg border border-border/60 px-3 py-3 text-sm text-muted-foreground">
					{t('notRated')}
				</p>
			</PlayerStatsSection>
		)
	}

	if (isLoading || (comparison && isComparisonLoading)) {
		return (
			<PlayerStatsSection
				id="ps-profile"
				title={t('title')}
				hint={t('hint')}
			>
				<div
					className="h-52 animate-pulse rounded-lg border border-border/60 bg-muted/20"
					aria-label={t('loading')}
				/>
			</PlayerStatsSection>
		)
	}

	if (!first) {
		return (
			<PlayerStatsSection
				id="ps-profile"
				title={t('title')}
				hint={t('hint')}
			>
				<p className="rounded-lg border border-border/60 px-3 py-3 text-sm text-muted-foreground">
					{t('unavailable')}
				</p>
			</PlayerStatsSection>
		)
	}

	const sourceNote = t('sourceNote', {
		season: first.profile.season,
		gw: first.profile.asOfEventId ?? '—'
	})

	return (
		<PlayerStatsSection
			id="ps-profile"
			title={t('title')}
			hint={`${t('hint')} ${sourceNote}`}
		>
			{second && !samePosition ? (
				<>
					<p className="mb-3 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
						{t('crossPositionHint')}
					</p>
					<div className="grid gap-8 lg:grid-cols-2">
						<div className="min-w-0">
							<p className="mb-2 text-sm font-semibold">
								{first.name} · {POSITION_CODES[first.profile.position] ?? '—'}
							</p>
							<ProfileCard
								player={first}
								t={t}
							/>
						</div>
						<div className="min-w-0">
							<p className="mb-2 text-sm font-semibold">
								{second.name} · {POSITION_CODES[second.profile.position] ?? '—'}
							</p>
							<ProfileCard
								player={second}
								t={t}
							/>
						</div>
					</div>
				</>
			) : second && !canOverlay ? (
				<div className="grid gap-8 lg:grid-cols-2">
					<div className="min-w-0">
						<p className="mb-2 text-sm font-semibold">
							{first.name} · {POSITION_CODES[first.profile.position] ?? '—'}
						</p>
						<ProfileCard
							player={first}
							t={t}
						/>
					</div>
					<div className="min-w-0">
						<p className="mb-2 text-sm font-semibold">
							{second.name} · {POSITION_CODES[second.profile.position] ?? '—'}
						</p>
						<ProfileCard
							player={second}
							t={t}
						/>
					</div>
				</div>
			) : (
				<div className="grid items-center gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(13rem,0.8fr)]">
					<div>
						<p className="mb-2 text-sm font-semibold">
							{POSITION_CODES[first.profile.position] ?? '—'} ·{' '}
							{t(POSITION_LABELS[first.profile.position] ?? 'midfielder')}
						</p>
						<RadarChartView
							players={second ? [first, second] : [first]}
							t={t}
						/>
					</div>
					<RadarLegend
						players={second ? [first, second] : [first]}
						t={t}
					/>
				</div>
			)}
			<p className="mt-3 text-caption text-muted-foreground">{t('percentileHint')}</p>
		</PlayerStatsSection>
	)
}
