'use client'

import { Badge } from '@/components/ui/badge'
import type {
	PlayerDetailData,
	PlayerDetailFixture,
	PlayerSeasonSignal,
	PlayerSeasonSignalCode,
	PlayerSeasonTimelinePoint,
	PlayerStateProfileData
} from '@/lib/graphql/operations/players'
import { marketAvailabilityStatusKey } from '@/lib/market-availability'
import { positionBadgeClass } from '@/lib/position-style'
import { cn, normalizePosition } from '@/lib/utils'
import { useFormatter, useTranslations } from 'next-intl'
import { DIFFICULTY_COLORS, formatPrice } from './PlayerStatPrimitives'
import { seasonLabel } from './player-state-model'

const POSITION_CODES: Record<number, string> = {
	1: 'GKP',
	2: 'DEF',
	3: 'MID',
	4: 'FWD'
}

const SIGNAL_LABEL_KEYS: Record<PlayerSeasonSignalCode, string> = {
	UNDERSTAT_NPXG_PER_90: 'timeline.signal.npxgPer90',
	UNDERSTAT_XA_PER_90: 'timeline.signal.xaPer90',
	UNDERSTAT_NPXG_XA_PER_90: 'timeline.signal.npxgXaPer90',
	UNDERSTAT_KEY_PASSES_PER_90: 'timeline.signal.keyPassesPer90',
	OFFICIAL_CLEAN_SHEET_RATE: 'timeline.signal.cleanSheetRate',
	OFFICIAL_SAVES_PER_90: 'timeline.signal.savesPer90'
}

function timelineGridClass(isCompare: boolean): string {
	return cn(
		'grid',
		isCompare
			? 'grid-cols-[minmax(4.75rem,0.72fr)_repeat(2,minmax(0,1fr))]'
			: 'grid-cols-[minmax(5.25rem,0.8fr)_minmax(0,1fr)]'
	)
}

function positionCode(player: PlayerDetailData): string {
	const fromName = normalizePosition(player.elementTypeName)
	return fromName !== 'UNK'
		? fromName
		: (POSITION_CODES[player.elementType] ?? 'UNK')
}

function groupUpcomingFixtures(
	fixtures: PlayerDetailFixture[],
	anchorGw: number
): Array<[number, PlayerDetailFixture[]]> {
	const grouped = new Map<number, PlayerDetailFixture[]>()
	for (const fixture of fixtures) {
		if (fixture.event < anchorGw) continue
		const rows = grouped.get(fixture.event) ?? []
		rows.push(fixture)
		grouped.set(fixture.event, rows)
	}
	return Array.from(grouped.entries())
		.filter(([, rows]) => rows.some(row => row.bgw || !row.finished))
		.sort(([left], [right]) => left - right)
		.slice(0, 3)
}

function FixtureStrip({
	player,
	anchorGw
}: {
	player: PlayerDetailData
	anchorGw: number
}) {
	const t = useTranslations('PlayerStats')
	const upcoming = groupUpcomingFixtures(player.fixtures, anchorGw)
	if (upcoming.length === 0) {
		return (
			<span className="text-[0.68rem] text-muted-foreground">
				{t('nextFixturesEmpty')}
			</span>
		)
	}
	return (
		<div className="flex flex-wrap gap-1">
			{upcoming.map(([gameweek, fixtures]) => (
				<span
					key={gameweek}
					className="inline-flex min-h-6 flex-wrap items-center gap-1 rounded border border-border/60 bg-muted/20 px-1.5 text-[0.68rem] tabular-nums"
				>
					<span className="font-medium text-muted-foreground">
						{t('gameweekShort', { gameweek })}
					</span>
					{fixtures.every(fixture => fixture.bgw) ? (
						<span className="font-medium text-warning">BGW</span>
					) : (
						fixtures
							.filter(fixture => !fixture.bgw)
							.map(fixture => (
								<span
									key={fixture.id}
									className="inline-flex items-center gap-1"
								>
									<span
										className={cn(
											'size-1.5 shrink-0 rounded-full',
											DIFFICULTY_COLORS[fixture.difficulty] ?? 'bg-muted'
										)}
										aria-hidden="true"
									/>
									<span className="font-medium">
										{fixture.wasHome ? t('homeShort') : t('awayShort')}{' '}
										{fixture.againstTeamShortName}
									</span>
									<span className="text-muted-foreground tabular-nums">
										{t('difficultyShort', { difficulty: fixture.difficulty })}
									</span>
								</span>
							))
					)}
				</span>
			))}
		</div>
	)
}

