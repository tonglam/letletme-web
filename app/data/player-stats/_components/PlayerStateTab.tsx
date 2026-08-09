import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type {
	PlayerStateConfidence,
	PlayerStateDimension,
	PlayerStateDimensionKind,
	PlayerStateDimensionRating,
	PlayerStateMappingStatus,
	PlayerStateMetric,
	PlayerStateProfileData,
	PlayerStateTrend
} from '@/lib/graphql/operations/players'
import {
	CalendarDays,
	CircleHelp,
	Database,
	Gauge,
	ShieldCheck
} from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

interface PlayerStateSlotProps {
	name: string
	profile: PlayerStateProfileData | null
	isLoading: boolean
	error: string | null
}

interface PlayerStateTabProps {
	player: PlayerStateSlotProps
	comparison?: PlayerStateSlotProps | null
}

const DIMENSION_ORDER: PlayerStateDimensionKind[] = [
	'AVAILABILITY_ROLE',
	'FPL_OUTPUT',
	'REAL_WORLD_PROCESS',
	'HISTORICAL_RELIABILITY',
	'OUTLOOK'
]

const PREFERRED_METRICS = [
	'FPL_POINTS_PER_90',
	'FPL_RETURN_RATE',
	'UNDERSTAT_NPXG_PER_90',
	'UNDERSTAT_XA_PER_90',
	'OWN_BASELINE_PERCENTILE',
	'OUTLOOK_AVERAGE_FDR'
]

const DIMENSION_KEYS = {
	AVAILABILITY_ROLE: 'dimension.availability_role',
	FPL_OUTPUT: 'dimension.fpl_output',
	REAL_WORLD_PROCESS: 'dimension.real_world_process',
	HISTORICAL_RELIABILITY: 'dimension.historical_reliability',
	OUTLOOK: 'dimension.outlook'
} as const satisfies Record<PlayerStateDimensionKind, string>

const RATING_KEYS = {
	SECURE: 'rating.secure',
	MANAGED: 'rating.managed',
	AT_RISK: 'rating.at_risk',
	STRONG: 'rating.strong',
	TYPICAL: 'rating.typical',
	WEAK: 'rating.weak',
	PROVEN: 'rating.proven',
	VARIABLE: 'rating.variable',
	EMERGING: 'rating.emerging',
	INSUFFICIENT: 'rating.insufficient',
	FAVOURABLE: 'rating.favourable',
	NEUTRAL: 'rating.neutral',
	DIFFICULT: 'rating.difficult',
	TEAM_CONTEXT_ONLY: 'rating.team_context_only',
	UNAVAILABLE: 'rating.unavailable',
	UNKNOWN: 'rating.unknown'
} as const satisfies Record<PlayerStateDimensionRating, string>

const TREND_KEYS = {
	RISING: 'trend.rising',
	STABLE: 'trend.stable',
	FALLING: 'trend.falling',
	MIXED: 'trend.mixed',
	UNAVAILABLE: 'trend.unavailable',
	UNKNOWN: 'trend.unknown'
} as const satisfies Record<PlayerStateTrend, string>

const CONFIDENCE_KEYS = {
	HIGH: 'confidenceValue.high',
	MEDIUM: 'confidenceValue.medium',
	LOW: 'confidenceValue.low'
} as const satisfies Record<PlayerStateConfidence, string>

const MAPPING_KEYS = {
	VERIFIED: 'mapping.verified',
	UNVERIFIED: 'mapping.unverified',
	AMBIGUOUS: 'mapping.ambiguous',
	QUARANTINED: 'mapping.quarantined',
	UNAVAILABLE: 'mapping.unavailable'
} as const satisfies Record<PlayerStateMappingStatus, string>

