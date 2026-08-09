'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { TeamSeasonLogs } from '../_lib/team-stats-model'
import { TeamGameweekLink } from './TeamGameweekLink'
import {
	TeamMetricChip,
	TeamMetricGrid,
	TeamMetricTile,
} from './TeamMetricTile'

type HistoryRow = TeamSeasonLogs['historyRows'][number]

const INITIAL_VISIBLE = 8
const PAGE_SIZE = 10

function isTripleCaptain(chip: string | undefined): boolean {
	const c = String(chip ?? '')
		.toUpperCase()
		.replace(/[\s-]+/g, '_')
	return (
		c === 'TRIPLE_CAPTAIN' ||
		c === 'TC' ||
		c === '3XC' ||
		c === 'TRIPLECAPTAIN'
	)
}

/**
 * Season captain log — summary + week rows (name + multiplied captain points).
 */
export function TeamCaptainsTab({ logs }: { logs: TeamSeasonLogs }) {
	const t = useTranslations('TeamStats')
	const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)

	const chipByGw = useMemo(() => {
		const map = new Map<string, string>()
		for (const row of logs.chipUsageRows) {
			map.set(row.gameweek, row.chip)
		}
		for (const row of logs.transferRows) {
			if (row.chip && row.chip !== 'NONE' && !map.has(row.gameweek)) {
				map.set(row.gameweek, row.chip)
			}
		}
		return map
	}, [logs.chipUsageRows, logs.transferRows])

	const rows = useMemo(() => {
		return [...logs.historyRows].sort(
			(a, b) => Number(b.gameweek) - Number(a.gameweek),
		)
	}, [logs.historyRows])

	const summary = useMemo(() => {
		let totalPts = 0
		let weeksWithCaptain = 0
		const byName = new Map<
			string,
			{ name: string; team: string; weeks: number; points: number }
		>()

		for (const row of rows) {
			if (!row.captainName) continue
			weeksWithCaptain += 1
			totalPts += row.captainPoints
			const key = `${row.captainName}|${row.captainTeam}`
			const cur = byName.get(key) ?? {
				name: row.captainName,
				team: row.captainTeam,
				weeks: 0,
				points: 0,
			}
			cur.weeks += 1
			cur.points += row.captainPoints
			byName.set(key, cur)
		}

		const ranked = Array.from(byName.values()).sort(
			(a, b) => b.weeks - a.weeks || b.points - a.points,
		)
		const avg =
			weeksWithCaptain > 0 ? Math.round(totalPts / weeksWithCaptain) : 0

		return {
			totalPts,
			avg,
			topThree: ranked.slice(0, 3),
		}
	}, [rows])

	useEffect(() => {
		setVisibleCount(INITIAL_VISIBLE)
	}, [logs.historyRows])

	const shown = rows.slice(0, visibleCount)
	const remaining = Math.max(0, rows.length - visibleCount)

	if (rows.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">{t('noCaptainHistory')}</p>
		)
	}

	return (
		<div className="space-y-3">
			<p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
				{t('captainPointsExplain')}
			</p>

			<TeamMetricGrid cols={2} className="sm:max-w-sm">
				<TeamMetricTile
					label={t('captainTotalPts')}
					value={summary.totalPts}
					tone="primary"
				/>
				<TeamMetricTile label={t('captainAvgPts')} value={summary.avg} />
			</TeamMetricGrid>

			{summary.topThree.length > 0 ? (
				<ul className="flex flex-wrap gap-1.5">
					{summary.topThree.map(c => (
						<li key={`${c.name}-${c.team}`}>
							<TeamMetricChip>
								<span className="font-medium text-white">{c.name}</span>
								{c.team ? (
									<span className="font-mono text-[10px] text-white/70">
										{c.team}
									</span>
								) : null}
								<span className="font-mono text-[10px] tabular-nums text-white/70">
									×{c.weeks}
								</span>
							</TeamMetricChip>
						</li>
					))}
				</ul>
			) : null}

			<div className="overflow-hidden rounded-lg border border-border/70">
				<div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					<span className="w-9 shrink-0">{t('gameweekShort')}</span>
					<span className="min-w-0 flex-1">{t('captain')}</span>
					<span className="w-10 shrink-0 text-right">{t('captainPtsShort')}</span>
				</div>
				<ul className="divide-y divide-border/50">
					{shown.map(row => (
						<CaptainWeekRow
							key={row.gameweek}
							row={row}
							chip={chipByGw.get(row.gameweek)}
						/>
					))}
				</ul>
			</div>

			{remaining > 0 ? (
				<div className="flex flex-col items-center gap-1">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 w-full text-xs sm:w-auto"
						onClick={() =>
							setVisibleCount(n => Math.min(n + PAGE_SIZE, rows.length))
						}
					>
						{t('captainShowMore', {
							count: Math.min(PAGE_SIZE, remaining),
						})}
					</Button>
					{remaining > PAGE_SIZE ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 text-xs text-muted-foreground"
							onClick={() => setVisibleCount(rows.length)}
						>
							{t('captainShowAllRemaining', { count: remaining })}
						</Button>
					) : null}
				</div>
			) : rows.length > INITIAL_VISIBLE ? (
				<div className="flex justify-center">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 text-xs text-muted-foreground"
						onClick={() => setVisibleCount(INITIAL_VISIBLE)}
					>
						{t('captainShowLess')}
					</Button>
				</div>
			) : null}
		</div>
	)
}

function CaptainWeekRow({
	row,
	chip,
}: {
	row: HistoryRow
	chip?: string
}) {
	const t = useTranslations('TeamStats')
	const tc = isTripleCaptain(chip)
	const blank = !row.captainName

	return (
		<li
			className={cn(
				'flex items-center gap-2 px-3 py-2',
				blank && 'bg-muted/10',
				tc && 'bg-plum/[0.07]',
			)}
		>
			<TeamGameweekLink
				gameweek={row.gameweek}
				className="w-9 shrink-0 text-xs text-muted-foreground hover:text-primary-ink"
			>
				{row.gameweek}
			</TeamGameweekLink>

			<span className="flex min-w-0 flex-1 items-center gap-1.5">
				{blank ? (
					<span className="text-sm text-muted-foreground">
						{t('captainUnknown')}
					</span>
				) : (
					<>
						<span className="truncate text-sm font-semibold leading-tight">
							{row.captainName}
						</span>
						{row.captainTeam ? (
							<span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
								{row.captainTeam}
							</span>
						) : null}
						{tc ? (
							<span className="shrink-0 rounded bg-plum px-1.5 py-px font-display text-[10px] font-bold uppercase tracking-wide text-electric">
								3C
							</span>
						) : null}
					</>
				)}
			</span>

			<span
				className={cn(
					'w-10 shrink-0 text-right font-display text-base font-bold tabular-nums leading-none',
					!blank && row.captainPoints > 0
						? 'text-primary-ink'
						: 'text-muted-foreground',
				)}
			>
				{blank ? '—' : row.captainPoints}
			</span>
		</li>
	)
}