function PlayerHeader({
	player,
	profile,
	anchorGw
}: {
	player: PlayerDetailData
	profile: PlayerStateProfileData | null
	anchorGw: number
}) {
	const t = useTranslations('PlayerStats')
	const tMarket = useTranslations('Market')
	const format = useFormatter()
	const code = positionCode(player)
	const availability = player.availability
	const statusKey = availability
		? marketAvailabilityStatusKey(availability.status)
		: null
	const observed = availability
		? new Date(`${availability.observedDate}T00:00:00Z`)
		: null
	const observedLabel =
		observed && !Number.isNaN(observed.getTime())
			? format.dateTime(observed, { dateStyle: 'medium', timeZone: 'UTC' })
			: availability?.observedDate
	const availabilityNews = availability?.news?.trim() ?? ''
	const providerMode = profile?.providerMode

	return (
		<div className="min-w-0 border-b border-border/60 bg-card/30 px-3 py-3 sm:px-4">
			<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
				<Badge
					className={cn(
						positionBadgeClass(code),
						'shrink-0 px-1.5 py-0 text-[0.65rem] font-bold'
					)}
				>
					{code === 'UNK' ? '—' : code}
				</Badge>
				<span className="truncate font-display text-sm font-bold uppercase tracking-wide sm:text-base">
					{player.webName}
				</span>
				<span className="text-xs text-muted-foreground">
					{player.teamShortName}
				</span>
			</div>
			<div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem]">
				<span className="font-medium tabular-nums">
					{formatPrice(player.price)}
				</span>
				<span className="text-muted-foreground">
					{player.selectedByPercent == null
						? '—'
						: `${player.selectedByPercent}%`}
				</span>
				{statusKey ? (
					<Badge
						variant="outline"
						className="h-5 px-1.5 text-[0.65rem]"
					>
						{tMarket(`status.${statusKey}`)}
					</Badge>
				) : (
					<span className="text-muted-foreground">{t('availabilityNone')}</span>
				)}
				{observedLabel ? (
					<span className="text-muted-foreground">
						{t('availabilityObserved', { date: observedLabel })}
					</span>
				) : null}
				{availability?.chanceOfPlayingThisRound != null ? (
					<span className="text-muted-foreground tabular-nums">
						{t('availabilityChanceThisRound', {
							percent: availability.chanceOfPlayingThisRound
						})}
					</span>
				) : null}
				{availability?.chanceOfPlayingNextRound != null ? (
					<span className="text-muted-foreground tabular-nums">
						{t('availabilityChanceNextRound', {
							percent: availability.chanceOfPlayingNextRound
						})}
					</span>
				) : null}
				{providerMode === 'FPL_WITH_UNDERSTAT_HISTORY' ? (
					<Badge
						variant="secondary"
						className="h-5 px-1.5 text-[0.65rem]"
					>
						{t('timeline.providerModeHistory')}
					</Badge>
				) : null}
			</div>
			{availabilityNews ? (
				<p className="mt-1.5 max-w-prose text-[0.68rem] leading-relaxed text-muted-foreground">
					<span className="font-medium text-foreground">
						{t('availabilityNewsLabel')}:
					</span>{' '}
					{availabilityNews}
				</p>
			) : null}
			<div className="mt-2">
				<p className="eyebrow mb-1">{t('nextFixturesLabel')}</p>
				<FixtureStrip
					player={player}
					anchorGw={anchorGw}
				/>
			</div>
		</div>
	)
}

