import { useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import type { TeamSeasonLogs } from '../_lib/team-stats-model'
import {
	DataTable,
	DataTd,
	DataTh,
	DataThead,
	DataTr,
} from '@/components/data/DataTable'
import { TeamGameweekLink } from './TeamGameweekLink'
import { TeamMetricGrid, TeamMetricTile } from './TeamMetricTile'

/**
 * Official FPL: one of each chip before the GW19 deadline, one of each after.
 * GW1–19 → first half; GW20–38 → second half.
 */
export const CHIP_HALF_SPLIT_GW = 19
const PER_HALF_ALLOWANCE = 1

const CHIP_ORDER = [
	'WILDCARD',
	'FREE_HIT',
	'BENCH_BOOST',
	'TRIPLE_CAPTAIN',
] as const

type ChipFamily = (typeof CHIP_ORDER)[number]
type HalfKey = 'first' | 'second'

function halfForGameweek(gameweek: number): HalfKey {
	return gameweek <= CHIP_HALF_SPLIT_GW ? 'first' : 'second'
}

function normalizeChipFamily(raw: string): ChipFamily | null {
	const chip = raw.toUpperCase().replace(/[\s-]+/g, '_')
	if (chip === 'NONE' || chip === '') return null
	if (chip === 'WC' || chip === 'WILDCARD') return 'WILDCARD'
	if (chip === 'FH' || chip === 'FREEHIT' || chip === 'FREE_HIT') return 'FREE_HIT'
	if (
		chip === 'BB' ||
		chip === 'BBOOST' ||
		chip === 'BENCH_BOOST' ||
		chip === 'BENCHBOOST'
	) {
		return 'BENCH_BOOST'
	}
	if (
		chip === '3XC' ||
		chip === 'TC' ||
		chip === 'TRIPLE_CAPTAIN' ||
		chip === 'TRIPLECAPTAIN'
	) {
		return 'TRIPLE_CAPTAIN'
	}
	return null
}

function familyLabel(
	family: ChipFamily,
	t: ReturnType<typeof useTranslations<'TeamStats'>>,
): string {
	switch (family) {
		case 'WILDCARD':
			return t('wildcard')
		case 'FREE_HIT':
			return t('freeHit')
		case 'BENCH_BOOST':
			return t('benchBoost')
		case 'TRIPLE_CAPTAIN':
			return t('tripleCaptain')
	}
}

function emptyHalfCounts(): Record<ChipFamily, number> {
	return {
		WILDCARD: 0,
		FREE_HIT: 0,
		BENCH_BOOST: 0,
		TRIPLE_CAPTAIN: 0,
	}
}

/**
 * Season chip inventory by half — not tied to the selected gameweek scoreboard.
 */
export function TeamChipsTab({ stats }: { stats: TeamSeasonLogs }) {
	const t = useTranslations('TeamStats')
	const format = useFormatter()

	const { inventory, firstUsed, secondUsed, firstLeft, secondLeft } =
		useMemo(() => {
			const first = emptyHalfCounts()
			const second = emptyHalfCounts()

			for (const row of stats.chipUsageRows) {
				const family = normalizeChipFamily(row.chip)
				const gw = Number(row.gameweek)
				if (!family || !Number.isFinite(gw) || gw <= 0) continue
				const half = halfForGameweek(gw)
				if (half === 'first') first[family] += 1
				else second[family] += 1
			}

			const inventory = CHIP_ORDER.map(family => {
				const usedFirst = first[family]
				const usedSecond = second[family]
				return {
					family,
					label: familyLabel(family, t),
					first: {
						used: usedFirst,
						remaining: Math.max(0, PER_HALF_ALLOWANCE - usedFirst),
					},
					second: {
						used: usedSecond,
						remaining: Math.max(0, PER_HALF_ALLOWANCE - usedSecond),
					},
				}
			})

			const sumUsed = (half: HalfKey) =>
				CHIP_ORDER.reduce(
					(n, f) => n + (half === 'first' ? first[f] : second[f]),
					0,
				)
			const sumLeft = (half: HalfKey) =>
				CHIP_ORDER.reduce((n, f) => {
					const used = half === 'first' ? first[f] : second[f]
					return n + Math.max(0, PER_HALF_ALLOWANCE - used)
				}, 0)

			return {
				inventory,
				firstUsed: sumUsed('first'),
				secondUsed: sumUsed('second'),
				firstLeft: sumLeft('first'),
				secondLeft: sumLeft('second'),
			}
		}, [stats.chipUsageRows, t])

	return (
		<div className="space-y-6">
			{/* Half-season inventory */}
			<div>
				<p className="mb-1 eyebrow">
					{t('chipBalance')}
				</p>
				<p className="mb-3 text-xs leading-relaxed text-muted-foreground">
					{t('chipBalanceHint')}
				</p>

				{/* Half summaries — fixed-height metric tiles, one value line each */}
				<TeamMetricGrid cols={2} className="mb-3">
					<TeamMetricTile
						label={t('chipHalfFirst')}
						value={t('chipHalfValue', {
							used: firstUsed,
							left: firstLeft,
							max: CHIP_ORDER.length,
						})}
						tone="primary"
					/>
					<TeamMetricTile
						label={t('chipHalfSecond')}
						value={t('chipHalfValue', {
							used: secondUsed,
							left: secondLeft,
							max: CHIP_ORDER.length,
						})}
						tone="primary"
					/>
				</TeamMetricGrid>

				<DataTable minWidthClass="min-w-[26rem]">
					<DataThead>
						<DataTh>{t('chip')}</DataTh>
						<DataTh align="center" className="w-20">
							{t('chipHalfFirstShort')}
							<br />
							<span className="font-normal normal-case tracking-normal text-muted-foreground/80">
								{t('chipsUsed')}/{t('chipsRemaining')}
							</span>
						</DataTh>
						<DataTh align="center" className="w-20">
							{t('chipHalfSecondShort')}
							<br />
							<span className="font-normal normal-case tracking-normal text-muted-foreground/80">
								{t('chipsUsed')}/{t('chipsRemaining')}
							</span>
						</DataTh>
					</DataThead>
					<tbody>
						{inventory.map(row => (
							<DataTr key={row.family}>
								<DataTd className="text-sm font-medium">
									{row.label}
								</DataTd>
								<DataTd align="center" className="font-mono text-xs tabular-nums">
									<span className="font-semibold">{row.first.used}</span>
									<span className="text-muted-foreground"> / </span>
									<span
										className={
											row.first.remaining > 0
												? 'font-bold text-primary-ink'
												: 'text-muted-foreground'
										}
									>
										{row.first.remaining}
									</span>
								</DataTd>
								<DataTd align="center" className="font-mono text-xs tabular-nums">
									<span className="font-semibold">{row.second.used}</span>
									<span className="text-muted-foreground"> / </span>
									<span
										className={
											row.second.remaining > 0
												? 'font-bold text-primary-ink'
												: 'text-muted-foreground'
										}
									>
										{row.second.remaining}
									</span>
								</DataTd>
							</DataTr>
						))}
					</tbody>
				</DataTable>
			</div>

			{/* When used + that gameweek outcome */}
			<div>
				<p className="mb-2 eyebrow">
					{t('chipPlayLog')}
				</p>
				{stats.chipUsageRows.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t('noChipsPlayed')}</p>
				) : (
					<DataTable minWidthClass="min-w-[24rem]">
						<DataThead>
							<DataTh align="center" className="w-12">
								{t('gameweekShort')}
							</DataTh>
							<DataTh className="w-16">{t('chipHalf')}</DataTh>
							<DataTh>{t('chip')}</DataTh>
							<DataTh align="center" className="w-12">
								{t('pointsShort')}
							</DataTh>
							<DataTh align="center" className="w-12">
								{t('netShort')}
							</DataTh>
							<DataTh align="right" className="w-14">
								{t('gameweekRank')}
							</DataTh>
						</DataThead>
						<tbody>
							{stats.chipUsageRows.map(row => {
								const gw = Number(row.gameweek)
								const half =
									Number.isFinite(gw) && gw > 0
										? halfForGameweek(gw)
										: null
								return (
									<DataTr key={`${row.gameweek}-${row.chip}`}>
										<DataTd align="center" className="text-xs">
											<TeamGameweekLink
												gameweek={row.gameweek}
												className="text-muted-foreground hover:text-primary-ink"
											>
												{row.gameweek}
											</TeamGameweekLink>
										</DataTd>
										<DataTd className="font-mono text-label uppercase tracking-wide text-muted-foreground">
											{half === 'first'
												? t('chipHalfFirstShort')
												: half === 'second'
													? t('chipHalfSecondShort')
													: '—'}
										</DataTd>
										<DataTd className="text-sm font-medium">
											{familyLabel(
												normalizeChipFamily(row.chip) ?? 'WILDCARD',
												t,
											)}
										</DataTd>
										<DataTd
											align="center"
											className="font-display text-sm font-bold tabular-nums"
										>
											{row.points}
										</DataTd>
										<DataTd
											align="center"
											className="font-display text-sm font-bold tabular-nums text-primary-ink"
										>
											{row.netPoints}
										</DataTd>
										<DataTd
											align="right"
											className="font-mono text-xs tabular-nums text-muted-foreground"
										>
											{row.rank == null
												? '—'
												: format.number(row.rank, {
														notation: 'compact',
													})}
										</DataTd>
									</DataTr>
								)
							})}
						</tbody>
					</DataTable>
				)}
			</div>
		</div>
	)
}
