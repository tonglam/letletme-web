import {
	DataTable,
	DataTd,
	DataTh,
	DataThead,
	DataTr
} from '@/components/data/DataTable'
import type { MyFplSelectionRules } from '@/lib/graphql/operations/my-fpl'
import { useFormatter, useTranslations } from 'next-intl'
import { useMemo } from 'react'
import type { TeamSeasonLogs } from '../_lib/team-stats-model'
import { TeamGameweekLink } from './TeamGameweekLink'
import { TeamMetricGrid, TeamMetricTile } from './TeamMetricTile'

const CHIP_ORDER = [
	'WILDCARD',
	'FREE_HIT',
	'BENCH_BOOST',
	'TRIPLE_CAPTAIN',
	'MANAGER'
] as const

type ChipFamily = string

type ChipWindow = {
	key: string
	startEvent: number
	stopEvent: number
	allowances: Record<string, number>
}

function normalizeChipFamily(raw: string): ChipFamily | null {
	const chip = raw.toUpperCase().replace(/[\s-]+/g, '_')
	if (chip === 'NONE' || chip === '') return null
	if (chip === 'WC' || chip === 'WILDCARD') return 'WILDCARD'
	if (chip === 'FH' || chip === 'FREEHIT' || chip === 'FREE_HIT') {
		return 'FREE_HIT'
	}
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
	if (
		chip === 'AM' ||
		chip === 'MANAGER' ||
		chip === 'ASSISTANT_MANAGER' ||
		chip === 'ASSISTANTMANAGER'
	) {
		return 'MANAGER'
	}
	return chip
}

function familyLabel(
	family: ChipFamily,
	t: ReturnType<typeof useTranslations<'TeamStats'>>
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
		case 'MANAGER':
			return t('assistantManager')
		default:
			return family
				.toLowerCase()
				.split('_')
				.map(word => word.charAt(0).toUpperCase() + word.slice(1))
				.join(' ')
	}
}

const emptyChipCounts = (): Record<string, number> => ({})

function orderChipFamilies(families: Iterable<string>): string[] {
	const order = new Map(CHIP_ORDER.map((family, index) => [family, index]))
	return Array.from(new Set(families)).sort((left, right) => {
		const leftIndex = order.get(left as (typeof CHIP_ORDER)[number])
		const rightIndex = order.get(right as (typeof CHIP_ORDER)[number])
		if (leftIndex !== undefined || rightIndex !== undefined) {
			return (
				(leftIndex ?? Number.MAX_SAFE_INTEGER) -
				(rightIndex ?? Number.MAX_SAFE_INTEGER)
			)
		}
		return left.localeCompare(right)
	})
}

function buildChipWindows(rules: MyFplSelectionRules | null): ChipWindow[] {
	if (!rules) return []
	const byWindow = new Map<string, ChipWindow>()
	for (const chip of rules.chips) {
		const family = normalizeChipFamily(chip.name)
		if (!family) continue
		const key = `${chip.startEvent}:${chip.stopEvent}`
		const window = byWindow.get(key) ?? {
			key,
			startEvent: chip.startEvent,
			stopEvent: chip.stopEvent,
			allowances: emptyChipCounts()
		}
		window.allowances[family] = (window.allowances[family] ?? 0) + chip.number
		byWindow.set(key, window)
	}
	return Array.from(byWindow.values()).sort(
		(a, b) => a.startEvent - b.startEvent || a.stopEvent - b.stopEvent
	)
}

function windowLabel(window: ChipWindow): string {
	return window.startEvent === window.stopEvent
		? `GW${window.startEvent}`
		: `GW${window.startEvent}–${window.stopEvent}`
}