function signalDisplay(
	signal: PlayerSeasonSignal,
	t: ReturnType<typeof useTranslations<'PlayerStats'>>,
	format: ReturnType<typeof useFormatter>
): string {
	if (signal.analysisStatus === 'PRESEASON')
		return t('timeline.preseasonPerformance')
	if (signal.analysisStatus === 'INSUFFICIENT')
		return t('timeline.sampleInsufficient')
	if (signal.reasonCodes.includes('UNDERSTAT_MAPPING_NOT_VERIFIED')) {
		return t('timeline.realityUnverified')
	}
	if (signal.value == null) return t('timeline.metricUnavailable')
	return signal.unit === 'percent'
		? `${format.number(signal.value, { maximumFractionDigits: 1 })}%`
		: format.number(signal.value, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			})
}

function signalLabel(
	signal: PlayerSeasonSignal,
	t: ReturnType<typeof useTranslations<'PlayerStats'>>
): string {
	return t(SIGNAL_LABEL_KEYS[signal.code] as never)
}

function seasonTimelineOf(
	profile: PlayerStateProfileData | null
): PlayerSeasonTimelinePoint[] | null {
	if (!profile) return null
	return Array.isArray(profile.seasonTimeline) ? profile.seasonTimeline : null
}

function pointForSeason(
	profile: PlayerStateProfileData | null,
	season: string
): PlayerSeasonTimelinePoint | null {
	return (
		(seasonTimelineOf(profile) ?? []).find(point => point.season === season) ??
		null
	)
}

function comparableWinner(
	primary: PlayerSeasonSignal | undefined,
	comparison: PlayerSeasonSignal | undefined,
	positionMatches: boolean
): 'primary' | 'comparison' | null {
	if (
		!positionMatches ||
		!primary ||
		!comparison ||
		primary.code !== comparison.code ||
		primary.value == null ||
		comparison.value == null ||
		primary.analysisStatus !== 'READY' ||
		comparison.analysisStatus !== 'READY' ||
		primary.value === comparison.value
	) {
		return null
	}
	return primary.value > comparison.value ? 'primary' : 'comparison'
}

