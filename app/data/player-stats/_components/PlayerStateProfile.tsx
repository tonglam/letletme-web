'use client'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type {
	PlayerDetailData,
	PlayerStateConfidence,
	PlayerStateDimension,
	PlayerStateDimensionKind,
	PlayerStateDimensionRating,
	PlayerStateDirection,
	PlayerStateMetric,
	PlayerStateProfileData,
	PlayerStateTrend
} from '@/lib/graphql/operations/players'
import { cn } from '@/lib/utils'
import { useFormatter, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { CompareRow, DIFFICULTY_COLORS } from './PlayerStatPrimitives'
import { PlayerStatsSection } from './PlayerStatsSection'

type PlayerStateTranslations = ReturnType<
	typeof useTranslations<'PlayerStats.playerState'>
>

const TREND_KEYS = {
	RISING: 'trend.rising',
	STABLE: 'trend.stable',
	FALLING: 'trend.falling',
	MIXED: 'trend.mixed',
	UNAVAILABLE: 'trend.unavailable',
	UNKNOWN: 'trend.unknown'
} as const satisfies Record<PlayerStateTrend, string>

const CONFIDENCE_KEYS = {
	HIGH: 'confidence.high',
	MEDIUM: 'confidence.medium',
	LOW: 'confidence.low'
} as const satisfies Record<PlayerStateConfidence, string>

const DIRECTION_KEYS = {
	RISING: 'direction.rising',
	STABLE: 'direction.stable',
	FALLING: 'direction.falling',
	UNKNOWN: 'direction.unknown'
} as const satisfies Record<PlayerStateDirection, string>

const RATING_KEYS = {
	SECURE: 'rating.secure',
	MANAGED: 'rating.managed',
	AT_RISK: 'rating.atRisk',
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
	TEAM_CONTEXT_ONLY: 'rating.teamContextOnly',
	UNAVAILABLE: 'rating.unavailable',
	UNKNOWN: 'rating.unknown'
} as const satisfies Record<PlayerStateDimensionRating, string>

const REASON_KEYS = {
	AVAILABILITY_UNAVAILABLE: 'reason.availabilityUnavailable',
	AVAILABILITY_DOUBTFUL: 'reason.availabilityDoubtful',
	AVAILABILITY_AVAILABLE: 'reason.availabilityAvailable',
	AVAILABILITY_UNKNOWN: 'reason.availabilityUnknown',
	ROLE_SECURE: 'reason.roleSecure',
	ROLE_MANAGED: 'reason.roleManaged',
	ROLE_AT_RISK: 'reason.roleAtRisk',
	ROLE_MINUTES_VOLATILE: 'reason.roleMinutesVolatile',
	ROLE_INSUFFICIENT_WINDOW: 'reason.roleInsufficientWindow',
	ROLE_IMPROVING: 'reason.roleImproving',
	ROLE_DECLINING: 'reason.roleDeclining',
	OUTPUT_STRONG: 'reason.outputStrong',
	OUTPUT_TYPICAL: 'reason.outputTypical',
	OUTPUT_WEAK: 'reason.outputWeak',
	OUTPUT_INSUFFICIENT: 'reason.outputInsufficient',
	OUTPUT_RISING: 'reason.outputRising',
	OUTPUT_FALLING: 'reason.outputFalling',
	OUTPUT_STABLE: 'reason.outputStable',
	PROCESS_UNAVAILABLE_UNDERSTAT: 'reason.processUnavailableUnderstat',
	PROCESS_METRIC_CAPABILITY_UNAVAILABLE:
		'reason.processMetricCapabilityUnavailable',
	PROCESS_GKP_TEAM_CONTEXT_ONLY: 'reason.processGkpTeamContextOnly',
	HISTORY_PROVEN: 'reason.historyProven',
	HISTORY_VARIABLE: 'reason.historyVariable',
	HISTORY_EMERGING: 'reason.historyEmerging',
	HISTORY_INSUFFICIENT: 'reason.historyInsufficient',
	OUTLOOK_FAVOURABLE: 'reason.outlookFavourable',
	OUTLOOK_DIFFICULT: 'reason.outlookDifficult',
	OUTLOOK_NEUTRAL: 'reason.outlookNeutral',
	OUTLOOK_DGW: 'reason.outlookDgw',
	OUTLOOK_BGW: 'reason.outlookBgw',
	OUTPUT_UP_PROCESS_DOWN: 'reason.outputUpProcessDown',
	OUTPUT_DOWN_PROCESS_UP: 'reason.outputDownProcessUp',
	ROLE_PERFORMANCE_CONFLICT: 'reason.rolePerformanceConflict',
	OUTPUT_PROCESS_UP: 'reason.outputProcessUp',
	OUTPUT_PROCESS_DOWN: 'reason.outputProcessDown',
	SIGNALS_STABLE: 'reason.signalsStable',
	ROLE_OUTPUT_CONFLICT: 'reason.roleOutputConflict',
	FPL_OUTPUT_UP: 'reason.fplOutputUp',
	FPL_OUTPUT_DOWN: 'reason.fplOutputDown',
	FPL_SIGNALS_STABLE: 'reason.fplSignalsStable',
	CURRENT_FPL_INSUFFICIENT: 'reason.currentFplInsufficient',
	TREND_WITHHELD_BACKTEST: 'reason.trendWithheldBacktest',
	TREND_WITHHELD_CROSS_PROVIDER_BACKTEST:
		'reason.trendWithheldCrossProviderBacktest',
	FPL_ONLY: 'reason.fplOnly',
	SMALL_SAMPLE: 'reason.smallSample'
} as const

const METRIC_KEYS = {
	FPL_POINTS_PER_90: 'metric.pointsPer90',
	FPL_RETURN_RATE: 'metric.returnRate',
	FPL_BONUS_PER_90: 'metric.bonusPer90',
	FPL_OUTPUT_PERCENTILE: 'metric.outputPercentile',
	ROLE_STARTS_LAST_5: 'metric.startsLastFive',
	ROLE_MEDIAN_STARTER_MINUTES: 'metric.medianStarterMinutes',
	AVAILABILITY_CHANCE: 'metric.availabilityChance',
	OWN_BASELINE_PERCENTILE: 'metric.ownBaselinePercentile',
	OUTLOOK_AVERAGE_FDR: 'metric.averageFdr',
	OUTLOOK_DGW_COUNT: 'metric.dgwCount',
	OUTLOOK_BGW_COUNT: 'metric.bgwCount'
} as const

const MAPPING_KEYS = {
	VERIFIED: 'coverage.mappingVerified',
	UNVERIFIED: 'coverage.mappingUnverified',
	AMBIGUOUS: 'coverage.mappingAmbiguous',
	QUARANTINED: 'coverage.mappingQuarantined',
	UNAVAILABLE: 'coverage.mappingUnavailable'
} as const

const LIMITATION_KEYS = {
	CURRENT_FPL_INSUFFICIENT: 'limitation.currentFplInsufficient',
	EARLY_SEASON_SAMPLE: 'limitation.earlySeasonSample',
	UNDERSTAT_SEASON_UNAVAILABLE: 'limitation.understatSeasonUnavailable',
	PLAYER_MAPPING_UNAVAILABLE: 'limitation.mappingUnavailable',
	PLAYER_MAPPING_UNVERIFIED: 'limitation.mappingUnverified',
	PLAYER_MAPPING_AMBIGUOUS: 'limitation.mappingAmbiguous',
	PLAYER_MAPPING_QUARANTINED: 'limitation.mappingQuarantined',
	GKP_PERSONAL_PROCESS_UNAVAILABLE: 'limitation.gkpProcessUnavailable',
	REAL_WORLD_PROCESS_UNAVAILABLE: 'limitation.processUnavailable',
	HISTORICAL_UNDERSTAT_UNAVAILABLE: 'limitation.historicalUnderstatUnavailable',
	FPL_HISTORY_STORAGE_UNAVAILABLE: 'limitation.fplHistoryStorageUnavailable',
	FPL_HISTORY_ARCHIVE_INCOMPLETE: 'limitation.fplHistoryArchiveIncomplete',
	OLD_FPL_EXPECTED_METRICS_MASKED: 'limitation.oldExpectedMetricsMasked',
	FPL_SEASON_AUTHORITY_MISMATCH: 'limitation.fplSeasonAuthorityMismatch',
	FPL_CORE_REVISION_UNAVAILABLE: 'limitation.fplCoreRevisionUnavailable',
	TREND_WITHHELD_BACKTEST: 'limitation.trendWithheldBacktest',
	TREND_WITHHELD_CROSS_PROVIDER_BACKTEST: 'limitation.crossProviderBacktest'
} as const

function profileDimension(
	profile: PlayerStateProfileData,
	kind: PlayerStateDimensionKind
): PlayerStateDimension | null {
	return profile.dimensions.find(dimension => dimension.kind === kind) ?? null
}

function dimensionMetric(
	dimension: PlayerStateDimension | null,
	code: string
): PlayerStateMetric | null {
	return dimension?.metrics.find(metric => metric.code === code) ?? null
}

function seasonLabel(season: string): string {
	if (!/^\d{4}$/.test(season)) return season
	return `20${season.slice(0, 2)}/${season.slice(2)}`
}

function StateSection({
	id,
	title,
	hint,
	children
}: {
	id?: string
	title: string
	hint?: string
	children: ReactNode
}) {
	return (
		<PlayerStatsSection
			id={id}
			title={title}
			hint={hint}
		>
			{children}
		</PlayerStatsSection>
	)
}

function formatMetricValue(
	metric: PlayerStateMetric | null,
	format: ReturnType<typeof useFormatter>
): string | null {
	if (!metric || metric.value == null) return null
	switch (metric.unit) {
		case 'percent':
			return `${format.number(metric.value, { maximumFractionDigits: 1 })}%`
		case 'percentile':
			return format.number(metric.value, { maximumFractionDigits: 1 })
		case 'per90':
			return format.number(metric.value, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			})
		case 'fdr':
			return format.number(metric.value, { maximumFractionDigits: 2 })
		default:
			return format.number(metric.value, { maximumFractionDigits: 1 })
	}
}

