import {
	buildTournamentStatsQueryString,
	TOURNAMENT_STATS_PATH
} from '@/app/me/tournament/_lib/tournament-stats-url'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import {
	PersonalLeagueCarousel,
	type PersonalLeagueCarouselSlide
} from '@/components/home/PersonalLeagueCarousel'
import { Link } from '@/i18n/navigation'
import type {
	HomeH2HMatchupSide,
	HomeLeagueRank,
	HomeRankDirection
} from '@/lib/graphql/operations/home'
import { cn, formatInteger } from '@/lib/utils'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

/** Rows come from homePersonalDesk already filtered to home-visible leagues. */

type PersonalLeagueSection = 'CLASSIC' | 'H2H' | 'CUPS'

const HOME_LEAGUE_PREVIEW_LIMIT = 10

function LeagueVisibilityBadge({
	visibility,
	labels
}: {
	visibility: HomeLeagueRank['visibility']
	labels: { privateLeague: string; publicLeague: string }
}) {
	const isPublic = visibility === 'PUBLIC'
	return (
		<span
			data-home-league-visibility={visibility.toLowerCase()}
			className={cn(
				'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none',
				isPublic
					? 'border-primary/25 bg-primary/10 text-primary-ink'
					: 'border-border/70 bg-muted/50 text-muted-foreground'
			)}
		>
			{isPublic ? labels.publicLeague : labels.privateLeague}
		</span>
	)
}

