'use client'

import {
	playerStatsSectionFromHash,
	type PlayerStatsSectionId
} from '@/app/data/player-stats/_lib/player-stats-url'
import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'
import { Link } from '@/i18n/navigation'
import type {
	PlayerDetailData,
	PlayerStateMetric,
	PlayerStateProfileData
} from '@/lib/graphql/operations/players'
import { ChevronDown, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFormatter, useTranslations } from 'next-intl'
import {
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ReactNode
} from 'react'
import { PlayerFixturesTab } from './PlayerFixturesTab'
import { PlayerFplProfile } from './PlayerFplProfile'
import { PlayerOverallCard, StickyPlayerIdentity } from './PlayerOverallCard'
import { PlayerPriceHistoryBlock } from './PlayerPriceHistoryBlock'
import { PlayerRecentGameweeks } from './PlayerRecentGameweeks'
import { PlayerStateContext, PlayerStateProfile } from './PlayerStateProfile'
import type { PlayerEvidenceSection } from '../_hooks/usePlayerDetailSlot'
import {
	PlayerSectionNav,
	scrollToPlayerStatsSection
} from './PlayerSectionNav'
import { PlayerStatsSection } from './PlayerStatsSection'
import {
	CompareRow,
	IctBar,
	PlayerDetailSkeleton
} from './PlayerStatPrimitives'

interface PlayerStatsViewProps {
	selectedPlayer: PlayerDirectoryOption | null
	selectedComparison: PlayerDirectoryOption | null
	player: PlayerDetailData | null
	comparison: PlayerDetailData | null
	playerState: PlayerStateProfileData | null
	comparisonState: PlayerStateProfileData | null
	isLoading: boolean
	isComparisonLoading: boolean
	isStateLoading: boolean
	isComparisonStateLoading: boolean
	error: string | null
	comparisonError: string | null
	stateError: string | null
	comparisonStateError: string | null
	loadEvidence: (section: PlayerEvidenceSection) => Promise<void>
	loadComparisonEvidence: (section: PlayerEvidenceSection) => Promise<void>
	loadStateContext: () => Promise<void>
	loadComparisonStateContext: () => Promise<void>
	isEvidenceLoading: boolean
	isComparisonEvidenceLoading: boolean
	isStateContextLoading: boolean
	isComparisonStateContextLoading: boolean
	evidenceError: string | null
	comparisonEvidenceError: string | null
	stateContextError: string | null
	comparisonStateContextError: string | null
	anchorGw: number
	seasonStatsAvailable: boolean
}

type PlayerNumberKey = {
	[K in keyof PlayerDetailData]-?: NonNullable<
		PlayerDetailData[K]
	> extends number
		? K
		: never
}[keyof PlayerDetailData]

type MetricDirection = 'higher' | 'lower' | 'neutral'

type MetricSpec = {
	label: string
	key: PlayerNumberKey
	direction: MetricDirection
}

type DisplayMetric = {
	label: string
	value: string | number | null
}