function metricLabel(code: string, t: PlayerStateTranslations): string {
	const key = METRIC_KEYS[code as keyof typeof METRIC_KEYS]
	return key ? t(key) : code
}

function reasonLabel(code: string, t: PlayerStateTranslations): string {
	const key = REASON_KEYS[code as keyof typeof REASON_KEYS]
	return key ? t(key) : t('reason.evidenceUnavailable')
}

function limitationLabel(code: string, t: PlayerStateTranslations): string {
	const key = LIMITATION_KEYS[code as keyof typeof LIMITATION_KEYS]
	return key ? t(key) : t('limitation.evidenceUnavailable')
}

function CoverageCard({
	name,
	profile,
	compact,
	t
}: {
	name: string
	profile: PlayerStateProfileData | null
	compact: boolean
	t: PlayerStateTranslations
}) {
	const format = useFormatter()
	if (!profile) {
		return (
			<div className="rounded-lg border border-border/60 px-3 py-3">
				<p className="truncate text-xs font-semibold">{name}</p>
				<p className="mt-1 text-xs text-muted-foreground">
					{t('coverage.unavailable')}
				</p>
			</div>
		)
	}

	const limitations = Array.from(new Set(profile.coverage.limitations))
	const asOfDate = new Date(profile.asOf)
	const asOfLabel = Number.isNaN(asOfDate.getTime())
		? profile.asOf
		: format.dateTime(asOfDate, {
				dateStyle: 'medium',
				timeStyle: 'short'
			})

	return (
		<div className="rounded-lg border border-border/60 px-3 py-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="truncate text-xs font-semibold">{name}</p>
				<p className="text-[11px] text-muted-foreground">
					{profile.asOfEventId != null
						? t('coverage.asOfEvent', {
								season: seasonLabel(profile.season),
								gameweek: profile.asOfEventId
							})
						: t('coverage.asOfSeason', {
								season: seasonLabel(profile.season)
							})}
				</p>
			</div>
			<div className="mt-2 flex flex-wrap gap-1.5">
				<Badge
					variant="outline"
					className="text-[10px]"
				>
					{t('coverage.fplCurrent', {
						status: profile.coverage.fplCurrent
							? t('coverage.available')
							: t('coverage.unavailableShort')
					})}
				</Badge>
				<Badge
					variant="outline"
					className="text-[10px]"
				>
					{t('coverage.understatCurrent', {
						status: profile.coverage.understatCurrent
							? t('coverage.available')
							: t('coverage.unavailableShort')
					})}
				</Badge>
				<Badge
					variant="secondary"
					className="text-[10px]"
				>
					{t(MAPPING_KEYS[profile.coverage.mappingStatus])}
				</Badge>
			</div>

			<p className="mt-2 text-[11px] text-muted-foreground">
				{t('coverage.summary', {
					fplHistory: profile.coverage.fplHistorySeasons.length,
					understatHistory: profile.coverage.understatHistorySeasons.length,
					metrics: profile.coverage.metricCoverage.length,
					asOf: asOfLabel
				})}
			</p>

			{profile.coverage.providers.length > 0 && !compact ? (
				<div className="mt-2 space-y-1 border-t border-border/50 pt-2">
					{profile.coverage.providers.map(provider => {
						const providerDate = provider.asOf ? new Date(provider.asOf) : null
						const providerAsOf =
							providerDate && !Number.isNaN(providerDate.getTime())
								? format.dateTime(providerDate, {
										dateStyle: 'short',
										timeStyle: 'short'
									})
								: (provider.asOf ?? '—')
						const freshness =
							provider.freshnessSeconds == null
								? '—'
								: t('coverage.freshnessSeconds', {
										seconds: provider.freshnessSeconds
									})
						return (
							<p
								key={`${provider.provider}-${provider.scope}-${provider.season}`}
								className="text-[11px] text-muted-foreground"
							>
								{t('coverage.providerRevision', {
									provider: provider.provider,
									scope: provider.scope.toLowerCase(),
									season: seasonLabel(provider.season),
									revision: provider.revision ?? '—',
									asOf: providerAsOf,
									freshness,
									status: provider.available
										? provider.stale
											? t('coverage.stale')
											: t('coverage.fresh')
										: t('coverage.unavailableShort')
								})}
							</p>
						)
					})}
					<p className="text-[11px] text-muted-foreground">
						{t('coverage.historySeasons', {
							fpl: profile.coverage.fplHistorySeasons.length
								? profile.coverage.fplHistorySeasons.map(seasonLabel).join(', ')
								: '—',
							understat: profile.coverage.understatHistorySeasons.length
								? profile.coverage.understatHistorySeasons
										.map(seasonLabel)
										.join(', ')
								: '—'
						})}
					</p>
					<p className="text-[11px] text-muted-foreground">
						{t('coverage.metrics', {
							metrics: profile.coverage.metricCoverage.join(', ') || '—'
						})}
					</p>
				</div>
			) : null}

			{limitations.length > 0 ? (
				<details className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
					<summary className="cursor-pointer font-medium text-foreground/80">
						{t('coverage.limitations', { count: limitations.length })}
					</summary>
					<ul className="mt-1.5 space-y-1">
						{(compact ? limitations.slice(0, 1) : limitations).map(code => (
							<li
								key={code}
								title={code}
								className="flex gap-2"
							>
								<span aria-hidden="true">•</span>
								<span>{limitationLabel(code, t)}</span>
							</li>
						))}
					</ul>
				</details>
			) : null}
		</div>
	)
}