const LIMITATION_KEYS = {
	CURRENT_FPL_INSUFFICIENT: 'limitation.currentFplInsufficient',
	EARLY_SEASON_SAMPLE: 'limitation.earlySeasonSample',
	CURRENT_FPL_COVERAGE_INCOMPLETE: 'limitation.currentFplCoverageIncomplete',
	OUTLOOK_FIXTURE_COVERAGE_UNKNOWN: 'limitation.outlookCoverageUnknown',
	PLAYER_MAPPING_UNAVAILABLE: 'limitation.mappingUnavailable',
	PLAYER_MAPPING_UNVERIFIED: 'limitation.mappingUnverified',
	PLAYER_MAPPING_AMBIGUOUS: 'limitation.mappingAmbiguous',
	PLAYER_MAPPING_QUARANTINED: 'limitation.mappingQuarantined',
	UNDERSTAT_PLAYER_DATA_UNAVAILABLE: 'limitation.understatPlayerUnavailable',
	GKP_PERSONAL_PROCESS_UNAVAILABLE: 'limitation.gkpProcessUnavailable',
	REAL_WORLD_PROCESS_UNAVAILABLE: 'limitation.processUnavailable',
	HISTORICAL_UNDERSTAT_UNAVAILABLE: 'limitation.historicalUnderstatUnavailable',
	OLD_FPL_EXPECTED_METRICS_MASKED: 'limitation.oldExpectedMetricsMasked',
	TREND_WITHHELD_BACKTEST: 'limitation.trendWithheldBacktest',
	TREND_WITHHELD_CROSS_PROVIDER_BACKTEST: 'limitation.crossProviderBacktest'
} as const

const METRIC_KEYS = {
	ROLE_STARTS_LAST_5: 'metric.startsLastFive',
	ROLE_MEDIAN_STARTER_MINUTES: 'metric.medianStarterMinutes',
	AVAILABILITY_CHANCE: 'metric.availabilityChance',
	FPL_POINTS_PER_90: 'metric.fplPointsPer90',
	FPL_RETURN_RATE: 'metric.fplReturnRate',
	FPL_BONUS_PER_90: 'metric.fplBonusPer90',
	FPL_OUTPUT_PERCENTILE: 'metric.fplOutputPercentile',
	UNDERSTAT_NPXG_PER_90: 'metric.understatNpxgPer90',
	UNDERSTAT_XA_PER_90: 'metric.understatXaPer90',
	UNDERSTAT_SHOTS_PER_90: 'metric.understatShotsPer90',
	UNDERSTAT_KEY_PASSES_PER_90: 'metric.understatKeyPassesPer90',
	UNDERSTAT_XG_CHAIN_PER_90: 'metric.understatXgChainPer90',
	UNDERSTAT_XG_BUILDUP_PER_90: 'metric.understatXgBuildupPer90',
	OWN_BASELINE_PERCENTILE: 'metric.ownBaselinePercentile',
	OUTLOOK_AVERAGE_FDR: 'metric.outlookAverageFdr',
	OUTLOOK_DGW_COUNT: 'metric.outlookDgwCount',
	OUTLOOK_BGW_COUNT: 'metric.outlookBgwCount'
} as const

function ratingClass(rating: PlayerStateDimensionRating): string {
	if (['SECURE', 'STRONG', 'PROVEN', 'FAVOURABLE'].includes(rating)) {
		return 'border-success/45 bg-success/10 text-foreground'
	}
	if (['AT_RISK', 'WEAK', 'DIFFICULT'].includes(rating)) {
		return 'border-destructive/35 bg-destructive/10 text-destructive'
	}
	if (['INSUFFICIENT', 'EMERGING', 'UNAVAILABLE', 'UNKNOWN'].includes(rating)) {
		return 'border-warning/35 bg-warning/10 text-warning'
	}
	return 'border-info/35 bg-info/10 text-info'
}

function readableCode(code: string): string {
	return code
		.toLowerCase()
		.split('_')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}

function usefulMetrics(profile: PlayerStateProfileData): PlayerStateMetric[] {
	const available = profile.dimensions
		.flatMap(dimension => dimension.metrics)
		.filter(metric => metric.capability && metric.value !== null)
	const byCode = new Map(available.map(metric => [metric.code, metric]))
	const preferred = PREFERRED_METRICS.flatMap(code => {
		const metric = byCode.get(code)
		return metric ? [metric] : []
	})
	const remaining = available.filter(
		metric => !preferred.some(candidate => candidate.code === metric.code)
	)
	return [...preferred, ...remaining].slice(0, 4)
}

function ProfileSkeleton({ name }: { name: string }) {
	const t = useTranslations('PlayerStats.state')
	return (
		<Card
			className="p-5"
			aria-busy="true"
			aria-label={t('loadingFor', { name })}
		>
			<Skeleton className="mb-3 h-6 w-40" />
			<Skeleton className="mb-6 h-4 w-56" />
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				{DIMENSION_ORDER.map(kind => (
					<Skeleton
						key={kind}
						className="h-20"
					/>
				))}
			</div>
		</Card>
	)
}

