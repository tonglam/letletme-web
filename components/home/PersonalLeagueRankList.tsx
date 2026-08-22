import {
	buildTournamentStatsQueryString,
	TOURNAMENT_STATS_PATH
} from '@/app/me/tournament/_lib/tournament-stats-url'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { Link } from '@/i18n/navigation'
import type {
	HomeLeagueRank,
	HomeRankDirection
} from '@/lib/graphql/operations/home'
import { cn, formatInteger } from '@/lib/utils'
import { getTranslations } from 'next-intl/server'

const HOME_LEAGUE_RANK_LIMIT = 6

/** Rows come from homePersonalDesk already filtered to invitational leagues. */

type HomeLeagueType = 'CLASSIC' | 'H2H'

function getLeagueType(row: HomeLeagueRank): HomeLeagueType {
	// The key fallback keeps the compact Home desk compatible with an older
	// GraphQL deployment while the explicit field rolls out.
	return row.leagueType === 'H2H' || row.key.toLowerCase().startsWith('h2h:')
		? 'H2H'
		: 'CLASSIC'
}

function MovementBadge({
	direction,
	places
}: {
	direction: HomeRankDirection
	places: number | null
}) {
	if (direction === 'UP') {
		return (
			<span className="font-display text-caption font-semibold tabular-nums text-foreground">
				↑+{places ?? 0}
			</span>
		)
	}
	if (direction === 'DOWN') {
		return (
			<span className="font-display text-caption font-semibold tabular-nums text-destructive">
				↓-{places ?? 0}
			</span>
		)
	}
	if (direction === 'FLAT') {
		return (
			<span className="font-display text-caption font-semibold text-muted-foreground">
				—
			</span>
		)
	}
	return <span className="text-caption text-muted-foreground/50">·</span>
}

function LeagueRow({
	row,
	ariaLabel,
	elementTiming
}: {
	row: HomeLeagueRank
	ariaLabel: string
	elementTiming?: string
}) {
	const rankDisplay = row.rank == null ? '—' : formatInteger(row.rank)
	const body = (
		<>
			<span
				className="min-w-0 flex-1 truncate text-sm font-medium leading-tight"
				{...(elementTiming ? { elementtiming: elementTiming } : {})}
			>
				{row.name}
			</span>
			<span
				className="flex shrink-0 items-center gap-2 pl-2"
				aria-label={ariaLabel}
			>
				<span className="font-display text-sm font-semibold tabular-nums tracking-tight text-primary-ink">
					<span className="text-muted-foreground">#</span>
					{rankDisplay}
				</span>
				<span className="flex w-8 justify-end">
					<MovementBadge
						direction={row.movement.direction}
						places={row.movement.places}
					/>
				</span>
			</span>
		</>
	)
	const rowClass = cn(
		'flex min-h-11 w-full items-center gap-2 border-b border-border/40 py-2.5 last:border-b-0',
		row.tournamentId != null &&
			'transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
	)

	if (row.tournamentId == null) {
		return <li className={rowClass}>{body}</li>
	}
	const query = buildTournamentStatsQueryString({
		tournamentId: row.tournamentId,
		view: 'season'
	})
	return (
		<li>
			<Link
				href={`${TOURNAMENT_STATS_PATH}?${query}`}
				prefetch={false}
				className={rowClass}
			>
				{body}
			</Link>
		</li>
	)
}

