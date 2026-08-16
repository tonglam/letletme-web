import { Badge } from '@/components/ui/badge'
import { StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { positionBadgeClass } from '@/lib/position-style'
import { isSquadStarter } from '@/lib/squad-picks'
import { cn, normalizePosition } from '@/lib/utils'
import { Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { EventPickViewModel } from '../_lib/team-stats-model'

type Pick = EventPickViewModel
type PosCode = 'GKP' | 'DEF' | 'MID' | 'FWD'

function positionCode(value: string): PosCode {
	const n = value.toUpperCase()
	if (n === 'GOALKEEPER' || n === 'GKP') return 'GKP'
	if (n === 'DEFENDER' || n === 'DEF') return 'DEF'
	if (n === 'MIDFIELDER' || n === 'MID') return 'MID'
	if (n === 'FORWARD' || n === 'FWD') return 'FWD'
	const normalized = normalizePosition(value).toUpperCase()
	if (
		normalized === 'GKP' ||
		normalized === 'DEF' ||
		normalized === 'MID' ||
		normalized === 'FWD'
	) {
		return normalized
	}
	return 'MID'
}

const POSITION_ORDER: Record<PosCode, number> = {
	GKP: 0,
	DEF: 1,
	MID: 2,
	FWD: 3
}

function isBenchBoostChip(chip: string | null | undefined): boolean {
	const normalized = chip?.toUpperCase().replace(/[\s-]+/g, '_') ?? ''
	return (
		normalized === 'BB' ||
		normalized === 'BBOOST' ||
		normalized === 'BENCH_BOOST'
	)
}

function formatXg(value: number | null | undefined): string {
	if (value == null || Number.isNaN(value)) return '—'
	return value.toFixed(1)
}

function fixtureLine(pick: Pick): string {
	const opp = pick.againstShortName?.trim()
	if (!opp) return ''
	const home = String(pick.wasHome).toUpperCase()
	const venue =
		home === 'TRUE' || home === '1' || home === 'H' || home === 'HOME'
			? 'H'
			: home === 'FALSE' || home === '0' || home === 'A' || home === 'AWAY'
				? 'A'
				: ''
	const score = pick.score?.trim()
	if (venue && score) return `${venue} ${opp} ${score}`
	if (venue) return `${venue} ${opp}`
	if (score) return `${opp} ${score}`
	return opp
}

/** Position-aware mini stats — same language as live points rows. */
function miniStats(
	pick: Pick,
	pos: PosCode
): Array<{ label: string; value: string; emphasize?: boolean }> {
	const min = String(pick.minutes)
	if (pos === 'GKP') {
		return [
			{ label: 'MIN', value: min, emphasize: pick.minutes > 0 },
			{ label: 'SV', value: String(pick.saves), emphasize: pick.saves > 0 },
			{
				label: 'CS',
				value: String(pick.cleanSheets),
				emphasize: pick.cleanSheets > 0
			},
			{ label: 'BPS', value: String(pick.bps) },
			{ label: 'B', value: String(pick.bonus), emphasize: pick.bonus > 0 }
		]
	}
	if (pos === 'DEF') {
		return [
			{ label: 'MIN', value: min, emphasize: pick.minutes > 0 },
			{
				label: 'CS',
				value: String(pick.cleanSheets),
				emphasize: pick.cleanSheets > 0
			},
			{
				label: 'G',
				value: String(pick.goalsScored),
				emphasize: pick.goalsScored > 0
			},
			{ label: 'A', value: String(pick.assists), emphasize: pick.assists > 0 },
			{ label: 'B', value: String(pick.bonus), emphasize: pick.bonus > 0 }
		]
	}
	if (pos === 'MID') {
		return [
			{ label: 'MIN', value: min, emphasize: pick.minutes > 0 },
			{
				label: 'G',
				value: String(pick.goalsScored),
				emphasize: pick.goalsScored > 0
			},
			{ label: 'A', value: String(pick.assists), emphasize: pick.assists > 0 },
			{
				label: 'xGI',
				value: formatXg(pick.expectedGoalInvolvements)
			},
			{ label: 'B', value: String(pick.bonus), emphasize: pick.bonus > 0 }
		]
	}
	return [
		{ label: 'MIN', value: min, emphasize: pick.minutes > 0 },
		{
			label: 'G',
			value: String(pick.goalsScored),
			emphasize: pick.goalsScored > 0
		},
		{ label: 'A', value: String(pick.assists), emphasize: pick.assists > 0 },
		{ label: 'xG', value: formatXg(pick.expectedGoals) },
		{ label: 'B', value: String(pick.bonus), emphasize: pick.bonus > 0 }
	]
}

function SquadPickRow({ pick }: { pick: Pick }) {
	const t = useTranslations('TeamStats')
	const pos = positionCode(pick.elementTypeName)
	const fixture = fixtureLine(pick)
	const stats = miniStats(pick, pos)
	const isBench = !isSquadStarter(pick)

	return (
		<div
			className={cn(
				'rounded-lg border bg-card px-2.5 py-2 sm:px-3 sm:py-2.5',
				isBench && 'border-dashed bg-muted/25',
				!isBench && 'border-border/70'
			)}
		>
			{/*
			  Live-points style single row:
			  [POS][TEAM][NAME····]  [fixture]  [MIN G A …]  [PTS]
			*/}
			<div
				className="grid w-full items-center gap-x-2 sm:gap-x-3"
				style={{
					gridTemplateColumns:
						'auto auto minmax(4.5rem, 9rem) minmax(0, 1fr) auto'
				}}
			>
				<Badge
					className={cn(
						'h-5 shrink-0 px-1.5 font-display text-label font-bold tracking-wide',
						positionBadgeClass(pos)
					)}
				>
					{pos}
				</Badge>

				<span className="w-8 shrink-0 font-mono text-caption font-semibold uppercase tracking-wide text-muted-foreground">
					{pick.teamShortName || '—'}
				</span>

				<div className="flex min-w-0 flex-col gap-0.5">
					<div className="flex min-w-0 items-center gap-1">
						<span className="truncate font-display text-sm font-bold uppercase tracking-wide">
							{pick.webName}
						</span>
						{pick.isCaptain ? (
							<span className="shrink-0 rounded-sm bg-plum px-1 py-px font-mono text-label font-bold text-electric">
								C
							</span>
						) : null}
						{pick.isViceCaptain ? (
							<span className="shrink-0 rounded-sm border border-plum/30 bg-plum/10 px-1 py-px font-mono text-label font-bold text-plum">
								V
							</span>
						) : null}
						{pick.autoSub ? (
							<span className="shrink-0 rounded-sm border border-border px-1 py-px font-mono text-micro font-semibold uppercase text-muted-foreground">
								{t('autoSubShort')}
							</span>
						) : null}
						{pick.multiplier > 1 ? (
							<span className="shrink-0 font-mono text-label font-bold text-muted-foreground">
								×{pick.multiplier}
							</span>
						) : null}
					</div>
					{fixture ? (
						<span className="truncate font-mono text-label tabular-nums text-muted-foreground">
							{fixture}
						</span>
					) : null}
				</div>

				{/* Mini stats */}
				<div
					className="hidden min-w-0 sm:grid"
					style={{
						gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`
					}}
				>
					{stats.map(stat => (
						<div
							key={stat.label}
							className="min-w-0 px-0.5 text-center"
						>
							<div className="truncate font-display text-micro font-semibold uppercase tracking-wider text-muted-foreground sm:text-micro">
								{stat.label}
							</div>
							<div
								className={cn(
									'truncate font-mono text-xs tabular-nums',
									stat.emphasize
										? 'font-semibold text-foreground'
										: 'text-muted-foreground'
								)}
							>
								{stat.value}
							</div>
						</div>
					))}
				</div>

				{/* Points */}
				<div className="min-w-[2.75rem] text-right">
					<div className="font-display text-micro font-semibold uppercase tracking-wider text-muted-foreground sm:text-micro">
						{t('pointsShort')}
					</div>
					<div
						className={cn(
							'font-display text-lg font-bold tabular-nums tracking-tight sm:text-xl',
							pick.totalPoints > 0
								? 'text-primary-ink'
								: 'text-muted-foreground'
						)}
					>
						{pick.totalPoints}
					</div>
				</div>
			</div>

			{/* Mobile stats strip */}
			<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/50 pt-2 sm:hidden">
				{stats.map(stat => (
					<span
						key={stat.label}
						className="font-mono text-caption tabular-nums"
					>
						<span className="text-muted-foreground">{stat.label} </span>
						<span
							className={
								stat.emphasize
									? 'font-semibold text-foreground'
									: 'text-muted-foreground'
							}
						>
							{stat.value}
						</span>
					</span>
				))}
			</div>
		</div>
	)
}

function SquadGroup({
	title,
	titleId,
	picks,
	emptyLabel
}: {
	title: string
	titleId: string
	picks: Pick[]
	emptyLabel: string
}) {
	return (
		<section aria-labelledby={titleId}>
			<h3
				id={titleId}
				className="mb-2.5 px-0.5 font-display text-sm font-bold uppercase tracking-caps text-muted-foreground"
			>
				{title}
			</h3>
			{picks.length === 0 ? (
				<p className="text-sm text-muted-foreground">{emptyLabel}</p>
			) : (
				<div className="space-y-2">
					{picks.map(pick => (
						<SquadPickRow
							key={`${pick.position}-${pick.webName}`}
							pick={pick}
						/>
					))}
				</div>
			)}
		</section>
	)
}

/** Live-points-style squad: card rows with fixture + mini stats. */
export function TeamSquadSection({
	picks,
	eventChip
}: {
	picks: EventPickViewModel[]
	eventChip?: string | null
}) {
	const t = useTranslations('TeamStats')
	if (picks.length === 0) {
		return (
			<StatsSectionCard
				icon={Users}
				title={t('gameweekSquad')}
			>
				<p
					className="text-sm text-muted-foreground"
					role="status"
				>
					{t('noPicks')}
				</p>
			</StatsSectionCard>
		)
	}
	const sortByPosition = (a: Pick, b: Pick) =>
		POSITION_ORDER[positionCode(a.elementTypeName)] -
			POSITION_ORDER[positionCode(b.elementTypeName)] || a.position - b.position
	const starters = picks.filter(isSquadStarter).sort(sortByPosition)
	const bench = picks.filter(pick => !isSquadStarter(pick)).sort(sortByPosition)

	return (
		<div className="mb-0">
			<StatsSectionCard
				icon={Users}
				title={t('gameweekSquad')}
			>
				<div className="space-y-5">
					<SquadGroup
						title={t('startingEleven')}
						titleId="team-xi-heading"
						picks={starters}
						emptyLabel={t('noPicks')}
					/>
					<div className="border-t border-border/70 pt-4">
						<SquadGroup
							title={
								isBenchBoostChip(eventChip)
									? t('substitutesBenchBoost')
									: t('substitutes')
							}
							titleId="team-bench-heading"
							picks={bench}
							emptyLabel={t('noBench')}
						/>
					</div>
				</div>
			</StatsSectionCard>
		</div>
	)
}
