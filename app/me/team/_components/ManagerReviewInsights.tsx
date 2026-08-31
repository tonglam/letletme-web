import {
	DataTable,
	DataTd,
	DataTh,
	DataThead,
	DataTr
} from '@/components/data/DataTable'
import {
	StatsMetricTile,
	StatsSectionCard
} from '@/components/stats/StatsSurfaces'
import type {
	MyFplManagerPositionPoints,
	MyFplManagerReview
} from '@/lib/graphql/operations/my-fpl'
import { cn } from '@/lib/utils'
import {
	ArrowRightLeft,
	ChartNoAxesColumn,
	Layers3,
	Star,
	UsersRound
} from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

const POSITION_KEYS = [
	['goalkeeper', 'reviewPositionGoalkeeper'],
	['defender', 'reviewPositionDefender'],
	['midfielder', 'reviewPositionMidfielder'],
	['forward', 'reviewPositionForward']
] as const

function compactNumber(
	value: number,
	format: ReturnType<typeof useFormatter>
): string {
	return format.number(value, {
		notation: Math.abs(value) >= 1_000 ? 'compact' : 'standard',
		maximumFractionDigits: 1
	})
}

function signedNumber(
	value: number | null,
	format: ReturnType<typeof useFormatter>
): string {
	if (value === null) return '—'
	const rendered = compactNumber(Math.abs(value), format)
	return value > 0 ? `+${rendered}` : value < 0 ? `−${rendered}` : '0'
}

function chipLabel(
	chip: string,
	t: ReturnType<typeof useTranslations<'TeamStats'>>
): string {
	switch (chip) {
		case 'WILDCARD':
			return t('wildcard')
		case 'FREE_HIT':
			return t('freeHit')
		case 'BENCH_BOOST':
			return t('benchBoost')
		case 'TRIPLE_CAPTAIN':
			return t('tripleCaptain')
		case 'MANAGER':
			return t('assistantManager')
		default:
			return chip
	}
}

function PositionContribution({
	points
}: {
	points: MyFplManagerPositionPoints
}) {
	const t = useTranslations('TeamStats')
	const format = useFormatter()
	const max = Math.max(
		1,
		...POSITION_KEYS.map(([key]) => Math.max(0, points[key]))
	)

	return (
		<div className="space-y-3">
			{POSITION_KEYS.map(([key, labelKey]) => {
				const value = points[key]
				const width = `${Math.max(2, (Math.max(0, value) / max) * 100)}%`
				return (
					<div key={key}>
						<div className="mb-1 flex items-center justify-between gap-3 text-sm">
							<span className="text-muted-foreground">{t(labelKey)}</span>
							<span className="font-mono tabular-nums">
								{compactNumber(value, format)}
							</span>
						</div>
						<div
							className="h-2 overflow-hidden rounded-full bg-muted"
							role="img"
							aria-label={t('reviewPositionAria', {
								position: t(labelKey),
								points: value
							})}
						>
							<div
								className="h-full rounded-full bg-primary"
								style={{ width }}
							/>
						</div>
					</div>
				)
			})}
		</div>
	)
}