export async function PersonalLeagueRankList({
	rows,
	readyKey
}: {
	rows: HomeLeagueRank[]
	readyKey: string
}) {
	const t = await getTranslations('Home')
	const groups: Array<{
		type: HomeLeagueType
		label: string
		rows: HomeLeagueRank[]
	}> = [
		{
			type: 'CLASSIC',
			label: t('personalLeagueClassic'),
			rows: rows.filter(row => getLeagueType(row) === 'CLASSIC')
		},
		{
			type: 'H2H',
			label: t('personalLeagueH2H'),
			rows: rows.filter(row => getLeagueType(row) === 'H2H')
		}
	]
	const renderRow = (row: HomeLeagueRank, elementTiming?: string) => {
		const rankDisplay = row.rank == null ? '—' : formatInteger(row.rank)
		const ariaMove =
			row.movement.direction === 'UP'
				? t('personalLeagueUp', { count: row.movement.places ?? 0 })
				: row.movement.direction === 'DOWN'
					? t('personalLeagueDown', { count: row.movement.places ?? 0 })
					: row.movement.direction === 'FLAT'
						? t('personalLeagueFlat')
						: t('personalLeagueNoChange')
		return (
			<LeagueRow
				key={row.key}
				row={row}
				ariaLabel={`${t('personalLeagueRank', { rank: rankDisplay })}, ${ariaMove}`}
				elementTiming={elementTiming}
			/>
		)
	}
	const renderGroup = (group: (typeof groups)[number], groupIndex: number) => {
		const initialRows = group.rows.slice(0, HOME_LEAGUE_RANK_LIMIT)
		const remainingRows = group.rows.slice(HOME_LEAGUE_RANK_LIMIT)
		const headingId = `home-league-group-${group.type.toLowerCase()}`

		return (
			<section
				key={group.type}
				className="min-w-0 rounded-lg border border-border/70 bg-background/45 p-3 shadow-sm"
				aria-labelledby={headingId}
				data-home-league-group={group.type.toLowerCase()}
			>
				<div className="mb-2 flex items-center justify-between gap-3">
					<h3
						id={headingId}
						className="font-display text-sm font-bold uppercase tracking-wide text-primary-ink"
						{...(groupIndex === 0
							? { elementtiming: 'home-league-ranks' }
							: {})}
					>
						{group.label}
					</h3>
					<span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
						{group.rows.length}
					</span>
				</div>

				{group.rows.length === 0 ? (
					<p className="rounded-md border border-dashed border-border/70 px-3 py-3 text-center text-xs text-muted-foreground">
						{t('personalLeaguesTypeEmpty', { type: group.label })}
					</p>
				) : (
					<>
						<ul className="rounded-lg border surface-inset-soft px-3">
							{initialRows.map(row => renderRow(row))}
						</ul>
						{remainingRows.length > 0 ? (
							<details className="group mt-2.5">
								<summary className="flex h-9 w-full cursor-pointer list-none items-center justify-center gap-1.5 rounded-md border border-border/80 bg-background px-3 text-xs font-semibold shadow-sm transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden">
									<span className="group-open:hidden">
										{t('personalLeaguesShowMore')}
									</span>
									<span className="hidden group-open:inline">
										{t('personalLeaguesShowLess')}
									</span>
									<span
										className="transition-transform group-open:rotate-180"
										aria-hidden="true"
									>
										⌄
									</span>
								</summary>
								<ul className="mt-2 rounded-lg border surface-inset-soft px-3">
									{remainingRows.map(row => renderRow(row))}
								</ul>
							</details>
						) : null}
					</>
				)}
			</section>
		)
	}

	return (
		<div data-home-league-ranks-ready="true">
			{rows.length === 0 ? (
				<p
					className="min-h-11 rounded-md border border-dashed border-border/70 px-3 py-3 text-center text-xs text-muted-foreground"
					{...{ elementtiming: 'home-league-ranks' }}
				>
					{t('personalLeaguesEmpty')}
				</p>
			) : (
				<div className="grid gap-3 md:grid-cols-2">
					{groups.map(renderGroup)}
				</div>
			)}
			<RouteReadyMarker
				name="HOME_LEAGUE_RANKS_READY"
				readyKey={readyKey}
				elementTiming="home-league-ranks"
				audienceHint="session-hint"
				goodMs={500}
				poorMs={1_000}
			/>
		</div>
	)
}