function UnavailableProfile({
	name,
	error
}: {
	name: string
	error: string | null
}) {
	const t = useTranslations('PlayerStats.state')
	return (
		<Card
			className="p-6"
			role="status"
		>
			<div className="flex items-start gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
					<CircleHelp
						className="size-5"
						aria-hidden="true"
					/>
				</div>
				<div>
					<h3 className="font-semibold">{t('unavailableTitle', { name })}</h3>
					<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
						{error ?? t('unavailableDescription')}
					</p>
				</div>
			</div>
		</Card>
	)
}

function ProfileCard({
	name,
	profile,
	isLoading,
	error
}: PlayerStateSlotProps) {
	const t = useTranslations('PlayerStats.state')
	const format = useFormatter()

	if (isLoading) return <ProfileSkeleton name={name} />
	if (error || !profile)
		return (
			<UnavailableProfile
				name={name}
				error={error}
			/>
		)

	const dimensions = new Map(
		profile.dimensions.map(dimension => [dimension.kind, dimension])
	)
	const metrics = usefulMetrics(profile)
	const asOf = format.dateTime(new Date(profile.asOf), {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	})

	const dimensionLabel = (kind: PlayerStateDimensionKind) =>
		t(DIMENSION_KEYS[kind])
	const ratingLabel = (rating: PlayerStateDimensionRating) =>
		t(RATING_KEYS[rating])
	const metricLabel = (code: string) => {
		const key = METRIC_KEYS[code as keyof typeof METRIC_KEYS]
		return key ? t(key) : readableCode(code)
	}
	const limitationLabel = (code: string) => {
		const key = LIMITATION_KEYS[code as keyof typeof LIMITATION_KEYS]
		return key ? t(key) : t('limitation.evidenceUnavailable')
	}
	const metricValue = (metric: PlayerStateMetric) => {
		if (metric.value === null) return '—'
		const value = format.number(metric.value, {
			maximumFractionDigits:
				metric.unit === 'count' || metric.unit === 'minutes' ? 0 : 2
		})
		if (
			metric.unit === 'percent' ||
			metric.unit === 'percentile' ||
			metric.unit === 'rate'
		) {
			return `${value}%`
		}
		if (metric.unit === 'minutes') return t('minutesValue', { value })
		if (metric.unit === 'fdr') return `${value}/5`
		return value
	}

	return (
		<Card className="overflow-hidden">
			<header className="border-b bg-muted/35 p-5">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							{t('eyebrow')}
						</p>
						<h3 className="mt-1 text-xl font-bold">{name}</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							{t('asOf', { season: profile.season, date: asOf })}
						</p>
					</div>
					<div className="flex flex-wrap justify-end gap-2">
						<Badge
							variant="outline"
							className="border-primary/45 bg-primary/10 text-foreground"
						>
							{t(TREND_KEYS[profile.trend])}
						</Badge>
						<Badge variant="outline">
							{t('confidence', {
								value: t(CONFIDENCE_KEYS[profile.confidence])
							})}
						</Badge>
						<Badge
							variant="outline"
							className={
								profile.fplOnly
									? 'border-warning/35 bg-warning/10 text-foreground'
									: 'border-success/35 bg-success/10 text-foreground'
							}
						>
							{profile.fplOnly ? t('fplOnly') : t('multiSource')}
						</Badge>
					</div>
				</div>
			</header>

			<div className="space-y-6 p-5">
				<section aria-label={t('dimensionsTitle')}>
					<div className="mb-3 flex items-center gap-2">
						<Gauge
							className="size-4 text-primary-ink"
							aria-hidden="true"
						/>
						<h4 className="text-sm font-semibold uppercase tracking-wide">
							{t('dimensionsTitle')}
						</h4>
					</div>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
						{DIMENSION_ORDER.map(kind => {
							const dimension: PlayerStateDimension | undefined =
								dimensions.get(kind)
							return (
								<div
									key={kind}
									className="rounded-lg border bg-card p-3"
								>
									<p className="min-h-8 text-xs font-medium leading-tight text-muted-foreground">
										{dimensionLabel(kind)}
									</p>
									{dimension ? (
										<Badge
											variant="outline"
											className={`mt-2 ${ratingClass(dimension.rating)}`}
										>
											{ratingLabel(dimension.rating)}
										</Badge>
									) : (
										<span className="mt-2 block text-sm">—</span>
									)}
								</div>
							)
						})}
					</div>
				</section>

				{metrics.length > 0 ? (
					<section aria-label={t('evidenceTitle')}>
						<h4 className="mb-3 text-sm font-semibold uppercase tracking-wide">
							{t('evidenceTitle')}
						</h4>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							{metrics.map(metric => (
								<div
									key={metric.code}
									className="rounded-lg bg-muted/45 p-3"
								>
									<p className="text-xs leading-tight text-muted-foreground">
										{metricLabel(metric.code)}
									</p>
									<p className="mt-2 font-mono text-lg font-semibold">
										{metricValue(metric)}
									</p>
									{metric.percentile !== null ? (
										<p className="mt-1 text-[11px] text-muted-foreground">
											{t('peerPercentile', {
												value: format.number(metric.percentile, {
													maximumFractionDigits: 0
												})
											})}
										</p>
									) : null}
								</div>
							))}
						</div>
					</section>
				) : null}

				{profile.outlook.gameweeks.length > 0 ? (
					<section aria-label={t('outlookTitle')}>
						<div className="mb-3 flex items-center gap-2">
							<CalendarDays
								className="size-4 text-primary-ink"
								aria-hidden="true"
							/>
							<h4 className="text-sm font-semibold uppercase tracking-wide">
								{t('outlookTitle')}
							</h4>
						</div>
						<div className="flex flex-wrap gap-2">
							{profile.outlook.gameweeks.map(gameweek => (
								<div
									key={gameweek.eventId}
									className="rounded-md border px-3 py-2 text-xs"
								>
									<span className="font-semibold">
										{t('gameweek', { event: gameweek.eventId })}
									</span>
									<span className="ml-2 text-muted-foreground">
										{gameweek.bgw
											? 'BGW'
											: gameweek.fixtures
													.map(
														fixture =>
															`${fixture.opponentTeamShortName} ${fixture.wasHome ? t('homeShort') : t('awayShort')}`
													)
													.join(' · ')}
									</span>
									{gameweek.dgw ? (
										<Badge
											variant="secondary"
											className="ml-2 px-1.5 py-0 text-[10px]"
										>
											DGW
										</Badge>
									) : null}
								</div>
							))}
						</div>
					</section>
				) : null}

				<section
					className="rounded-lg border border-dashed p-4"
					aria-label={t('coverageTitle')}
				>
					<div className="flex items-start gap-3">
						{profile.coverage.limitations.length === 0 ? (
							<ShieldCheck
								className="mt-0.5 size-5 shrink-0 text-success"
								aria-hidden="true"
							/>
						) : (
							<Database
								className="mt-0.5 size-5 shrink-0 text-warning"
								aria-hidden="true"
							/>
						)}
						<div className="min-w-0">
							<h4 className="text-sm font-semibold">{t('coverageTitle')}</h4>
							<p className="mt-1 text-xs text-muted-foreground">
								{t('coverageSummary', {
									fpl: profile.coverage.fplHistorySeasons.length,
									understat: profile.coverage.understatHistorySeasons.length,
									mapping: t(MAPPING_KEYS[profile.coverage.mappingStatus])
								})}
							</p>
							{profile.coverage.limitations.length > 0 ? (
								<ul className="mt-3 space-y-1 text-xs text-muted-foreground">
									{profile.coverage.limitations.slice(0, 4).map(code => (
										<li key={code}>• {limitationLabel(code)}</li>
									))}
								</ul>
							) : (
								<p className="mt-2 text-xs text-success">
									{t('coverageComplete')}
								</p>
							)}
						</div>
					</div>
				</section>
			</div>
		</Card>
	)
}

export function PlayerStateTab({ player, comparison }: PlayerStateTabProps) {
	return (
		<div className={comparison ? 'grid gap-4 lg:grid-cols-2' : ''}>
			<ProfileCard {...player} />
			{comparison ? <ProfileCard {...comparison} /> : null}
		</div>
	)
}