function getLeagueType(
	row: HomeLeagueRank
): Exclude<PersonalLeagueSection, 'CUPS'> {
	return row.leagueType
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

function ClassicLeagueRow({
	row,
	ariaLabel,
	visibilityLabels
}: {
	row: HomeLeagueRank
	ariaLabel: string
	visibilityLabels: { privateLeague: string; publicLeague: string }
}) {
	const rankDisplay = row.rank == null ? '—' : formatInteger(row.rank)
	const body = (
		<>
			<span className="flex min-w-0 flex-1 items-center gap-2">
				<LeagueVisibilityBadge
					visibility={row.visibility}
					labels={visibilityLabels}
				/>
				<span
					className="min-w-0 flex-1 truncate text-sm font-medium leading-tight"
					title={row.name}
				>
					{row.name}
				</span>
			</span>
			<span
				className="flex shrink-0 items-center gap-2 pl-2"
				aria-label={ariaLabel}
			>
				<span className="font-display text-sm font-semibold tabular-nums tracking-tight text-primary-ink">
					<span className="text-muted-foreground">#</span>
					{rankDisplay}
				</span>
				<span className="flex min-w-8 justify-end">
					{row.rankState === 'READY' ? (
						<MovementBadge
							direction={row.movement.direction}
							places={row.movement.places}
						/>
					) : null}
				</span>
			</span>
		</>
	)
	const rowClass = cn(
		'flex min-h-11 w-full items-center gap-2 border-b border-border/40 py-2.5 last:border-b-0',
		row.tournamentId != null &&
			'rounded-sm transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
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

function H2HSide({
	side,
	align,
	fallback,
	displayOverride
}: {
	side: HomeH2HMatchupSide
	align: 'left' | 'right'
	fallback: string
	displayOverride?: string
}) {
	const managerName =
		displayOverride ||
		side.playerName?.trim() ||
		side.entryName?.trim() ||
		fallback
	const teamName = displayOverride ? null : side.entryName?.trim()

	return (
		<div className={cn('min-w-0', align === 'right' && 'text-right')}>
			<p className="truncate font-display text-sm font-bold leading-tight text-foreground">
				{managerName}
			</p>
			{teamName && teamName !== managerName ? (
				<p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
					{teamName}
				</p>
			) : null}
		</div>
	)
}

function LinkedH2HBody({
	row,
	children
}: {
	row: HomeLeagueRank
	children: ReactNode
}) {
	const bodyClassName = cn(
		'block w-full rounded-sm px-1 py-3',
		row.tournamentId != null &&
			'transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
	)
	if (row.tournamentId == null) {
		return (
			<li className="border-b border-border/40 last:border-b-0">
				<div className={bodyClassName}>{children}</div>
			</li>
		)
	}
	const suffix = row.h2hMatchup
		? `?gw=${encodeURIComponent(String(row.h2hMatchup.eventId))}`
		: ''
	return (
		<li className="border-b border-border/40 last:border-b-0">
			<Link
				href={`/live/competitions/${row.tournamentId}${suffix}`}
				prefetch={false}
				className={bodyClassName}
			>
				{children}
			</Link>
		</li>
	)
}

function H2HLeagueRow({
	row,
	labels
}: {
	row: HomeLeagueRank
	labels: {
		averageTeam: string
		bye: string
		live: string
		final: string
		scheduled: string
		versus: string
		noMatch: string
		gameweek: (event: number) => string
		rank: (rank: string) => string
		privateLeague: string
		publicLeague: string
	}
}) {
	const matchup = row.h2hMatchup
	const rankDisplay = row.rank == null ? null : formatInteger(row.rank)
	if (!matchup) {
		return (
			<LinkedH2HBody row={row}>
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2">
						<LeagueVisibilityBadge
							visibility={row.visibility}
							labels={labels}
						/>
						<p
							className="min-w-0 flex-1 truncate text-sm font-semibold"
							title={row.name}
						>
							{row.name}
						</p>
					</div>
					{rankDisplay ? (
						<span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
							{labels.rank(rankDisplay)}
						</span>
					) : null}
				</div>
				<p className="mt-2 text-xs text-muted-foreground">{labels.noMatch}</p>
			</LinkedH2HBody>
		)
	}

	const opponentFallback = matchup.isBye
		? labels.bye
		: matchup.opponent.isAverage
			? labels.averageTeam
			: labels.noMatch
	const viewerPoints =
		matchup.viewer.points == null ? '—' : formatInteger(matchup.viewer.points)
	const opponentPoints =
		matchup.opponent.points == null
			? '—'
			: formatInteger(matchup.opponent.points)
	const showScore = matchup.isLive || matchup.isFinal
	const statusLabel = matchup.isFinal
		? labels.final
		: matchup.isLive
			? labels.live
			: labels.scheduled

	return (
		<LinkedH2HBody row={row}>
			<div data-home-h2h-matchup={matchup.officialMatchId}>
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2">
						<LeagueVisibilityBadge
							visibility={row.visibility}
							labels={labels}
						/>
						<p
							className="min-w-0 flex-1 truncate text-sm font-semibold"
							title={row.name}
						>
							{row.name}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
							{labels.gameweek(matchup.eventId)}
						</span>
						<span
							className={cn(
								'rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
								matchup.isLive
									? 'bg-primary/15 text-primary-ink'
									: 'bg-muted text-muted-foreground'
							)}
						>
							{statusLabel}
						</span>
						{rankDisplay ? (
							<span className="text-[10px] font-semibold text-muted-foreground">
								{labels.rank(rankDisplay)}
							</span>
						) : null}
					</div>
				</div>

				<div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
					<H2HSide
						side={matchup.viewer}
						align="right"
						fallback="—"
					/>
					{showScore ? (
						<div className="grid min-w-[4.5rem] grid-cols-[1fr_auto_1fr] items-center rounded-md border border-border/80 bg-background px-2 py-2 text-center shadow-sm">
							<span className="font-display text-base font-bold tabular-nums text-primary-ink">
								{viewerPoints}
							</span>
							<span
								className="mx-1 h-5 w-px bg-border"
								aria-hidden="true"
							/>
							<span className="font-display text-base font-bold tabular-nums text-primary-ink">
								{opponentPoints}
							</span>
						</div>
					) : (
						<div className="min-w-[4.5rem] rounded-md border border-border/80 bg-background px-2 py-2 text-center font-display text-xs font-bold text-muted-foreground shadow-sm">
							{labels.versus}
						</div>
					)}
					<H2HSide
						side={matchup.opponent}
						align="left"
						fallback={opponentFallback}
						displayOverride={matchup.isBye ? labels.bye : undefined}
					/>
				</div>
			</div>
		</LinkedH2HBody>
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
		type: PersonalLeagueSection
		label: string
		rows: HomeLeagueRank[]
		emptyLabel: string
	}> = [
		{
			type: 'CLASSIC',
			label: t('personalLeagueClassic'),
			rows: rows.filter(row => getLeagueType(row) === 'CLASSIC'),
			emptyLabel: t('personalLeaguesTypeEmpty', {
				type: t('personalLeagueClassic')
			})
		},
		{
			type: 'H2H',
			label: t('personalLeagueH2H'),
			rows: rows.filter(row => getLeagueType(row) === 'H2H'),
			emptyLabel: t('personalLeaguesTypeEmpty', {
				type: t('personalLeagueH2H')
			})
		},
		{
			type: 'CUPS',
			label: t('personalLeagueCups'),
			rows: [],
			emptyLabel: t('personalLeagueCupsEmpty')
		}
	]
	const h2hLabels = {
		averageTeam: t('personalH2HAverageTeam'),
		bye: t('personalH2HBye'),
		live: t('personalH2HLive'),
		final: t('personalH2HFinal'),
		scheduled: t('personalH2HScheduled'),
		versus: t('personalH2HVersus'),
		noMatch: t('personalH2HNoMatch'),
		gameweek: (event: number) => t('personalH2HGameweek', { event }),
		rank: (rank: string) => t('personalLeagueRank', { rank }),
		privateLeague: t('personalLeaguePrivate'),
		publicLeague: t('personalLeaguePublic')
	}
	const visibilityLabels = {
		privateLeague: t('personalLeaguePrivate'),
		publicLeague: t('personalLeaguePublic')
	}
	const renderClassicRow = (row: HomeLeagueRank) => {
		const rankDisplay = row.rank == null ? '—' : formatInteger(row.rank)
		const ariaMove =
			row.rankState !== 'READY'
				? null
				: row.movement.direction === 'UP'
					? t('personalLeagueUp', { count: row.movement.places ?? 0 })
					: row.movement.direction === 'DOWN'
						? t('personalLeagueDown', { count: row.movement.places ?? 0 })
						: row.movement.direction === 'FLAT'
							? t('personalLeagueFlat')
							: t('personalLeagueNoChange')
		return (
			<ClassicLeagueRow
				key={row.key}
				row={row}
				ariaLabel={[
					t('personalLeagueRank', { rank: rankDisplay }),
					ariaMove
				]
					.filter(Boolean)
					.join(', ')}
				visibilityLabels={visibilityLabels}
			/>
		)
	}
	const renderRow = (group: (typeof groups)[number], row: HomeLeagueRank) =>
		group.type === 'H2H' ? (
			<H2HLeagueRow
				key={row.key}
				row={row}
				labels={h2hLabels}
			/>
		) : (
			renderClassicRow(row)
		)
	const renderGroupContent = (
		group: (typeof groups)[number],
		groupRows: HomeLeagueRank[]
	): ReactNode => {
		if (groupRows.length === 0) {
			return (
				<p className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-8 text-center text-xs text-muted-foreground">
					{group.emptyLabel}
				</p>
			)
		}
		return (
			<ul className="rounded-lg border surface-inset-soft px-3">
				{groupRows.map(row => renderRow(group, row))}
			</ul>
		)
	}
	const previewRows = (group: (typeof groups)[number]) => {
		if (group.rows.length <= HOME_LEAGUE_PREVIEW_LIMIT) return group.rows
		const preview = group.rows.slice(0, HOME_LEAGUE_PREVIEW_LIMIT)
		let replacementIndex = preview.length - 1
		for (const visibility of ['PUBLIC', 'PRIVATE'] as const) {
			const anchor = group.rows.find(row => row.visibility === visibility)
			if (
				!anchor ||
				preview.some(row => row.key === anchor.key) ||
				replacementIndex < 0
			) {
				continue
			}
			preview[replacementIndex] = anchor
			replacementIndex -= 1
		}
		return preview
	}
	const visibleGroups = groups.filter(
		group => group.type !== 'CUPS' || group.rows.length > 0
	)
	const slides: PersonalLeagueCarouselSlide[] = visibleGroups.map(group => {
		const rowsForPreview = previewRows(group)
		const hasMore = group.rows.length > rowsForPreview.length
		return {
			id: group.type.toLowerCase(),
			label: group.label,
			count: group.rows.length,
			content: renderGroupContent(group, rowsForPreview),
			fullContent: hasMore ? renderGroupContent(group, group.rows) : undefined,
			viewAllLabel: hasMore
				? t('personalLeagueViewAll', { count: group.rows.length })
				: undefined
		}
	})

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
				<PersonalLeagueCarousel
					slides={slides}
					labels={{
						pagerLabel: t('personalLeaguePager'),
						previousPage: t('personalLeaguePrevious'),
						nextPage: t('personalLeagueNext'),
						pause: t('personalLeaguePause'),
						resume: t('personalLeagueResume')
					}}
				/>
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
