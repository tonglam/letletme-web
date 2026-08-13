'use client'

import { Badge } from '@/components/ui/badge'
import { marketAvailabilityStatusKey } from '@/lib/market-availability'
import type {
	PlayerAvailability,
	PlayerDetailData,
	PlayerDetailFixture
} from '@/lib/graphql/operations/players'
import { positionBadgeClass } from '@/lib/position-style'
import { cn, normalizePosition } from '@/lib/utils'
import { useFormatter, useTranslations } from 'next-intl'
import {
	DIFFICULTY_COLORS,
	formatPrice,
	formatPriceDiff
} from './PlayerStatPrimitives'

type OverallKpi = 'total' | 'form' | 'pointsPerMillion'

function elementPositionCode(player: PlayerDetailData): string {
	const fromName = normalizePosition(player.elementTypeName)
	if (fromName !== 'UNK') return fromName
	switch (player.elementType) {
		case 1:
			return 'GKP'
		case 2:
			return 'DEF'
		case 3:
			return 'MID'
		case 4:
			return 'FWD'
		default:
			return 'UNK'
	}
}

export function pointsPerMillion(player: PlayerDetailData): number | null {
	if (
		player.statsContext.scope !== 'CURRENT_SEASON' ||
		player.totalPoints == null ||
		player.price <= 0
	) {
		return null
	}
	return player.totalPoints / (player.price / 10)
}

function KpiCell({
	label,
	value,
	hint,
	emphasized = false
}: {
	label: string
	value: string | number | null
	hint?: string
	emphasized?: boolean
}) {
	return (
		<div className="flex min-h-14 flex-col justify-center rounded-md border border-border/60 bg-muted/10 px-2.5 py-1.5">
			<p className="truncate font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
				{label}
			</p>
			<p
				className={cn(
					'mt-0.5 truncate font-display text-lg font-bold tabular-nums tracking-tight',
					emphasized && 'text-primary-ink'
				)}
			>
				{value ?? '—'}
			</p>
			{hint ? (
				<p className="truncate text-[10px] text-muted-foreground">{hint}</p>
			) : null}
		</div>
	)
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
		.sort(([a], [b]) => a - b)
		.slice(0, 3)
}

function NextFixturesStrip({
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
			<p className="text-xs text-muted-foreground">{t('nextFixturesEmpty')}</p>
		)
	}

	return (
		<div className="flex flex-wrap gap-1.5">
			{upcoming.map(([gameweek, fixtures]) => {
				const blank = fixtures.every(fixture => fixture.bgw)
				return (
					<span
						key={gameweek}
						className="inline-flex min-h-7 items-center gap-1 rounded-md border border-border/60 bg-muted/20 px-2 text-[11px] tabular-nums"
					>
						<span className="font-medium text-muted-foreground">
							{t('gameweekShort', { gameweek })}
						</span>
						{blank ? (
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
										<span className="text-muted-foreground">
											{t('difficultyShort', { difficulty: fixture.difficulty })}
										</span>
									</span>
								))
						)}
					</span>
				)
			})}
		</div>
	)
}

function AvailabilityPulse({
	availability
}: {
	availability: PlayerAvailability | null
}) {
	const tMarket = useTranslations('Market')
	const t = useTranslations('PlayerStats')
	const format = useFormatter()

	if (!availability) {
		return (
			<span className="text-xs text-muted-foreground">
				{t('availabilityNone')}
			</span>
		)
	}

	const statusKey = marketAvailabilityStatusKey(availability.status)
	const chance =
		availability.chanceOfPlayingThisRound ??
		availability.chanceOfPlayingNextRound
	const observed = new Date(`${availability.observedDate}T00:00:00Z`)
	const observedLabel = Number.isNaN(observed.getTime())
		? availability.observedDate
		: format.dateTime(observed, { dateStyle: 'medium', timeZone: 'UTC' })

	return (
		<div className="min-w-0">
			<div className="flex flex-wrap items-center gap-2">
				<Badge
					variant="outline"
					className="text-[10px]"
				>
					{tMarket(`status.${statusKey}`)}
				</Badge>
				{chance != null ? (
					<span className="text-xs text-muted-foreground">
						{t('availabilityChance', { percent: chance })}
					</span>
				) : null}
				<span className="text-xs text-muted-foreground">
					{t('availabilityObserved', { date: observedLabel })}
				</span>
			</div>
			{availability.news.trim() ? (
				<p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/90">
					{availability.news.trim()}
				</p>
			) : null}
		</div>
	)
}