function CoverageSummary({
	player,
	comparison,
	profile,
	comparisonProfile,
	compact,
	t
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData | null
	comparisonProfile: PlayerStateProfileData | null
	compact: boolean
	t: PlayerStateTranslations
}) {
	return (
		<div className={cn('grid gap-2', comparison && 'sm:grid-cols-2')}>
			<CoverageCard
				name={player.webName}
				profile={profile}
				compact={compact}
				t={t}
			/>
			{comparison ? (
				<CoverageCard
					name={comparison.webName}
					profile={comparisonProfile}
					compact={compact}
					t={t}
				/>
			) : null}
		</div>
	)
}

function RatingLine({
	dimension,
	t
}: {
	dimension: PlayerStateDimension | null
	t: PlayerStateTranslations
}) {
	if (!dimension) return <span>—</span>
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Badge variant="outline">{t(RATING_KEYS[dimension.rating])}</Badge>
			<span className="text-xs text-muted-foreground">
				{t(DIRECTION_KEYS[dimension.direction])}
			</span>
		</div>
	)
}

function StateColumn({
	name,
	profile,
	t
}: {
	name: string
	profile: PlayerStateProfileData
	t: PlayerStateTranslations
}) {
	return (
		<div className="min-w-0 rounded-lg border border-border/60 bg-card/50 px-3 py-3">
			<p className="truncate font-display text-sm font-bold uppercase tracking-wide">
				{name}
			</p>
			<div className="mt-2 flex flex-wrap items-center gap-2">
				<Badge variant="outline">{t(TREND_KEYS[profile.trend])}</Badge>
				<span className="text-xs text-muted-foreground">
					{t('confidenceLabel', {
						confidence: t(CONFIDENCE_KEYS[profile.confidence])
					})}
				</span>
				{profile.fplOnly ? (
					<Badge variant="secondary">{t('fplOnly')}</Badge>
				) : null}
			</div>
			<ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
				{profile.reasons.slice(0, 3).map(reason => (
					<li
						key={reason.code}
						className="flex gap-2"
						title={reason.code}
					>
						<span aria-hidden="true">•</span>
						<span>{reasonLabel(reason.code, t)}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

function SignalCard({
	title,
	dimension,
	t
}: {
	title: string
	dimension: PlayerStateDimension | null
	t: PlayerStateTranslations
}) {
	return (
		<div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3">
			<p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
				{title}
			</p>
			<div className="mt-2">
				<RatingLine
					dimension={dimension}
					t={t}
				/>
			</div>
			{dimension?.reasonCodes[0] ? (
				<p
					className="mt-2 text-xs leading-5 text-muted-foreground"
					title={dimension.reasonCodes[0]}
				>
					{reasonLabel(dimension.reasonCodes[0], t)}
				</p>
			) : null}
		</div>
	)
}

function OutputProcess({
	player,
	comparison,
	profile,
	comparisonProfile,
	t
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData
	comparisonProfile: PlayerStateProfileData | null
	t: PlayerStateTranslations
}) {
	const format = useFormatter()
	const firstOutput = profileDimension(profile, 'FPL_OUTPUT')
	const firstProcess = profileDimension(profile, 'REAL_WORLD_PROCESS')
	const secondOutput = comparisonProfile
		? profileDimension(comparisonProfile, 'FPL_OUTPUT')
		: null
	const secondProcess = comparisonProfile
		? profileDimension(comparisonProfile, 'REAL_WORLD_PROCESS')
		: null
	const samePosition = Boolean(
		comparison && comparison.elementType === player.elementType
	)
	const rawCodes = samePosition
		? ['FPL_POINTS_PER_90', 'FPL_RETURN_RATE', 'FPL_BONUS_PER_90']
		: ['FPL_OUTPUT_PERCENTILE']

	return (
		<StateSection
			title={t('outputProcessTitle')}
			hint={t('outputProcessHint')}
		>
			<div className="grid gap-3 sm:grid-cols-2">
				{comparisonProfile ? (
					<>
						<div className="space-y-2">
							<p className="truncate text-xs font-semibold text-muted-foreground">
								{player.webName}
							</p>
							<div className="grid grid-cols-2 gap-2">
								<SignalCard
									title={t('fplOutput')}
									dimension={firstOutput}
									t={t}
								/>
								<SignalCard
									title={t('realWorldProcess')}
									dimension={firstProcess}
									t={t}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<p className="truncate text-xs font-semibold text-muted-foreground">
								{comparison?.webName}
							</p>
							<div className="grid grid-cols-2 gap-2">
								<SignalCard
									title={t('fplOutput')}
									dimension={secondOutput}
									t={t}
								/>
								<SignalCard
									title={t('realWorldProcess')}
									dimension={secondProcess}
									t={t}
								/>
							</div>
						</div>
					</>
				) : (
					<>
						<SignalCard
							title={t('fplOutput')}
							dimension={firstOutput}
							t={t}
						/>
						<SignalCard
							title={t('realWorldProcess')}
							dimension={firstProcess}
							t={t}
						/>
					</>
				)}
			</div>

			{comparisonProfile ? (
				<div className="mt-3 space-y-0.5">
					{rawCodes.map(code => {
						const first = dimensionMetric(firstOutput, code)
						const second = dimensionMetric(secondOutput, code)
						return (
							<CompareRow
								key={code}
								label={metricLabel(code, t)}
								primaryValue={formatMetricValue(first, format)}
								comparisonValue={formatMetricValue(second, format)}
								emphasizeWinner={samePosition}
							/>
						)
					})}
				</div>
			) : (
				<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
					{rawCodes.map(code => {
						const item = dimensionMetric(firstOutput, code)
						return (
							<div
								key={code}
								className="rounded-md border border-border/60 px-2.5 py-2"
							>
								<p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
									{metricLabel(code, t)}
								</p>
								<p className="mt-0.5 font-display text-lg font-bold tabular-nums">
									{formatMetricValue(item, format) ?? '—'}
								</p>
							</div>
						)
					})}
				</div>
			)}
		</StateSection>
	)
}

function AvailabilityRole({
	profile,
	comparisonProfile,
	t
}: {
	profile: PlayerStateProfileData
	comparisonProfile: PlayerStateProfileData | null
	t: PlayerStateTranslations
}) {
	const format = useFormatter()
	const first = profileDimension(profile, 'AVAILABILITY_ROLE')
	const second = comparisonProfile
		? profileDimension(comparisonProfile, 'AVAILABILITY_ROLE')
		: null
	const codes = [
		'ROLE_STARTS_LAST_5',
		'ROLE_MEDIAN_STARTER_MINUTES',
		'AVAILABILITY_CHANCE'
	]

	return (
		<StateSection
			title={t('availabilityRoleTitle')}
			hint={t('availabilityRoleHint')}
		>
			<div className={cn('grid gap-3', comparisonProfile && 'sm:grid-cols-2')}>
				<div className="rounded-lg border border-border/60 px-3 py-3">
					<RatingLine
						dimension={first}
						t={t}
					/>
					<p className="mt-2 text-xs text-muted-foreground">
						{first?.reasonCodes.map(code => reasonLabel(code, t)).join(' · ') ??
							'—'}
					</p>
				</div>
				{comparisonProfile ? (
					<div className="rounded-lg border border-border/60 px-3 py-3">
						<RatingLine
							dimension={second}
							t={t}
						/>
						<p className="mt-2 text-xs text-muted-foreground">
							{second?.reasonCodes
								.map(code => reasonLabel(code, t))
								.join(' · ') ?? '—'}
						</p>
					</div>
				) : null}
			</div>

			<div className="mt-3 space-y-0.5">
				{codes.map(code => {
					const firstMetric = dimensionMetric(first, code)
					const secondMetric = dimensionMetric(second, code)
					return comparisonProfile ? (
						<CompareRow
							key={code}
							label={metricLabel(code, t)}
							primaryValue={formatMetricValue(firstMetric, format)}
							comparisonValue={formatMetricValue(secondMetric, format)}
							emphasizeWinner={false}
						/>
					) : (
						<div
							key={code}
							className="flex items-center justify-between border-b border-border/60 py-2.5 text-sm last:border-0"
						>
							<span className="text-muted-foreground">
								{metricLabel(code, t)}
							</span>
							<span className="font-semibold tabular-nums">
								{formatMetricValue(firstMetric, format) ?? '—'}
							</span>
						</div>
					)
				})}
			</div>
		</StateSection>
	)
}

function OutlookStrip({
	profile,
	name,
	t
}: {
	profile: PlayerStateProfileData
	name?: string
	t: PlayerStateTranslations
}) {
	return (
		<div className="min-w-0 rounded-lg border border-border/60 px-3 py-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				{name ? (
					<p className="truncate text-xs font-semibold">{name}</p>
				) : (
					<span />
				)}
				<Badge variant="outline">
					{t(RATING_KEYS[profile.outlook.rating])}
				</Badge>
			</div>
			<div className="mt-3 grid grid-cols-5 gap-1.5">
				{profile.outlook.gameweeks.map(gameweek => (
					<div
						key={gameweek.eventId}
						className="min-w-0 rounded-md border border-border/60 px-1.5 py-2 text-center"
					>
						<p className="font-display text-[10px] font-semibold text-muted-foreground">
							GW{gameweek.eventId}
						</p>
						{gameweek.bgw ? (
							<p className="mt-1 text-xs font-semibold">BGW</p>
						) : (
							<div className="mt-1 space-y-1">
								{gameweek.fixtures.map(fixture => (
									<div
										key={fixture.id}
										className="flex min-w-0 items-center justify-center gap-1"
									>
										<span className="truncate text-xs font-semibold">
											{fixture.opponentTeamShortName}
										</span>
										<span
											className={cn(
												'inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-[9px] font-bold text-white',
												DIFFICULTY_COLORS[fixture.difficulty] ?? 'bg-muted'
											)}
										>
											{fixture.difficulty || '—'}
										</span>
									</div>
								))}
							</div>
						)}
						{gameweek.dgw ? (
							<p className="mt-1 text-[9px] font-semibold text-muted-foreground">
								DGW
							</p>
						) : null}
					</div>
				))}
			</div>
		</div>
	)
}

function Outlook({
	player,
	comparison,
	profile,
	comparisonProfile,
	t
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData
	comparisonProfile: PlayerStateProfileData | null
	t: PlayerStateTranslations
}) {
	const shared = Boolean(
		comparisonProfile && profile.teamId === comparisonProfile.teamId
	)
	return (
		<StateSection
			title={t('outlookTitle', { horizon: profile.horizon })}
			hint={t('outlookHint')}
		>
			<div
				className={cn(
					'grid gap-3',
					comparisonProfile && !shared && 'lg:grid-cols-2'
				)}
			>
				<OutlookStrip
					profile={profile}
					name={
						shared
							? t('sharedTeamOutlook', { team: player.teamShortName })
							: comparisonProfile
								? player.webName
								: undefined
					}
					t={t}
				/>
				{comparisonProfile && !shared ? (
					<OutlookStrip
						profile={comparisonProfile}
						name={comparison?.webName}
						t={t}
					/>
				) : null}
			</div>
		</StateSection>
	)
}

function Baseline({
	profile,
	comparisonProfile,
	t
}: {
	profile: PlayerStateProfileData
	comparisonProfile: PlayerStateProfileData | null
	t: PlayerStateTranslations
}) {
	const format = useFormatter()
	const firstReliability = profileDimension(profile, 'HISTORICAL_RELIABILITY')
	const secondReliability = comparisonProfile
		? profileDimension(comparisonProfile, 'HISTORICAL_RELIABILITY')
		: null
	const number = (value: number | null) =>
		value == null ? null : format.number(value, { maximumFractionDigits: 1 })
	const historyStorageUnavailable = profile.coverage.limitations.some(code =>
		[
			'FPL_HISTORY_STORAGE_UNAVAILABLE',
			'FPL_HISTORY_ARCHIVE_INCOMPLETE'
		].includes(code)
	)

	return (
		<StateSection
			title={t('baselineTitle')}
			hint={t('baselineHint', { minutes: profile.peerBaseline.minimumMinutes })}
		>
			{comparisonProfile ? (
				<div className="space-y-0.5">
					<CompareRow
						label={t('metric.outputPercentile')}
						primaryValue={number(profile.peerBaseline.currentPercentile)}
						comparisonValue={number(
							comparisonProfile.peerBaseline.currentPercentile
						)}
						emphasizeWinner={profile.position === comparisonProfile.position}
					/>
					<CompareRow
						label={t('metric.ownBaselinePercentile')}
						primaryValue={number(profile.ownBaseline.weightedPercentile)}
						comparisonValue={number(
							comparisonProfile.ownBaseline.weightedPercentile
						)}
						emphasizeWinner={profile.position === comparisonProfile.position}
					/>
					<CompareRow
						label={t('reliability')}
						primaryValue={
							firstReliability ? t(RATING_KEYS[firstReliability.rating]) : null
						}
						comparisonValue={
							secondReliability
								? t(RATING_KEYS[secondReliability.rating])
								: null
						}
						emphasizeWinner={false}
					/>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
					{[
						{
							label: t('metric.outputPercentile'),
							value: number(profile.peerBaseline.currentPercentile)
						},
						{
							label: t('metric.ownBaselinePercentile'),
							value: number(profile.ownBaseline.weightedPercentile)
						},
						{
							label: t('reliability'),
							value: firstReliability
								? t(RATING_KEYS[firstReliability.rating])
								: null
						}
					].map(item => (
						<div
							key={item.label}
							className="rounded-lg border border-border/60 px-3 py-3"
						>
							<p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
								{item.label}
							</p>
							<p className="mt-1 font-display text-lg font-bold tabular-nums">
								{item.value ?? '—'}
							</p>
						</div>
					))}
				</div>
			)}

			<div
				className={cn('mt-3 grid gap-3', comparisonProfile && 'sm:grid-cols-2')}
			>
				{[profile, ...(comparisonProfile ? [comparisonProfile] : [])].map(
					(item, columnIndex) => (
						<div
							key={`${item.playerId}-${columnIndex}`}
							className="rounded-lg border border-border/60 px-3 py-2"
						>
							{item.ownBaseline.seasons.length === 0 ? (
								<p className="py-2 text-sm text-muted-foreground">
									{historyStorageUnavailable
										? t('historyStorageUnavailable')
										: t('baselineEmpty')}
								</p>
							) : (
								item.ownBaseline.seasons.map(season => (
									<div
										key={season.season}
										className="flex items-center justify-between border-b border-border/50 py-2 text-sm last:border-0"
									>
										<span>{seasonLabel(season.season)}</span>
										<span className="text-muted-foreground">
											{number(season.positionPercentile) ?? '—'} ·{' '}
											{format.number(season.weight * 100, {
												maximumFractionDigits: 0
											})}
											%
										</span>
									</div>
								))
							)}
						</div>
					)
				)}
			</div>
		</StateSection>
	)
}

function CareerTrajectory({
	player,
	comparison,
	profile,
	comparisonProfile,
	t
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData
	comparisonProfile: PlayerStateProfileData | null
	t: PlayerStateTranslations
}) {
	const format = useFormatter()
	const seasons = Array.from(
		new Set([
			...profile.careerTrajectory.map(point => point.season),
			...(comparisonProfile?.careerTrajectory.map(point => point.season) ?? [])
		])
	).sort()
	const firstBySeason = new Map(
		profile.careerTrajectory.map(point => [point.season, point])
	)
	const secondBySeason = new Map(
		comparisonProfile?.careerTrajectory.map(point => [point.season, point]) ??
			[]
	)
	const hasProcess = [profile, comparisonProfile]
		.filter((item): item is PlayerStateProfileData => item !== null)
		.some(item =>
			item.careerTrajectory.some(
				point => point.understatProcessPercentile !== null
			)
		)
	const number = (value: number | null) =>
		value == null ? '—' : format.number(value, { maximumFractionDigits: 1 })
	const historyStorageUnavailable = profile.coverage.limitations.some(code =>
		[
			'FPL_HISTORY_STORAGE_UNAVAILABLE',
			'FPL_HISTORY_ARCHIVE_INCOMPLETE'
		].includes(code)
	)

	return (
		<StateSection
			title={t('careerTitle')}
			hint={t('careerHint')}
		>
			{seasons.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{historyStorageUnavailable
						? t('historyStorageUnavailable')
						: t('careerEmpty')}
				</p>
			) : (
				<div className="overflow-x-auto rounded-lg border border-border/60">
					<table className="w-full min-w-[34rem] text-sm">
						<thead className="bg-muted/30 text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
							<tr>
								<th className="px-3 py-2 font-semibold">{t('season')}</th>
								<th className="px-3 py-2 text-right font-semibold">
									{player.webName} · {t('fplPercentile')}
								</th>
								{comparisonProfile ? (
									<th className="px-3 py-2 text-right font-semibold">
										{comparison?.webName} · {t('fplPercentile')}
									</th>
								) : null}
								{hasProcess ? (
									<th className="px-3 py-2 text-right font-semibold">
										{t('processPercentile')}
									</th>
								) : null}
							</tr>
						</thead>
						<tbody>
							{seasons.map(season => {
								const first = firstBySeason.get(season)
								const second = secondBySeason.get(season)
								return (
									<tr
										key={season}
										className="border-t border-border/60"
									>
										<td className="px-3 py-2.5 font-medium">
											{seasonLabel(season)}
										</td>
										<td className="px-3 py-2.5 text-right tabular-nums">
											{number(first?.fplPositionPercentile ?? null)}
										</td>
										{comparisonProfile ? (
											<td className="px-3 py-2.5 text-right tabular-nums">
												{number(second?.fplPositionPercentile ?? null)}
											</td>
										) : null}
										{hasProcess ? (
											<td className="px-3 py-2.5 text-right tabular-nums">
												{number(first?.understatProcessPercentile ?? null)}
											</td>
										) : null}
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}
			{!hasProcess ? (
				<p className="mt-2 text-xs text-muted-foreground">
					{t('careerProcessUnavailable')}
				</p>
			) : null}
		</StateSection>
	)
}

function StateReasonList({
	profile,
	t
}: {
	profile: PlayerStateProfileData
	t: PlayerStateTranslations
}) {
	return (
		<ul className="space-y-1.5 text-sm text-muted-foreground">
			{profile.reasons.slice(0, 3).map(reason => (
				<li
					key={reason.code}
					className="flex gap-2"
					title={reason.code}
				>
					<span aria-hidden="true">•</span>
					<span>{reasonLabel(reason.code, t)}</span>
				</li>
			))}
		</ul>
	)
}

function StateSummaryColumn({
	name,
	profile,
	t
}: {
	name: string
	profile: PlayerStateProfileData
	t: PlayerStateTranslations
}) {
	return (
		<div className="min-w-0 rounded-lg border border-border/60 bg-card/50 px-3 py-3">
			<p className="truncate font-display text-sm font-bold uppercase tracking-wide">
				{name}
			</p>
			<div className="mt-2 flex flex-wrap items-center gap-2">
				<Badge variant="outline">{t(TREND_KEYS[profile.trend])}</Badge>
				<span className="text-xs text-muted-foreground">
					{t('confidenceLabel', {
						confidence: t(CONFIDENCE_KEYS[profile.confidence])
					})}
				</span>
				{profile.fplOnly ? (
					<Badge variant="secondary">{t('fplOnly')}</Badge>
				) : null}
			</div>
			<div className="mt-3">
				<StateReasonList
					profile={profile}
					t={t}
				/>
			</div>
		</div>
	)
}

function WhyState({
	player,
	comparison,
	profile,
	comparisonProfile,
	t
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData
	comparisonProfile: PlayerStateProfileData | null
	t: PlayerStateTranslations
}) {
	const items = [
		{ title: t('availabilityRoleTitle'), kind: 'AVAILABILITY_ROLE' as const },
		{ title: t('outputProcessTitle'), kind: 'FPL_OUTPUT' as const },
		{
			title: t('outlookTitle', { horizon: profile.horizon }),
			kind: 'OUTLOOK' as const
		}
	]
	return (
		<details className="mt-3 rounded-lg border border-border/60 px-3 py-2">
			<summary className="cursor-pointer text-sm font-semibold text-foreground">
				{t('whyState')}
			</summary>
			<div className="mt-3 grid gap-2 sm:grid-cols-3">
				{items.map(item => {
					const first = profileDimension(profile, item.kind)
					const second = comparisonProfile
						? profileDimension(comparisonProfile, item.kind)
						: null
					return (
						<div
							key={item.kind}
							className="rounded-md border border-border/60 bg-muted/10 px-2.5 py-2"
						>
							<p className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
								{item.title}
							</p>
							<div className="mt-1 flex flex-wrap items-center gap-1.5">
								<Badge variant="outline">
									{first ? t(RATING_KEYS[first.rating]) : '—'}
								</Badge>
								{second ? (
									<Badge variant="outline">
										{t(RATING_KEYS[second.rating])}
									</Badge>
								) : null}
							</div>
							<p className="mt-1.5 text-xs leading-5 text-muted-foreground">
								{reasonLabel(
									first?.reasonCodes[0] ?? 'EVIDENCE_UNAVAILABLE',
									t
								)}
							</p>
						</div>
					)
				})}
			</div>
			<p className="mt-2 text-[11px] text-muted-foreground">
				{t('whyStateHint')}
			</p>
		</details>
	)
}

export function PlayerStateProfile({
	player,
	comparison,
	profile,
	comparisonProfile,
	seasonStatsAvailable,
	isLoading,
	isComparisonLoading,
	error,
	comparisonError
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData | null
	comparisonProfile: PlayerStateProfileData | null
	seasonStatsAvailable: boolean
	isLoading: boolean
	isComparisonLoading: boolean
	error: string | null
	comparisonError: string | null
}) {
	const t = useTranslations('PlayerStats.playerState')

	if (!seasonStatsAvailable) {
		return (
			<PlayerStatsSection
				id="ps-state"
				title={t('notRatedTitle')}
				hint={t('notRatedHint')}
			>
				<p className="rounded-lg border border-border/60 px-3 py-3 text-sm text-muted-foreground">
					{t('notRatedHint')}
				</p>
			</PlayerStatsSection>
		)
	}

	if (isLoading || (comparison && isComparisonLoading)) {
		return (
			<PlayerStatsSection
				id="ps-state"
				title={t('title')}
				hint={t('hint')}
			>
				<Skeleton className="h-28 w-full rounded-lg" />
			</PlayerStatsSection>
		)
	}

	if (!profile) {
		return (
			<PlayerStatsSection
				id="ps-state"
				title={t('title')}
				hint={t('hint')}
			>
				<p className="rounded-lg border border-border/60 px-4 py-4 text-sm text-muted-foreground">
					{error ?? comparisonError ?? t('unavailable')}
				</p>
			</PlayerStatsSection>
		)
	}

	return (
		<PlayerStatsSection
			id="ps-state"
			title={t('title')}
			hint={t('hint')}
		>
			<div className={cn('grid gap-3', comparisonProfile && 'sm:grid-cols-2')}>
				<StateSummaryColumn
					name={player.webName}
					profile={profile}
					t={t}
				/>
				{comparison && comparisonProfile ? (
					<StateSummaryColumn
						name={comparison.webName}
						profile={comparisonProfile}
						t={t}
					/>
				) : null}
			</div>
			{comparison && !comparisonProfile ? (
				<p className="mt-3 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
					{comparisonError ?? t('comparisonUnavailable')}
				</p>
			) : null}
			<WhyState
				player={player}
				comparison={comparison}
				profile={profile}
				comparisonProfile={comparisonProfile}
				t={t}
			/>
		</PlayerStatsSection>
	)
}

/** Supporting data is deliberately separate from the State summary so history
 * and provider metadata stay behind the disclosure. */
export function PlayerStateContext({
	player,
	comparison,
	profile,
	comparisonProfile
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData | null
	comparisonProfile: PlayerStateProfileData | null
}) {
	const t = useTranslations('PlayerStats.playerState')
	if (!profile) {
		return (
			<p className="text-sm text-muted-foreground">
				{t('historyCoverageUnavailable')}
			</p>
		)
	}
	const hasHistory = [profile, comparisonProfile]
		.filter((item): item is PlayerStateProfileData => item !== null)
		.some(
			item =>
				item.ownBaseline.seasons.length > 0 || item.careerTrajectory.length > 0
		)
	return (
		<div className="space-y-1">
			<div id="ps-history">
				{hasHistory ? (
					<>
						<Baseline
							profile={profile}
							comparisonProfile={comparisonProfile}
							t={t}
						/>
						<CareerTrajectory
							player={player}
							comparison={comparison}
							profile={profile}
							comparisonProfile={comparisonProfile}
							t={t}
						/>
					</>
				) : (
					<PlayerStatsSection title={t('historyCoverageTitle')}>
						<p className="rounded-lg border border-border/60 px-3 py-3 text-sm text-muted-foreground">
							{t('historyCoverageUnavailable')}
						</p>
					</PlayerStatsSection>
				)}
			</div>
			<PlayerStatsSection
				id="ps-coverage"
				title={t('coverageTitle')}
			>
				<CoverageSummary
					player={player}
					comparison={comparison}
					profile={profile}
					comparisonProfile={comparisonProfile}
					compact={false}
					t={t}
				/>
			</PlayerStatsSection>
		</div>
	)
}