export function TeamChipsTab({
	stats,
	rules
}: {
	stats: TeamSeasonLogs
	rules: MyFplSelectionRules | null
}) {
	const t = useTranslations('TeamStats')
	const format = useFormatter()

	const { windows, inventory, summaries } = useMemo(() => {
		const windows = buildChipWindows(rules)
		const usedByWindow = new Map<string, Record<string, number>>()
		for (const window of windows) {
			usedByWindow.set(window.key, emptyChipCounts())
		}

		for (const row of stats.chipUsageRows) {
			const family = normalizeChipFamily(row.chip)
			const gameweek = Number(row.gameweek)
			if (!family || !Number.isFinite(gameweek) || gameweek <= 0) continue
			const window = windows.find(
				item =>
					gameweek >= item.startEvent &&
					gameweek <= item.stopEvent &&
					(item.allowances[family] ?? 0) > 0
			)
			if (window) {
				const used = usedByWindow.get(window.key)!
				used[family] = (used[family] ?? 0) + 1
			}
		}

		const families = orderChipFamilies(
			windows.flatMap(window => Object.keys(window.allowances))
		)
		const inventory = families.map(family => ({
			family,
			label: familyLabel(family, t),
			windows: windows.map(window => {
				const allowance = window.allowances[family] ?? 0
				const used = usedByWindow.get(window.key)?.[family] ?? 0
				return {
					key: window.key,
					allowance,
					used,
					remaining: Math.max(0, allowance - used)
				}
			})
		}))
		const summaries = windows.map(window => {
			const used = families.reduce(
				(total, family) =>
					total + (usedByWindow.get(window.key)?.[family] ?? 0),
				0
			)
			const allowance = families.reduce(
				(total, family) => total + (window.allowances[family] ?? 0),
				0
			)
			return {
				key: window.key,
				label: windowLabel(window),
				used,
				remaining: Math.max(0, allowance - used),
				allowance
			}
		})

		return { windows, inventory, summaries }
	}, [rules, stats.chipUsageRows, t])

	return (
		<div className="space-y-6">
			<div>
				<p className="mb-1 eyebrow">{t('chipBalance')}</p>
				<p className="mb-3 text-xs leading-relaxed text-muted-foreground">
					{windows.length > 0
						? t('chipBalanceHintConfigured')
						: t('chipRulesUnavailable')}
				</p>

				{summaries.length > 0 ? (
					<>
						<TeamMetricGrid
							cols={Math.min(3, Math.max(2, summaries.length)) as 2 | 3}
							className="mb-3"
						>
							{summaries.map(summary => (
								<TeamMetricTile
									key={summary.key}
									label={summary.label}
									value={t('chipWindowValue', {
										used: summary.used,
										left: summary.remaining,
										max: summary.allowance
									})}
									tone="primary"
								/>
							))}
						</TeamMetricGrid>

						<DataTable minWidthClass="min-w-[30rem]">
							<DataThead>
								<DataTh>{t('chip')}</DataTh>
								{windows.map(window => (
									<DataTh
										key={window.key}
										align="center"
										className="w-24"
									>
										{windowLabel(window)}
										<br />
										<span className="font-normal normal-case tracking-normal text-muted-foreground/80">
											{t('chipsUsed')}/{t('chipsRemaining')}
										</span>
									</DataTh>
								))}
							</DataThead>
							<tbody>
								{inventory.map(row => (
									<DataTr key={row.family}>
										<DataTd className="text-sm font-medium">{row.label}</DataTd>
										{row.windows.map(cell => (
											<DataTd
												key={cell.key}
												align="center"
												className="font-mono text-xs tabular-nums"
											>
												{cell.allowance > 0 ? (
													<>
														<span className="font-semibold">{cell.used}</span>
														<span className="text-muted-foreground"> / </span>
														<span
															className={
																cell.remaining > 0
																	? 'font-bold text-primary-ink'
																	: 'text-muted-foreground'
															}
														>
															{cell.remaining}
														</span>
													</>
												) : (
													'—'
												)}
											</DataTd>
										))}
									</DataTr>
								))}
							</tbody>
						</DataTable>
					</>
				) : null}
			</div>

			<div>
				<p className="mb-2 eyebrow">{t('chipPlayLog')}</p>
				{stats.chipUsageRows.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t('noChipsPlayed')}</p>
				) : (
					<DataTable minWidthClass="min-w-[24rem]">
						<DataThead>
							<DataTh
								align="center"
								className="w-12"
							>
								{t('gameweekShort')}
							</DataTh>
							<DataTh className="w-24">{t('chipRuleWindow')}</DataTh>
							<DataTh>{t('chip')}</DataTh>
							<DataTh
								align="center"
								className="w-12"
							>
								{t('pointsShort')}
							</DataTh>
							<DataTh
								align="center"
								className="w-12"
							>
								{t('netShort')}
							</DataTh>
							<DataTh
								align="right"
								className="w-14"
							>
								{t('gameweekRank')}
							</DataTh>
						</DataThead>
						<tbody>
							{stats.chipUsageRows.map(row => {
								const gameweek = Number(row.gameweek)
								const family = normalizeChipFamily(row.chip)
								const window = windows.find(
									item =>
										family !== null &&
										gameweek >= item.startEvent &&
										gameweek <= item.stopEvent &&
										(item.allowances[family] ?? 0) > 0
								)
								return (
									<DataTr key={`${row.gameweek}-${row.chip}`}>
										<DataTd
											align="center"
											className="text-xs"
										>
											<TeamGameweekLink
												gameweek={row.gameweek}
												className="text-muted-foreground hover:text-primary-ink"
											>
												{row.gameweek}
											</TeamGameweekLink>
										</DataTd>
										<DataTd className="font-mono text-label uppercase tracking-wide text-muted-foreground">
											{window ? windowLabel(window) : '—'}
										</DataTd>
										<DataTd className="text-sm font-medium">
											{family ? familyLabel(family, t) : row.chip}
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
												: format.number(row.rank, { notation: 'compact' })}
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