function TimelineCell({
	profile,
	point,
	maxPoints,
	accent,
	signalWinners
}: {
	profile: PlayerStateProfileData | null
	point: PlayerSeasonTimelinePoint | null
	maxPoints: number
	accent: 'primary' | 'compare'
	signalWinners: Array<'primary' | 'comparison' | null>
}) {
	const t = useTranslations('PlayerStats')
	const format = useFormatter()
	if (!profile) {
		return (
			<div className="min-w-0 px-3 py-3 text-[0.7rem] leading-snug text-muted-foreground sm:px-4">
				{t('timeline.loading')}
			</div>
		)
	}
	if (seasonTimelineOf(profile) === null) {
		return (
			<div className="min-w-0 px-3 py-3 text-[0.7rem] leading-snug text-muted-foreground sm:px-4">
				{t('timeline.loading')}
			</div>
		)
	}
	if (!point) {
		return (
			<div className="min-w-0 px-3 py-3 text-[0.7rem] leading-snug text-muted-foreground sm:px-4">
				{t('timeline.notInFplPool')}
			</div>
		)
	}
	const barWidth =
		point.phase === 'COMPLETED' && point.fplTotalPoints != null
			? Math.max(0, Math.min(100, (point.fplTotalPoints / maxPoints) * 100))
			: 0
	return (
		<div className="min-w-0 px-3 py-3 sm:px-4">
			<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
				{point.phase === 'PRESEASON' ? (
					<span className="text-xs text-muted-foreground">
						{t('timeline.preseasonPerformance')}
					</span>
				) : point.fplTotalPoints == null ? (
					<span className="text-xs text-muted-foreground">
						{t('timeline.pointsUnavailable')}
					</span>
				) : point.phase === 'ACTIVE' ? (
					<span className="font-display text-sm font-bold tabular-nums">
						{t('timeline.activePoints', {
							gw: profile?.asOfEventId ?? '—',
							points: point.fplTotalPoints
						})}
					</span>
				) : (
					<span className="font-display text-sm font-bold tabular-nums">
						{t('timeline.completedPoints', {
							points: point.fplTotalPoints
						})}
					</span>
				)}
			</div>
			{barWidth > 0 ? (
				<div
					className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/70"
					aria-hidden="true"
				>
					<div
						className={cn(
							'h-full rounded-full transition-[width]',
							accent === 'primary' ? 'bg-primary' : 'bg-warning'
						)}
						style={{ width: `${barWidth}%` }}
					/>
				</div>
			) : null}
			<div className="mt-2 space-y-1.5">
				<div className="flex items-baseline gap-1.5 text-[0.67rem] text-muted-foreground">
					<Badge
						variant="outline"
						className="h-5 px-1.5 text-[0.62rem]"
					>
						{POSITION_CODES[point.position] ?? '—'}
					</Badge>
					<span>{t('timeline.signalsLabel')}</span>
				</div>
				{point.signals.map((signal, index) => {
					const winner = signalWinners[index] ?? null
					const currentCellWins =
						(accent === 'primary' && winner === 'primary') ||
						(accent === 'compare' && winner === 'comparison')
					return (
						<div
							key={signal.code}
							className="flex min-w-0 items-baseline justify-between gap-2 text-[0.69rem]"
						>
							<span className="min-w-0 break-words text-muted-foreground">
								{signalLabel(signal, t)}
							</span>
							<span
								className={cn(
									'shrink-0 font-medium tabular-nums',
									currentCellWins &&
										(accent === 'primary' ? 'text-primary-ink' : 'text-warning'),
									signal.analysisStatus !== 'READY' &&
										'font-normal text-muted-foreground'
								)}
							>
								{signalDisplay(signal, t, format)}
							</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export function PlayerSeasonTimeline({
	player,
	comparison,
	profile,
	comparisonProfile,
	anchorGw
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData | null
	comparisonProfile: PlayerStateProfileData | null
	anchorGw: number
}) {
	const t = useTranslations('PlayerStats')
	const isCompare = comparison !== null
	const currentSeason =
		profile?.season ?? comparisonProfile?.season ?? player.statsContext.season
	const profileTimeline = seasonTimelineOf(profile) ?? []
	const comparisonTimeline = seasonTimelineOf(comparisonProfile) ?? []
	const seasons = Array.from(
		new Set([
			currentSeason,
			...profileTimeline.map(point => point.season),
			...comparisonTimeline.map(point => point.season)
		])
	).sort((left, right) => right.localeCompare(left))
	const completedPoints = [profile, comparisonProfile]
		.flatMap(item => item?.seasonTimeline ?? [])
		.filter(
			point => point.phase === 'COMPLETED' && point.fplTotalPoints != null
		)
		.map(point => point.fplTotalPoints ?? 0)
	const maxPoints = Math.max(1, ...completedPoints)

	return (
		<section
			id="ps-history"
			aria-label={t('overallTitle')}
			className="scroll-mt-36"
		>
			<div className="mb-2 flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 className="eyebrow sm:text-caption">{t('timelineTitle')}</h2>
					<p className="mt-1 text-xs text-muted-foreground">
						{t('timelineHint')}
					</p>
				</div>
				{isCompare ? (
					<span className="text-[0.68rem] text-muted-foreground">
						{t('timeline.compareHint')}
					</span>
				) : null}
			</div>
			<div className="overflow-hidden rounded-xl border border-border/70 bg-card/40">
				<div
					role="table"
					aria-label={t('timelineTitle')}
				>
					<div
						role="row"
						className={timelineGridClass(isCompare)}
					>
						<div
							role="columnheader"
							id="ps-history-season-header"
							className="border-b border-border/60 bg-muted/20 px-2 py-3 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground sm:px-3"
						>
							{t('season')}
						</div>
						<div
							role="columnheader"
							id={`ps-history-player-${player.id}`}
							className="border-b border-l border-border/60"
						>
							<PlayerHeader
								player={player}
								profile={profile}
								anchorGw={anchorGw}
							/>
						</div>
						{comparison ? (
							<div
								role="columnheader"
								id={`ps-history-player-${comparison.id}`}
								className="border-b border-l border-border/60"
							>
								<PlayerHeader
									player={comparison}
									profile={comparisonProfile}
									anchorGw={anchorGw}
								/>
							</div>
						) : null}
					</div>

					{seasons.map(season => {
						const first = pointForSeason(profile, season)
						const second = pointForSeason(comparisonProfile, season)
						const phase = first?.phase ?? second?.phase ?? 'COMPLETED'
						return (
							<FragmentRow
								key={season}
								season={season}
								phase={phase}
								currentSeason={currentSeason}
								player={player}
								comparison={comparison}
								profile={profile}
								comparisonProfile={comparisonProfile}
								first={first}
								second={second}
								maxPoints={maxPoints}
								isCompare={isCompare}
								playerColumnId={`ps-history-player-${player.id}`}
								comparisonColumnId={
									comparison ? `ps-history-player-${comparison.id}` : null
								}
							/>
						)
					})}
				</div>
			</div>
		</section>
	)
}

function FragmentRow({
	season,
	phase,
	currentSeason,
	player,
	comparison,
	profile,
	comparisonProfile,
	first,
	second,
	maxPoints,
	isCompare,
	playerColumnId,
	comparisonColumnId
}: {
	season: string
	phase: PlayerSeasonTimelinePoint['phase']
	currentSeason: string
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	profile: PlayerStateProfileData | null
	comparisonProfile: PlayerStateProfileData | null
	first: PlayerSeasonTimelinePoint | null
	second: PlayerSeasonTimelinePoint | null
	maxPoints: number
	isCompare: boolean
	playerColumnId: string
	comparisonColumnId: string | null
}) {
	const t = useTranslations('PlayerStats')
	const seasonId = `ps-history-season-${season}`
	const signalWinners =
		first && second && first.position === second.position
			? first.signals.map((signal, index) =>
					comparableWinner(signal, second.signals[index], true)
			  )
			: []
	return (
		<div
			role="row"
			className={timelineGridClass(isCompare)}
		>
			<div
				role="rowheader"
				id={seasonId}
				className="border-t border-border/60 bg-muted/10 px-2 py-3 sm:px-3"
			>
				<div className="font-display text-xs font-bold tabular-nums">
					{seasonLabel(season)}
				</div>
				<div className="mt-1 text-[0.65rem] text-muted-foreground">
					{season === currentSeason
						? t('timeline.currentSeason')
						: phase === 'COMPLETED'
							? t('timeline.completedSeason')
							: t('timeline.activeSeason')}
				</div>
			</div>
			<div
				role="cell"
				aria-labelledby={`${seasonId} ${playerColumnId}`}
				className="border-l border-t border-border/60"
			>
				<TimelineCell
					profile={profile}
					point={first}
					maxPoints={maxPoints}
					accent="primary"
					signalWinners={signalWinners}
				/>
			</div>
			{comparison ? (
				<div
					role="cell"
					aria-labelledby={`${seasonId} ${comparisonColumnId ?? ''}`.trim()}
					className="border-l border-t border-border/60"
				>
					<TimelineCell
						profile={comparisonProfile}
						point={second}
						maxPoints={maxPoints}
						accent="compare"
						signalWinners={signalWinners}
					/>
				</div>
			) : null}
		</div>
	)
}