function DeskSection({
	id,
	title,
	hint,
	children
}: {
	id: string
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

function MetricGrid({ items }: { items: DisplayMetric[] }) {
	return (
		<div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
			{items.map(item => (
				<div key={item.label}>
					<p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
						{item.label}
					</p>
					<p className="mt-0.5 font-display text-xl font-bold tabular-nums tracking-tight">
						{item.value ?? '—'}
					</p>
				</div>
			))}
		</div>
	)
}

function processMetricLabel(
	code: string,
	tl: ReturnType<typeof useTranslations>
): string {
	const labels: Record<string, string> = {
		UNDERSTAT_NPXG_PER_90: tl('expectedGoals'),
		UNDERSTAT_XG_PER_90: tl('expectedGoals'),
		UNDERSTAT_XA_PER_90: tl('expectedAssists'),
		UNDERSTAT_XGI_PER_90: tl('expectedGoalInvolvements'),
		UNDERSTAT_XGC_PER_90: tl('expectedGoalsConceded'),
		UNDERSTAT_SHOTS_KEY_PASSES_PER_90: tl('processShotsKeyPasses'),
		UNDERSTAT_TEAM_XG: tl('processTeamXg'),
		UNDERSTAT_TEAM_XGA: tl('processTeamXga'),
		FPL_EXPECTED_GOALS: tl('expectedGoals'),
		FPL_EXPECTED_ASSISTS: tl('expectedAssists'),
		FPL_EXPECTED_GOAL_INVOLVEMENTS: tl('expectedGoalInvolvements'),
		FPL_EXPECTED_GOALS_CONCEDED: tl('expectedGoalsConceded')
	}
	return (
		labels[code] ?? code.replace(/^(UNDERSTAT|FPL)_/, '').replaceAll('_', ' ')
	)
}

function processMetricValue(metric: PlayerStateMetric): string | number | null {
	if (metric.value == null) return null
	if (metric.unit === 'per90') return metric.value.toFixed(2)
	if (metric.unit === 'percentile') return Math.round(metric.value)
	if (metric.unit === 'percent') return `${metric.value}%`
	return metric.value
}

function ProcessSourceEvidence({
	player,
	comparison,
	playerState,
	comparisonState,
	samePosition,
	tl
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	playerState: PlayerStateProfileData | null
	comparisonState: PlayerStateProfileData | null
	samePosition: boolean
	tl: ReturnType<typeof useTranslations>
}) {
	const processMetrics = (profile: PlayerStateProfileData | null) =>
		profile?.dimensions
			.find(dimension => dimension.kind === 'REAL_WORLD_PROCESS')
			?.metrics.filter(metric => metric.source === 'UNDERSTAT_CURRENT') ?? []
	const firstMetrics = processMetrics(playerState)
	const secondMetrics = processMetrics(comparisonState)
	const firstUnderstatAvailable = Boolean(
		playerState?.coverage.understatCurrent &&
		playerState.coverage.mappingStatus === 'VERIFIED'
	)
	const secondUnderstatAvailable = Boolean(
		comparisonState?.coverage.understatCurrent &&
		comparisonState.coverage.mappingStatus === 'VERIFIED'
	)
	const gkp = player.elementType === 1

	if (comparison && !samePosition) {
		return (
			<p className="rounded-lg border border-border/60 px-3 py-3 text-sm text-muted-foreground">
				{tl('processUnavailable')}
			</p>
		)
	}

	if (gkp) {
		return (
			<p className="rounded-lg border border-border/60 px-3 py-3 text-sm text-muted-foreground">
				{tl('processGkpTeamContextOnly')}
			</p>
		)
	}

	if (!firstUnderstatAvailable && !secondUnderstatAvailable) {
		return (
			<p className="rounded-lg border border-border/60 px-3 py-3 text-sm text-muted-foreground">
				{tl('processUnavailable')}
			</p>
		)
	}

	if (comparison && samePosition) {
		const metricCodes = Array.from(
			new Set([
				...(firstUnderstatAvailable
					? firstMetrics.map(metric => metric.code)
					: []),
				...(secondUnderstatAvailable
					? secondMetrics.map(metric => metric.code)
					: [])
			])
		)
		return (
			<div className="space-y-0.5">
				{metricCodes.map(code => {
					const first = firstMetrics.find(metric => metric.code === code)
					const second = secondMetrics.find(metric => metric.code === code)
					const metric = first ?? second
					if (!metric) return null
					return (
						<CompareRow
							key={code}
							label={processMetricLabel(metric.code, tl)}
							v1={first ? processMetricValue(first) : null}
							v2={second ? processMetricValue(second) : null}
							higherIsBetter={
								!metric.code.includes('XGC') && !metric.code.includes('XGA')
							}
							emphasizeWinner={true}
						/>
					)
				})}
			</div>
		)
	}

	return (
		<div>
			<p className="mb-2 text-xs font-semibold text-muted-foreground">
				{tl('understatProcessSource')}
			</p>
			<MetricGrid
				items={firstMetrics.map(metric => ({
					label: processMetricLabel(metric.code, tl),
					value: processMetricValue(metric)
				}))}
			/>
		</div>
	)
}

function cardsSpecs(tl: ReturnType<typeof useTranslations>): MetricSpec[] {
	return [
		{ label: tl('yellowCards'), key: 'yellowCards', direction: 'lower' },
		{ label: tl('redCards'), key: 'redCards', direction: 'lower' }
	]
}

function commonSeasonSpecs(
	tl: ReturnType<typeof useTranslations>
): MetricSpec[] {
	return [
		{ label: tl('starts'), key: 'starts', direction: 'neutral' },
		{ label: tl('minutes'), key: 'minutes', direction: 'neutral' },
		{ label: tl('bonus'), key: 'bonus', direction: 'higher' }
	]
}

function seasonSpecs(
	elementType: number,
	tl: ReturnType<typeof useTranslations>
): MetricSpec[] {
	const startsMinutes = commonSeasonSpecs(tl).slice(0, 2)
	const bonusBps: MetricSpec[] = [
		{ label: tl('bonus'), key: 'bonus', direction: 'higher' },
		{ label: tl('bps'), key: 'bps', direction: 'neutral' }
	]
	switch (elementType) {
		case 1:
			return [
				...startsMinutes,
				{ label: tl('cleanSheets'), key: 'cleanSheets', direction: 'higher' },
				{ label: tl('saves'), key: 'saves', direction: 'higher' },
				{
					label: tl('penaltiesSaved'),
					key: 'penaltiesSaved',
					direction: 'higher'
				},
				{
					label: tl('goalsConceded'),
					key: 'goalsConceded',
					direction: 'lower'
				},
				...bonusBps
			]
		case 2:
			return [
				...startsMinutes,
				{ label: tl('goals'), key: 'goalsScored', direction: 'higher' },
				{ label: tl('assists'), key: 'assists', direction: 'higher' },
				{ label: tl('cleanSheets'), key: 'cleanSheets', direction: 'higher' },
				{
					label: tl('goalsConceded'),
					key: 'goalsConceded',
					direction: 'lower'
				},
				...bonusBps,
				...cardsSpecs(tl)
			]
		case 3:
			return [
				...startsMinutes,
				{ label: tl('goals'), key: 'goalsScored', direction: 'higher' },
				{ label: tl('assists'), key: 'assists', direction: 'higher' },
				{ label: tl('cleanSheets'), key: 'cleanSheets', direction: 'higher' },
				...bonusBps,
				...cardsSpecs(tl)
			]
		case 4:
			return [
				...startsMinutes,
				{ label: tl('goals'), key: 'goalsScored', direction: 'higher' },
				{ label: tl('assists'), key: 'assists', direction: 'higher' },
				...bonusBps,
				...cardsSpecs(tl)
			]
		default:
			return commonSeasonSpecs(tl)
	}
}

function metricValue(
	player: PlayerDetailData,
	key: PlayerNumberKey
): number | null {
	const value = player[key]
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function per90(value: number | null, minutes: number | null): number | null {
	if (value == null || minutes == null || minutes < 180) return null
	return (value * 90) / minutes
}

function fixed(value: number | null, decimals = 2): string | null {
	return value == null ? null : value.toFixed(decimals)
}

function expectedMetrics(
	player: PlayerDetailData,
	tl: ReturnType<typeof useTranslations>
): DisplayMetric[] {
	const xg = player.expectedGoals
	const xa = player.expectedAssists
	const xgi = player.expectedGoalInvolvements
	const xgc = player.expectedGoalsConceded
	const minutes = player.minutes

	switch (player.elementType) {
		case 1:
			return [
				{ label: tl('expectedGoalsConceded'), value: fixed(xgc) },
				...(minutes != null && minutes >= 180
					? [
							{
								label: tl('expectedGoalsConcededPer90'),
								value: fixed(per90(xgc, minutes))
							}
						]
					: [])
			]
		case 2:
			return [
				{ label: tl('expectedGoals'), value: fixed(xg) },
				{ label: tl('expectedAssists'), value: fixed(xa) },
				{ label: tl('expectedGoalInvolvements'), value: fixed(xgi) },
				{ label: tl('expectedGoalsConceded'), value: fixed(xgc) },
				...(minutes != null && minutes >= 180
					? [
							{
								label: tl('expectedGoalInvolvementsPer90'),
								value: fixed(per90(xgi, minutes))
							},
							{
								label: tl('expectedGoalsConcededPer90'),
								value: fixed(per90(xgc, minutes))
							}
						]
					: [])
			]
		case 3:
		case 4:
			return [
				{ label: tl('expectedGoals'), value: fixed(xg) },
				{ label: tl('expectedAssists'), value: fixed(xa) },
				{ label: tl('expectedGoalInvolvements'), value: fixed(xgi) },
				...(minutes != null && minutes >= 180
					? [
							{
								label: tl('expectedGoalInvolvementsPer90'),
								value: fixed(per90(xgi, minutes))
							}
						]
					: [])
			]
		default:
			return []
	}
}

type UnderlyingCompareMetric = {
	label: string
	first: number | null
	second: number | null
	direction: MetricDirection
}

function underlyingCompareMetrics(
	first: PlayerDetailData,
	second: PlayerDetailData,
	tl: ReturnType<typeof useTranslations>
): UnderlyingCompareMetric[] {
	if (first.elementType !== second.elementType) {
		return [
			{
				label: tl('ictIndex'),
				first: first.ictIndex,
				second: second.ictIndex,
				direction: 'neutral'
			}
		]
	}

	const result: UnderlyingCompareMetric[] = []
	const add = (
		label: string,
		firstValue: number | null,
		secondValue: number | null,
		direction: MetricDirection
	) => result.push({ label, first: firstValue, second: secondValue, direction })

	if (first.elementType === 1) {
		add(
			tl('expectedGoalsConceded'),
			first.expectedGoalsConceded,
			second.expectedGoalsConceded,
			'lower'
		)
		if ((first.minutes ?? 0) >= 180 || (second.minutes ?? 0) >= 180) {
			add(
				tl('expectedGoalsConcededPer90'),
				per90(first.expectedGoalsConceded, first.minutes),
				per90(second.expectedGoalsConceded, second.minutes),
				'lower'
			)
		}
		add(tl('influence'), first.influence, second.influence, 'neutral')
	} else {
		add(
			tl('expectedGoals'),
			first.expectedGoals,
			second.expectedGoals,
			'higher'
		)
		add(
			tl('expectedAssists'),
			first.expectedAssists,
			second.expectedAssists,
			'higher'
		)
		add(
			tl('expectedGoalInvolvements'),
			first.expectedGoalInvolvements,
			second.expectedGoalInvolvements,
			'higher'
		)
		if (first.elementType === 2) {
			add(
				tl('expectedGoalsConceded'),
				first.expectedGoalsConceded,
				second.expectedGoalsConceded,
				'lower'
			)
		}
		if ((first.minutes ?? 0) >= 180 || (second.minutes ?? 0) >= 180) {
			add(
				tl('expectedGoalInvolvementsPer90'),
				per90(first.expectedGoalInvolvements, first.minutes),
				per90(second.expectedGoalInvolvements, second.minutes),
				'higher'
			)
			if (first.elementType === 2) {
				add(
					tl('expectedGoalsConcededPer90'),
					per90(first.expectedGoalsConceded, first.minutes),
					per90(second.expectedGoalsConceded, second.minutes),
					'lower'
				)
			}
		}
	}
	add(tl('ictIndex'), first.ictIndex, second.ictIndex, 'neutral')
	return result
}

function MarketSummary({
	player,
	comparison
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
}) {
	const tl = useTranslations('PlayerStats.labels')
	const format = useFormatter()
	const number = (value: number | null) =>
		value == null ? null : format.number(value)
	const net = (value: PlayerDetailData): number | null =>
		value.transfersInEvent == null || value.transfersOutEvent == null
			? null
			: value.transfersInEvent - value.transfersOutEvent

	if (comparison) {
		return (
			<div className="mb-4 space-y-0.5">
				<CompareRow
					label={tl('currentGwIn')}
					v1={number(player.transfersInEvent)}
					v2={number(comparison.transfersInEvent)}
					emphasizeWinner={false}
				/>
				<CompareRow
					label={tl('currentGwOut')}
					v1={number(player.transfersOutEvent)}
					v2={number(comparison.transfersOutEvent)}
					emphasizeWinner={false}
				/>
				<CompareRow
					label={tl('gwNet')}
					v1={number(net(player))}
					v2={number(net(comparison))}
					emphasizeWinner={false}
				/>
			</div>
		)
	}

	return (
		<div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
			{[
				{ label: tl('currentGwIn'), value: number(player.transfersInEvent) },
				{ label: tl('currentGwOut'), value: number(player.transfersOutEvent) },
				{ label: tl('gwNet'), value: number(net(player)) }
			].map(item => (
				<div key={item.label}>
					<p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
						{item.label}
					</p>
					<p className="mt-0.5 font-semibold tabular-nums">
						{item.value ?? '—'}
					</p>
				</div>
			))}
		</div>
	)
}

export function PlayerStatsView({
	selectedPlayer,
	selectedComparison,
	player,
	comparison,
	playerState,
	comparisonState,
	isLoading,
	isComparisonLoading,
	isStateLoading,
	isComparisonStateLoading,
	error,
	comparisonError,
	stateError,
	comparisonStateError,
	loadEvidence,
	loadComparisonEvidence,
	loadStateContext,
	loadComparisonStateContext,
	isEvidenceLoading,
	isComparisonEvidenceLoading,
	isStateContextLoading,
	isComparisonStateContextLoading,
	evidenceError,
	comparisonEvidenceError,
	stateContextError,
	comparisonStateContextError,
	anchorGw,
	seasonStatsAvailable
}: PlayerStatsViewProps) {
	const t = useTranslations('PlayerStats')
	const tl = useTranslations('PlayerStats.labels')
	// Fixtures are the first evidence layer: they extend the schedule already
	// visible in Overall and give the user a useful starting point without
	// asking them to choose an empty state first.
	const [activeSection, setActiveSection] =
		useState<PlayerStatsSectionId>('fixtures')
	const [contextOpen, setContextOpen] = useState(false)

	const isCompare = Boolean(comparison)
	const samePosition = Boolean(
		comparison && player && comparison.elementType === player.elementType
	)
	const hasSeasonStats = Boolean(
		seasonStatsAvailable &&
		player?.statsContext.scope === 'CURRENT_SEASON' &&
		(!comparison || comparison.statsContext.scope === 'CURRENT_SEASON')
	)
	const navSections = useMemo<PlayerStatsSectionId[]>(
		() =>
			hasSeasonStats
				? ['fixtures', 'recent', 'season', 'process']
				: ['fixtures'],
		[hasSeasonStats]
	)

	const applyHashSection = useCallback(() => {
		if (!player) return
		const requestedSection = playerStatsSectionFromHash(window.location.hash)
		const section =
			(!hasSeasonStats && requestedSection && requestedSection !== 'fixtures'
				? 'fixtures'
				: requestedSection) ?? 'fixtures'
		startTransition(() => {
			setActiveSection(section)
			setContextOpen(
				section === 'history' || section === 'market' || section === 'coverage'
			)
		})
	}, [hasSeasonStats, player])

	useEffect(() => {
		applyHashSection()
		window.addEventListener('hashchange', applyHashSection)
		window.addEventListener('popstate', applyHashSection)
		return () => {
			window.removeEventListener('hashchange', applyHashSection)
			window.removeEventListener('popstate', applyHashSection)
		}
	}, [applyHashSection, comparison?.id])

	useEffect(() => {
		// Wait for Overall to resolve before starting the evidence request. This
		// keeps the first render ordered as Overall → Fixtures and avoids a
		// partial detail object winning a race with the Overall query.
		if (!player) return
		if (!['fixtures', 'recent', 'season', 'process'].includes(activeSection))
			return
		const evidenceSection = activeSection as PlayerEvidenceSection
		void loadEvidence(evidenceSection)
		if (comparison) void loadComparisonEvidence(evidenceSection)
	}, [activeSection, comparison, loadComparisonEvidence, loadEvidence, player])

	useEffect(() => {
		if (!contextOpen) return
		if (playerState && !stateContextError) void loadStateContext()
		if (comparison && comparisonState && !comparisonStateContextError) {
			void loadComparisonStateContext()
		}
	}, [
		comparison,
		comparisonStateContextError,
		comparisonState,
		contextOpen,
		loadComparisonStateContext,
		loadStateContext,
		playerState,
		stateContextError
	])

	const handleSectionJump = useCallback((section: PlayerStatsSectionId) => {
		setActiveSection(section)
		if (
			section === 'history' ||
			section === 'market' ||
			section === 'coverage'
		) {
			setContextOpen(true)
		}
		scrollToPlayerStatsSection(section)
	}, [])

	if (!selectedPlayer) {
		return (
			<div className="rounded-xl border border-dashed border-border/70 px-6 py-12 text-center">
				<span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<User
						className="size-6"
						aria-hidden="true"
					/>
				</span>
				<h2 className="font-display text-lg font-bold uppercase tracking-wide">
					{t('selectPrompt')}
				</h2>
				<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
					{t('selectHelp')}
				</p>
			</div>
		)
	}

	if (isLoading || (selectedComparison && isComparisonLoading)) {
		return <PlayerDetailSkeleton />
	}

	if (error || comparisonError) {
		return (
			<div
				className="rounded-xl border border-border/80 bg-card px-6 py-8 text-center shadow-sm"
				role="alert"
			>
				<p className="text-sm text-destructive">{error ?? comparisonError}</p>
			</div>
		)
	}

	if (!player) return null

	const currentAsOf = player.statsContext.asOfEventId ?? anchorGw
	const seasonMetricSpecs =
		isCompare && !samePosition
			? commonSeasonSpecs(tl)
			: seasonSpecs(player.elementType, tl)
	const underlyingRows = comparison
		? underlyingCompareMetrics(player, comparison, tl)
		: []
	const evidenceIsOpen = (
		['fixtures', 'recent', 'season', 'process'] as PlayerStatsSectionId[]
	).includes(activeSection)

	const renderEvidenceContent = (): ReactNode => {
		if (!evidenceIsOpen) return null
		if (isEvidenceLoading || (comparison && isComparisonEvidenceLoading)) {
			return (
				<PlayerStatsSection title={t('detailedTitle')}>
					<div className="rounded-lg border border-border/60 px-4 py-6 text-sm text-muted-foreground">
						{t('loadingStats')}
					</div>
				</PlayerStatsSection>
			)
		}
		if (evidenceError || comparisonEvidenceError) {
			return (
				<PlayerStatsSection title={t('detailedTitle')}>
					<p
						className="rounded-lg border border-border/60 px-4 py-4 text-sm text-destructive"
						role="alert"
					>
						{evidenceError ?? comparisonEvidenceError}
					</p>
				</PlayerStatsSection>
			)
		}

		if (activeSection === 'fixtures') {
			return (
				<DeskSection
					id="ps-fixtures"
					title={t('fixturesTitle')}
					hint={t('fixturesHint')}
				>
					<PlayerFixturesTab
						player={player}
						comparison={
							comparison?.teamShortName === player.teamShortName
								? null
								: comparison
						}
						currentGameweek={anchorGw}
					/>
				</DeskSection>
			)
		}
		if (activeSection === 'recent' && hasSeasonStats) {
			return (
				<DeskSection
					id="ps-recent"
					title={t('recentTitle')}
					hint={t('recentHint')}
				>
					<PlayerRecentGameweeks
						player={player}
						comparison={comparison}
					/>
				</DeskSection>
			)
		}
		if (activeSection === 'season' && hasSeasonStats) {
			return (
				<DeskSection
					id="ps-season"
					title={t('seasonTitle')}
					hint={
						samePosition || !comparison
							? t('seasonThrough', { gw: currentAsOf })
							: t('crossPositionHint')
					}
				>
					{comparison ? (
						<div className="space-y-0.5">
							{seasonMetricSpecs.map(spec => (
								<CompareRow
									key={spec.key}
									label={spec.label}
									v1={metricValue(player, spec.key)}
									v2={metricValue(comparison, spec.key)}
									higherIsBetter={spec.direction !== 'lower'}
									emphasizeWinner={samePosition && spec.direction !== 'neutral'}
								/>
							))}
						</div>
					) : (
						<MetricGrid
							items={seasonMetricSpecs.map(spec => ({
								label: spec.label,
								value: metricValue(player, spec.key)
							}))}
						/>
					)}
				</DeskSection>
			)
		}
		if (activeSection === 'process' && hasSeasonStats) {
			return (
				<DeskSection
					id="ps-process"
					title={t('processTitle')}
					hint={
						comparison && !samePosition
							? t('crossPositionHint')
							: t('processHint')
					}
				>
					<span
						id="ps-underlying"
						className="sr-only"
						aria-hidden="true"
					/>
					<span
						id="ps-ict"
						className="sr-only"
						aria-hidden="true"
					/>
					{comparison && !samePosition ? (
						<p className="rounded-lg border border-border/60 px-3 py-3 text-sm text-muted-foreground">
							{t('crossPositionHint')}
						</p>
					) : comparison ? (
						<div className="space-y-0.5">
							{underlyingRows.map(row => (
								<CompareRow
									key={row.label}
									label={row.label}
									v1={fixed(row.first)}
									v2={fixed(row.second)}
									higherIsBetter={row.direction !== 'lower'}
									emphasizeWinner={samePosition && row.direction !== 'neutral'}
								/>
							))}
						</div>
					) : (
						<div className="flex flex-col gap-4">
							<div>
								<p className="mb-2 text-xs font-semibold text-muted-foreground">
									{t('fplProcessSource')}
								</p>
								<MetricGrid items={expectedMetrics(player, tl)} />
							</div>
							{player.elementType === 1 ? (
								<IctBar
									label={tl('influence')}
									value={player.influence}
									color="bg-info"
									max={1500}
								/>
							) : null}
							<IctBar
								label={tl('ictIndex')}
								value={player.ictIndex}
								color="bg-primary"
								max={300}
							/>
							<ProcessSourceEvidence
								player={player}
								comparison={null}
								playerState={playerState}
								comparisonState={comparisonState}
								samePosition={samePosition}
								tl={tl}
							/>
						</div>
					)}
					{comparison && samePosition ? (
						<ProcessSourceEvidence
							player={player}
							comparison={comparison}
							playerState={playerState}
							comparisonState={comparisonState}
							samePosition={samePosition}
							tl={tl}
						/>
					) : null}
				</DeskSection>
			)
		}
		return null
	}

	return (
		<div className="space-y-1">
			<PlayerOverallCard
				player={player}
				comparison={comparison}
				anchorGw={anchorGw}
				seasonStatsAvailable={seasonStatsAvailable}
			/>

			<PlayerFplProfile
				player={player}
				comparison={comparison}
				profile={playerState}
				comparisonProfile={comparisonState}
				seasonStatsAvailable={seasonStatsAvailable}
				isLoading={isStateLoading}
				isComparisonLoading={isComparisonStateLoading}
			/>

			<PlayerStateProfile
				player={player}
				comparison={comparison}
				profile={playerState}
				comparisonProfile={comparisonState}
				seasonStatsAvailable={seasonStatsAvailable}
				isLoading={isStateLoading}
				isComparisonLoading={isComparisonStateLoading}
				error={stateError}
				comparisonError={comparisonStateError}
			/>

			<div className="sticky top-0 z-20 -mx-1 border-b border-border/60 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
				<p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					{t('detailedTitle')}
				</p>
				<StickyPlayerIdentity
					player={player}
					comparison={comparison}
				/>
				<div className="mt-1 flex justify-end">
					<Link
						href="/data/fixtures#my-squad"
						className="text-xs font-medium text-primary-ink underline-offset-2 hover:underline"
					>
						{t('fixturesSquadLink')}
					</Link>
				</div>
				<PlayerSectionNav
					activeSection={activeSection}
					onJump={handleSectionJump}
					sections={navSections}
				/>
			</div>

			{renderEvidenceContent()}

			{hasSeasonStats ? (
				<div className="border-t border-border/60 pt-4">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full justify-between rounded-lg border-border/70 px-4 text-left font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
						onClick={() => setContextOpen(open => !open)}
						aria-expanded={contextOpen}
						aria-controls="ps-context-panel"
					>
						<span>
							{t(contextOpen ? 'closeSupportingData' : 'openSupportingData')}
						</span>
						<ChevronDown
							className={
								contextOpen
									? 'rotate-180 transition-transform'
									: 'transition-transform'
							}
							aria-hidden="true"
						/>
					</Button>
					<div
						id="ps-context-panel"
						hidden={!contextOpen}
						className="mt-3 space-y-3"
					>
						{contextOpen ? (
							<>
								{isStateContextLoading ||
								(comparison && isComparisonStateContextLoading) ? (
									<PlayerStatsSection title={t('detailedTitle')}>
										<p className="text-sm text-muted-foreground">
											{t('loadingStats')}
										</p>
									</PlayerStatsSection>
								) : stateContextError || comparisonStateContextError ? (
									<PlayerStatsSection title={t('detailedTitle')}>
										<p
											role="alert"
											className="text-sm text-destructive"
										>
											{stateContextError ?? comparisonStateContextError}
										</p>
									</PlayerStatsSection>
								) : (
									<PlayerStateContext
										player={player}
										comparison={comparison}
										profile={playerState}
										comparisonProfile={comparisonState}
									/>
								)}
								<div id="ps-market">
									<DeskSection
										id="ps-market-section"
										title={t('marketTitle')}
										hint={t('marketHint')}
									>
										<MarketSummary
											player={player}
											comparison={comparison}
										/>
										{comparison ? (
											<div className="grid gap-4 sm:grid-cols-2">
												<PlayerPriceHistoryBlock
													playerId={player.id}
													playerName={player.webName}
												/>
												<PlayerPriceHistoryBlock
													playerId={comparison.id}
													playerName={comparison.webName}
												/>
											</div>
										) : (
											<PlayerPriceHistoryBlock playerId={player.id} />
										)}
									</DeskSection>
								</div>
							</>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	)
}