export function ManagerReviewInsights({
	review
}: {
	review: MyFplManagerReview
}) {
	const t = useTranslations('TeamStats')
	const format = useFormatter()
	const summary = review.summary
	if (!summary) return null

	const totalCaptainRegret = review.timeline.reduce(
		(total, row) => total + (row.review.captain.regretPoints ?? 0),
		0
	)
	const totalBenchRegret = review.timeline.reduce(
		(total, row) => total + (row.review.benchRegretPoints ?? 0),
		0
	)
	const transferMoves = review.transfers.flatMap(gameweek =>
		gameweek.transfers.map(move => ({ ...move, eventId: gameweek.eventId }))
	)

	return (
		<div className="space-y-4 sm:space-y-5">
			<StatsSectionCard
				icon={ChartNoAxesColumn}
				title={t('reviewDecisionOverview')}
				description={t('reviewDecisionOverviewHint', {
					through: review.throughEventId ?? 0,
					gameweeks: summary.gameweeksReviewed
				})}
			>
				<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					<StatsMetricTile
						label={t('reviewAverageNet')}
						value={format.number(summary.averageNetPoints, {
							maximumFractionDigits: 1
						})}
						detail={t('reviewMedianNet', {
							value: format.number(summary.medianNetPoints, {
								maximumFractionDigits: 1
							})
						})}
					/>
					<StatsMetricTile
						label={t('reviewRankChange')}
						value={signedNumber(summary.overallRankChange, format)}
						valueClassName={cn(
							summary.overallRankChange != null &&
								summary.overallRankChange > 0 &&
								'text-emerald-700 dark:text-emerald-400',
							summary.overallRankChange != null &&
								summary.overallRankChange < 0 &&
								'text-destructive'
						)}
						detail={t('reviewImprovementStreak', {
							current: summary.currentImprovementStreak,
							longest: summary.longestImprovementStreak
						})}
					/>
					<StatsMetricTile
						label={t('reviewTransferHits')}
						value={`−${summary.totalHitPoints}`}
						detail={t('reviewHitGameweeks', {
							count: summary.hitGameweeks
						})}
					/>
					<StatsMetricTile
						label={t('reviewAutoSubs')}
						value={`+${summary.totalAutoSubPoints}`}
						detail={t('reviewAutoSubGameweeks', {
							count: summary.autoSubGameweeks
						})}
					/>
					<StatsMetricTile
						label={t('reviewCaptainRegret')}
						value={totalCaptainRegret}
						detail={t('reviewCaptainBlankGameweeks', {
							count: summary.captainBlankGameweeks
						})}
					/>
					<StatsMetricTile
						label={t('reviewBenchRegret')}
						value={totalBenchRegret}
						detail={t('reviewBenchRegretHint')}
					/>
					<StatsMetricTile
						label={t('reviewTopCaptain')}
						value={summary.topCaptainWebName ?? '—'}
						detail={t('reviewTopCaptainRate', {
							count: summary.topCaptainGameweeks,
							rate: summary.topCaptainRate
						})}
					/>
					<StatsMetricTile
						label={t('reviewProvisionalGameweeks')}
						value={summary.provisionalGameweeks}
						detail={t('reviewConsistencyFirst')}
					/>
				</div>

				<div className="mt-6 grid gap-6 md:grid-cols-2">
					<div>
						<p className="mb-3 eyebrow">{t('reviewPositionContribution')}</p>
						<PositionContribution points={summary.positionPoints} />
					</div>
					<div>
						<p className="mb-3 eyebrow">{t('reviewFormationUsage')}</p>
						<div className="flex flex-wrap gap-2">
							{summary.formations.map(item => (
								<div
									key={item.formation}
									className="rounded-lg border border-border/70 px-3 py-2"
								>
									<span className="font-display font-bold">
										{item.formation}
									</span>
									<span className="ml-2 text-xs text-muted-foreground">
										{t('reviewFormationGameweeks', {
											count: item.gameweeks
										})}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</StatsSectionCard>

			<StatsSectionCard
				icon={Star}
				title={t('reviewChipComparisons')}
				description={t('reviewChipComparisonsHint')}
			>
				{summary.chips.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t('noChipsPlayed')}</p>
				) : (
					<DataTable minWidthClass="min-w-[34rem]">
						<DataThead>
							<DataTh align="center">{t('gameweekShort')}</DataTh>
							<DataTh>{t('chip')}</DataTh>
							<DataTh align="right">{t('netShort')}</DataTh>
							<DataTh align="right">{t('reviewNetVsBaseline')}</DataTh>
							<DataTh align="right">{t('reviewRankDelta')}</DataTh>
						</DataThead>
						<tbody>
							{summary.chips.map(chip => (
								<DataTr key={`${chip.eventId}-${chip.chip}`}>
									<DataTd
										align="center"
										className="font-mono tabular-nums"
									>
										{chip.eventId}
									</DataTd>
									<DataTd className="font-medium">
										{chipLabel(chip.chip, t)}
									</DataTd>
									<DataTd
										align="right"
										className="font-mono tabular-nums"
									>
										{chip.eventNetPoints}
									</DataTd>
									<DataTd
										align="right"
										className={cn(
											'font-mono tabular-nums',
											chip.differenceFromOtherGameweeks != null &&
												chip.differenceFromOtherGameweeks > 0 &&
												'text-emerald-700 dark:text-emerald-400',
											chip.differenceFromOtherGameweeks != null &&
												chip.differenceFromOtherGameweeks < 0 &&
												'text-destructive'
										)}
									>
										{chip.differenceFromOtherGameweeks == null
											? '—'
											: signedNumber(chip.differenceFromOtherGameweeks, format)}
									</DataTd>
									<DataTd
										align="right"
										className="font-mono tabular-nums"
									>
										{signedNumber(chip.overallRankDelta, format)}
									</DataTd>
								</DataTr>
							))}
						</tbody>
					</DataTable>
				)}
			</StatsSectionCard>

			<StatsSectionCard
				icon={Layers3}
				title={t('reviewGameweekDecisions')}
				description={t('reviewGameweekDecisionsHint')}
			>
				<DataTable minWidthClass="min-w-[48rem]">
					<DataThead>
						<DataTh align="center">{t('gameweekShort')}</DataTh>
						<DataTh>{t('reviewSnapshotStatus')}</DataTh>
						<DataTh>{t('reviewFormation')}</DataTh>
						<DataTh align="right">{t('netShort')}</DataTh>
						<DataTh align="right">{t('reviewRankDelta')}</DataTh>
						<DataTh align="right">{t('reviewCaptainRegretShort')}</DataTh>
						<DataTh align="right">{t('reviewBenchRegretShort')}</DataTh>
						<DataTh align="right">{t('reviewAutoSubShort')}</DataTh>
					</DataThead>
					<tbody>
						{[...review.timeline].reverse().map(row => (
							<DataTr key={row.eventId}>
								<DataTd
									align="center"
									className="font-mono tabular-nums"
								>
									{row.eventId}
								</DataTd>
								<DataTd>
									<span
										className={cn(
											'rounded-full border px-2 py-0.5 text-label font-semibold uppercase tracking-wide',
											row.status === 'FINAL'
												? 'border-emerald-600/25 text-emerald-700 dark:text-emerald-400'
												: 'border-amber-600/25 text-amber-700 dark:text-amber-400'
										)}
									>
										{row.status === 'FINAL'
											? t('reviewStatusFinal')
											: t('reviewStatusProvisional')}
									</span>
								</DataTd>
								<DataTd className="font-mono">{row.review.formation}</DataTd>
								<DataTd
									align="right"
									className="font-mono tabular-nums"
								>
									{row.eventNetPoints}
								</DataTd>
								<DataTd
									align="right"
									className="font-mono tabular-nums"
								>
									{signedNumber(row.overallRankDelta, format)}
								</DataTd>
								<DataTd
									align="right"
									className="font-mono tabular-nums"
								>
									{row.review.captain.regretPoints ?? '—'}
								</DataTd>
								<DataTd
									align="right"
									className="font-mono tabular-nums"
								>
									{row.review.benchRegretPoints ?? '—'}
								</DataTd>
								<DataTd
									align="right"
									className="font-mono tabular-nums"
								>
									{row.eventAutoSubPoints}
								</DataTd>
							</DataTr>
						))}
					</tbody>
				</DataTable>
			</StatsSectionCard>

			<StatsSectionCard
				icon={ArrowRightLeft}
				title={t('reviewTransferReturns')}
				description={t('reviewTransferReturnsHint')}
			>
				{transferMoves.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{t('transferFilterEmpty')}
					</p>
				) : (
					<DataTable minWidthClass="min-w-[46rem]">
						<DataThead>
							<DataTh align="center">{t('gameweekShort')}</DataTh>
							<DataTh>{t('in')}</DataTh>
							<DataTh>{t('out')}</DataTh>
							<DataTh align="right">{t('reviewReturnSame')}</DataTh>
							<DataTh align="right">{t('reviewReturnThree')}</DataTh>
							<DataTh align="right">{t('reviewReturnFive')}</DataTh>
						</DataThead>
						<tbody>
							{[...transferMoves].reverse().map((move, index) => (
								<DataTr key={`${move.eventId}-${move.time}-${index}`}>
									<DataTd
										align="center"
										className="font-mono tabular-nums"
									>
										{move.eventId}
									</DataTd>
									<DataTd>
										<span className="font-medium">{move.elementInWebName}</span>
										<span className="ml-1 text-xs text-muted-foreground">
											{move.elementInTeamShortName}
										</span>
									</DataTd>
									<DataTd>
										<span className="font-medium">
											{move.elementOutWebName}
										</span>
										<span className="ml-1 text-xs text-muted-foreground">
											{move.elementOutTeamShortName}
										</span>
									</DataTd>
									{[
										move.sameGameweekGain,
										move.threeGameweekGain,
										move.fiveGameweekGain
									].map((gain, gainIndex) => (
										<DataTd
											key={gainIndex}
											align="right"
											className={cn(
												'font-mono tabular-nums',
												gain != null &&
													gain > 0 &&
													'text-emerald-700 dark:text-emerald-400',
												gain != null && gain < 0 && 'text-destructive'
											)}
										>
											{gain == null ? '—' : signedNumber(gain, format)}
										</DataTd>
									))}
								</DataTr>
							))}
						</tbody>
					</DataTable>
				)}
			</StatsSectionCard>

			<StatsSectionCard
				icon={UsersRound}
				title={t('reviewHoldingPeriods')}
				description={t('reviewHoldingPeriodsHint')}
			>
				<DataTable minWidthClass="min-w-[42rem]">
					<DataThead>
						<DataTh>{t('player')}</DataTh>
						<DataTh>{t('position')}</DataTh>
						<DataTh>{t('reviewHoldingWindow')}</DataTh>
						<DataTh align="right">{t('reviewGameweeksHeld')}</DataTh>
						<DataTh align="right">{t('reviewStarts')}</DataTh>
						<DataTh align="right">{t('reviewCaptaincies')}</DataTh>
						<DataTh align="right">{t('reviewOwnedPoints')}</DataTh>
						<DataTh align="right">{t('reviewContribution')}</DataTh>
					</DataThead>
					<tbody>
						{review.holdings.map((holding, index) => (
							<DataTr
								key={`${holding.element}-${holding.startedEventId}-${index}`}
							>
								<DataTd>
									<span className="font-medium">{holding.webName}</span>
									<span className="ml-1 text-xs text-muted-foreground">
										{holding.teamShortName}
									</span>
								</DataTd>
								<DataTd>{holding.elementTypeName}</DataTd>
								<DataTd className="font-mono tabular-nums">
									GW{holding.startedEventId}–
									{holding.endedEventId == null
										? t('reviewHoldingCurrent')
										: `GW${holding.endedEventId}`}
								</DataTd>
								<DataTd align="right">{holding.gameweeksHeld}</DataTd>
								<DataTd align="right">{holding.starts}</DataTd>
								<DataTd align="right">{holding.captaincies}</DataTd>
								<DataTd align="right">{holding.pointsWhileOwned}</DataTd>
								<DataTd align="right">{holding.scoringContribution}</DataTd>
							</DataTr>
						))}
					</tbody>
				</DataTable>
			</StatsSectionCard>
		</div>
	)
}