function OverallCardBody({
	player,
	anchorGw,
	seasonStatsAvailable,
	accent,
	emphasizedKpis = new Set<OverallKpi>()
}: {
	player: PlayerDetailData
	anchorGw: number
	seasonStatsAvailable: boolean
	accent?: 'primary' | 'compare'
	emphasizedKpis?: Set<OverallKpi>
}) {
	const t = useTranslations('PlayerStats')
	const tl = useTranslations('PlayerStats.labels')
	const priceDiff = formatPriceDiff(player.price, player.startPrice)
	const code = elementPositionCode(player)
	const hasSeasonStats =
		seasonStatsAvailable && player.statsContext.scope === 'CURRENT_SEASON'
	const ppm = pointsPerMillion(player)

	return (
		<div
			className={cn(
				'min-w-0 rounded-lg border border-border/60 bg-card/50 px-3 py-3',
				accent === 'compare' && 'ring-1 ring-warning/40',
				accent === 'primary' && 'ring-1 ring-primary/25'
			)}
		>
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				<Badge
					className={cn(
						positionBadgeClass(code),
						'shrink-0 px-1.5 py-0 text-[10px] font-bold'
					)}
				>
					{code === 'UNK' ? '—' : code}
				</Badge>
				<span className="truncate font-display text-base font-bold uppercase tracking-wide">
					{player.webName}
				</span>
				<span className="text-sm text-muted-foreground">
					{player.teamShortName}
				</span>
				<span className="text-sm font-medium tabular-nums">
					{formatPrice(player.price)}
					{priceDiff ? (
						<span
							className={cn(
								'ml-1 text-xs',
								priceDiff.startsWith('+') ? 'text-success' : 'text-destructive'
							)}
						>
							{priceDiff}
						</span>
					) : null}
				</span>
			</div>

			<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
				{hasSeasonStats ? (
					<>
						<KpiCell
							label={tl('totalPoints')}
							value={player.totalPoints}
							emphasized={emphasizedKpis.has('total')}
						/>
						<KpiCell
							label={tl('form')}
							value={player.form}
							hint={tl('formHint')}
							emphasized={emphasizedKpis.has('form')}
						/>
					</>
				) : null}
				<KpiCell
					label={tl('selected')}
					value={
						player.selectedByPercent == null
							? null
							: `${player.selectedByPercent}%`
					}
				/>
				{hasSeasonStats ? (
					<KpiCell
						label={tl('pointsPerMillion')}
						value={ppm == null ? null : ppm.toFixed(1)}
						emphasized={emphasizedKpis.has('pointsPerMillion')}
					/>
				) : null}
			</div>

			<div className="mt-3 border-t border-border/50 pt-3">
				<p className="mb-1 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					{t('availabilityTitle')}
				</p>
				<AvailabilityPulse availability={player.availability} />
			</div>

			<div className="mt-3 border-t border-border/50 pt-3">
				<p className="mb-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					{t('nextFixturesLabel')}
				</p>
				<NextFixturesStrip
					player={player}
					anchorGw={anchorGw}
				/>
			</div>
		</div>
	)
}

function winningKpis(
	first: PlayerDetailData,
	second: PlayerDetailData
): [Set<OverallKpi>, Set<OverallKpi>] {
	const firstWins = new Set<OverallKpi>()
	const secondWins = new Set<OverallKpi>()
	if (first.elementType !== second.elementType) return [firstWins, secondWins]

	const values: Array<[OverallKpi, number | null, number | null]> = [
		['total', first.totalPoints, second.totalPoints],
		['form', first.form, second.form],
		['pointsPerMillion', pointsPerMillion(first), pointsPerMillion(second)]
	]
	for (const [key, firstValue, secondValue] of values) {
		if (firstValue == null || secondValue == null || firstValue === secondValue)
			continue
		if (firstValue > secondValue) firstWins.add(key)
		else secondWins.add(key)
	}
	return [firstWins, secondWins]
}

export function PlayerOverallCard({
	player,
	comparison,
	anchorGw,
	seasonStatsAvailable
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
	anchorGw: number
	seasonStatsAvailable: boolean
}) {
	const t = useTranslations('PlayerStats')
	const isCompare = Boolean(comparison)
	const [firstWins, secondWins] = comparison
		? winningKpis(player, comparison)
		: [new Set<OverallKpi>(), new Set<OverallKpi>()]

	return (
		<section
			aria-label={t('overallTitle')}
			className="scroll-mt-36"
		>
			<h2 className="mb-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
				{t('overallTitle')}
			</h2>
			{seasonStatsAvailable &&
			player.statsContext.scope === 'CURRENT_SEASON' &&
			player.statsContext.asOfEventId != null ? (
				<p className="-mt-1 mb-2 text-[11px] text-muted-foreground">
					{t('anchorLabel', { gw: player.statsContext.asOfEventId })}
				</p>
			) : null}
			{isCompare && comparison ? (
				<div className="grid gap-2 sm:grid-cols-2">
					<OverallCardBody
						player={player}
						anchorGw={anchorGw}
						seasonStatsAvailable={seasonStatsAvailable}
						emphasizedKpis={firstWins}
						accent="primary"
					/>
					<OverallCardBody
						player={comparison}
						anchorGw={anchorGw}
						seasonStatsAvailable={seasonStatsAvailable}
						emphasizedKpis={secondWins}
						accent="compare"
					/>
				</div>
			) : (
				<OverallCardBody
					player={player}
					anchorGw={anchorGw}
					seasonStatsAvailable={seasonStatsAvailable}
				/>
			)}
		</section>
	)
}

export function StickyPlayerIdentity({
	player,
	comparison
}: {
	player: PlayerDetailData
	comparison: PlayerDetailData | null
}) {
	const t = useTranslations('PlayerStats')
	const priceDiff = formatPriceDiff(player.price, player.startPrice)

	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
			<span className="font-display font-bold uppercase tracking-wide">
				{player.webName}
			</span>
			<span className="text-muted-foreground">{player.teamShortName}</span>
			<span className="tabular-nums font-medium">
				{formatPrice(player.price)}
				{priceDiff ? (
					<span
						className={cn(
							'ml-1 text-xs',
							priceDiff.startsWith('+') ? 'text-success' : 'text-destructive'
						)}
					>
						{priceDiff}
					</span>
				) : null}
			</span>
			{comparison ? (
				<>
					<span className="text-muted-foreground">{t('versus')}</span>
					<span className="font-display font-bold uppercase tracking-wide">
						{comparison.webName}
					</span>
					<span className="text-muted-foreground">
						{comparison.teamShortName}
					</span>
				</>
			) : null}
		</div>
	)
}
