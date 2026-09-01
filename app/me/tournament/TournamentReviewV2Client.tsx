'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { executeQuery, type GraphQLRequestError } from '@/lib/graphql-client'
import type { FplClassicLeagueRank } from '@/lib/graphql/operations/leagues'
import {
	GET_MY_TOURNAMENT_GAMEWEEK_REVIEW,
	GET_MY_TOURNAMENT_REVIEW_CATALOG,
	GET_MY_TOURNAMENT_SEASON_REVIEW,
	GET_MY_TOURNAMENT_SEASON_REVIEW_SECTION,
	type MyTournamentGameweekReview,
	type MyTournamentGameweekReviewResponse,
	type MyTournamentReviewCatalogResponse,
	type MyTournamentReviewFormat,
	type MyTournamentReviewH2H,
	type MyTournamentReviewKnockout,
	type MyTournamentReviewPoints,
	type MyTournamentReviewScope,
	type MyTournamentReviewState,
	type MyTournamentSeasonSectionResponse,
	type MyTournamentSeasonReview,
	type MyTournamentSeasonReviewResponse
} from '@/lib/graphql/operations/my-fpl'
import { buildTournamentStatsQueryString } from './_lib/tournament-stats-url'
import {
	mergeTournamentReviewEventIds,
	tournamentReviewPointsRow,
	tournamentReviewPointsSummary,
	type TournamentReviewV2View
} from './_lib/tournament-review-v2'

type Catalog = MyTournamentReviewCatalogResponse['myTournamentReviewCatalog']

const catalogItems = (catalog: Catalog) => catalog.edges.map(edge => edge.node)

function normalizeGameweek(
	review: MyTournamentGameweekReview
): MyTournamentGameweekReview {
	const payload = review.payload
	return {
		...review,
		points: payload?.format === 'POINTS' ? payload.points : null,
		h2h: payload?.format === 'H2H' ? payload.h2h : null,
		knockout: payload?.format === 'KNOCKOUT' ? payload.knockout : null
	}
}

function normalizeSeason(
	review: MyTournamentSeasonReview,
	phaseId?: string | null
): MyTournamentSeasonReview {
	const latest =
		review.latestFinalizedEventId ?? review.phases.at(-1)?.endEventId ?? null
	const phase =
		(review.phases.find(candidate => candidate.phaseId === phaseId) ??
			review.phases.at(-1)) ||
		null
	return {
		...review,
		latestEventId: latest,
		latestRevision: phase?.revision ?? null,
		format: phase?.format ?? null,
		finalizedEventIds: review.phases.flatMap(current => {
			const ids: number[] = []
			for (
				let eventId = current.startEventId;
				eventId <= current.endEventId;
				eventId += 1
			)
				ids.push(eventId)
			return ids
		}),
		points: review.points ?? null,
		h2h: review.h2h ?? null,
		knockout: review.knockout ?? null
	}
}

const sectionForFormat = (format: MyTournamentReviewFormat) =>
	format === 'POINTS'
		? 'POINTS_STANDINGS'
		: format === 'H2H'
			? 'H2H_STANDINGS'
			: 'KNOCKOUT_BRACKET'

export interface TournamentReviewV2ClientProps {
	entryId: number
	initialFplClassicRanks: FplClassicLeagueRank[]
	initialCatalog: Catalog
	initialScope: MyTournamentReviewScope
	initialView: 'gameweek' | 'season'
	initialSelectedTournamentId: number | null
	initialEventId: number | null
	initialFinalizedEventIds: number[]
	initialGameweekReview: MyTournamentGameweekReview | null
	initialSeasonReview: MyTournamentSeasonReview | null
	initialSeasonSections?: SeasonSectionData[]
	initialError: string | null
}

const CONTRACT = 'my-tournament-review-v2.1' as const

type SeasonSectionData =
	MyTournamentSeasonSectionResponse['myTournamentSeasonReviewSection']

async function fetchSeasonSection(
	tournamentId: number,
	throughEventId: number,
	phase: MyTournamentSeasonReview['phases'][number],
	first = 100,
	after: string | null = null,
	sectionOverride?:
		| 'POINTS_STANDINGS'
		| 'POINTS_TRAJECTORIES'
		| 'H2H_STANDINGS'
		| 'H2H_FIXTURES'
		| 'KNOCKOUT_BRACKET'
): Promise<SeasonSectionData | null> {
	if (!phase.revision || !phase.semanticSha256) return null
	const section = await executeQuery<MyTournamentSeasonSectionResponse>(
		GET_MY_TOURNAMENT_SEASON_REVIEW_SECTION,
		{
			tournamentId,
			throughEventId,
			phaseId: phase.phaseId,
			section: sectionOverride ?? sectionForFormat(phase.format),
			first,
			after,
			revision: phase.revision,
			semanticSha256: phase.semanticSha256
		},
		{ cache: 'no-store', contract: CONTRACT }
	)
	return section.myTournamentSeasonReviewSection
}

const formatLabel = (
	format: MyTournamentReviewFormat | null | undefined,
	t: ReturnType<typeof useTranslations>
) => {
	if (format === 'H2H') return t('reviewFormatH2H')
	if (format === 'KNOCKOUT') return t('reviewFormatKnockout')
	if (format === 'POINTS') return t('reviewFormatPoints')
	return t('reviewFormatUnknown')
}

const stateLabel = (
	state: MyTournamentReviewState,
	t: ReturnType<typeof useTranslations>
) => {
	if (state === 'READY') return t('reviewReady')
	if (state === 'WAITING_SOURCE') return t('reviewWaitingSource')
	if (state === 'DEGRADED') return t('reviewDegraded')
	if (state === 'PENDING') return t('reviewPending')
	if (state === 'NOT_STARTED') return t('reviewNotStarted')
	return t('reviewUnavailable')
}

const numberOrDash = (value: number | null | undefined) =>
	value === null || value === undefined ? '—' : value.toLocaleString('en-US')

function ClassicLeagueRanks({ ranks }: { ranks: FplClassicLeagueRank[] }) {
	const t = useTranslations('TournamentStats')
	if (ranks.length === 0) return null
	return (
		<section className="rounded-2xl border bg-white p-4 shadow-sm">
			<div>
				<p className="text-xs font-medium uppercase tracking-wide text-slate-500">
					{t('fplClassicRanks')}
				</p>
				<p className="mt-1 text-xs leading-5 text-slate-500">
					{t('fplClassicRanksHint')}
				</p>
			</div>
			<ul className="mt-3 grid gap-2 sm:grid-cols-2">
				{ranks.map(league => {
					const movement =
						league.rank !== null && league.previousRank !== null
							? league.previousRank - league.rank
							: null
					return (
						<li
							key={league.leagueId}
							className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
						>
							<span className="min-w-0 truncate text-sm font-semibold text-slate-950">
								{league.name}
							</span>
							<span className="shrink-0 text-right">
								<span className="block text-base font-bold tabular-nums text-slate-950">
									{league.rank === null
										? t('noData')
										: `#${numberOrDash(league.rank)}`}
								</span>
								{movement !== null ? (
									<span className="block text-xs text-slate-500">
										{movement > 0
											? t('up', { count: movement })
											: movement < 0
												? t('down', { count: Math.abs(movement) })
												: t('noChange')}
									</span>
								) : null}
							</span>
						</li>
					)
				})}
			</ul>
		</section>
	)
}

function mergePointsPage(
	previous: MyTournamentReviewPoints,
	next: MyTournamentReviewPoints
): MyTournamentReviewPoints {
	return { ...next, rows: [...previous.rows, ...next.rows] }
}

function mergeH2HPage(
	previous: MyTournamentReviewH2H,
	next: MyTournamentReviewH2H
): MyTournamentReviewH2H {
	return {
		...next,
		matches: [...previous.matches, ...next.matches],
		// Standings are aggregate data and are repeated on every cursor page.
		standings: next.standings.length ? next.standings : previous.standings
	}
}

function mergeKnockoutPage(
	previous: MyTournamentReviewKnockout,
	next: MyTournamentReviewKnockout
): MyTournamentReviewKnockout {
	return { ...next, matches: [...previous.matches, ...next.matches] }
}

function mergeGameweekPage(
	previous: MyTournamentGameweekReview,
	next: MyTournamentGameweekReview
): MyTournamentGameweekReview {
	return {
		...next,
		points:
			previous.points && next.points
				? mergePointsPage(previous.points, next.points)
				: next.points,
		h2h:
			previous.h2h && next.h2h
				? mergeH2HPage(previous.h2h, next.h2h)
				: next.h2h,
		knockout:
			previous.knockout && next.knockout
				? mergeKnockoutPage(previous.knockout, next.knockout)
				: next.knockout
	}
}

type SeasonSectionKey = SeasonSectionData['section']
type SeasonSectionPages = Partial<Record<SeasonSectionKey, SeasonSectionData>>

function mergeSeasonSectionPage(
	previous: SeasonSectionData | undefined,
	next: SeasonSectionData
): SeasonSectionData {
	return {
		...next,
		points:
			previous?.points && next.points
				? mergePointsPage(previous.points, next.points)
				: (next.points ?? previous?.points ?? null),
		h2h:
			previous?.h2h && next.h2h
				? mergeH2HPage(previous.h2h, next.h2h)
				: (next.h2h ?? previous?.h2h ?? null),
		knockout:
			previous?.knockout && next.knockout
				? mergeKnockoutPage(previous.knockout, next.knockout)
				: (next.knockout ?? previous?.knockout ?? null)
	}
}

function combineSeasonSections(
	review: MyTournamentSeasonReview,
	pages: SeasonSectionPages,
	phaseId: string
): MyTournamentSeasonReview {
	const sections = Object.values(pages).filter(
		(section): section is SeasonSectionData => Boolean(section)
	)
	const standingsPage = pages.POINTS_STANDINGS
	const trajectoryPage = pages.POINTS_TRAJECTORIES
	const pointsPage = standingsPage?.points ?? review.points
	const h2hPages = sections.filter(
		section =>
			section.section === 'H2H_STANDINGS' || section.section === 'H2H_FIXTURES'
	)
	const h2hStandings =
		h2hPages.find(section => (section.h2h?.standings.length ?? 0) > 0)?.h2h
			?.standings ?? []
	const h2hMatches = h2hPages.flatMap(section => section.h2h?.matches ?? [])
	const h2hSource = h2hPages.find(section => section.h2h) ?? null
	const hasH2HNextPage = h2hPages.some(section => section.h2h?.hasNextPage)
	return normalizeSeason(
		{
			...review,
			points: pointsPage ?? null,
			trajectoryPoints:
				trajectoryPage?.points ?? review.trajectoryPoints ?? null,
			h2h: h2hSource?.h2h
				? {
						...h2hSource.h2h,
						matches: h2hMatches,
						standings: h2hStandings,
						hasNextPage: hasH2HNextPage,
						nextCursor: null
					}
				: null,
			knockout: pages.KNOCKOUT_BRACKET?.knockout ?? null
		},
		phaseId
	)
}

function ReviewStateBanner({
	state,
	message
}: {
	state: MyTournamentReviewState
	message?: string
}) {
	const t = useTranslations('TournamentStats')
	return (
		<div
			className={`rounded-2xl border px-4 py-3 text-sm ${
				state === 'READY'
					? 'border-emerald-200 bg-emerald-50 text-emerald-900'
					: state === 'DEGRADED'
						? 'border-amber-200 bg-amber-50 text-amber-950'
						: 'border-slate-200 bg-slate-50 text-slate-700'
			}`}
		>
			<div className="font-medium">{stateLabel(state, t)}</div>
			<div className="mt-1 text-xs opacity-80">
				{message ?? t('reviewSettledOnlyHint')}
			</div>
		</div>
	)
}

function SettlementMeta({
	settledAt,
	publishedAt
}: {
	settledAt: string | null | undefined
	publishedAt: string | null | undefined
}) {
	const locale = useLocale()
	const t = useTranslations('TournamentStats')
	const [hydrated, setHydrated] = useState(false)
	useEffect(() => setHydrated(true), [])
	if (!settledAt && !publishedAt) return null
	return (
		<div className="text-xs text-slate-500">
			{settledAt
				? t('reviewSettledAt', {
						value: hydrated ? new Date(settledAt).toLocaleString(locale) : '—'
					})
				: null}
			{publishedAt
				? ` · ${t('reviewPublishedAt', {
						value: hydrated ? new Date(publishedAt).toLocaleString(locale) : '—'
					})}`
				: null}
		</div>
	)
}

function LoadMore({
	hasNextPage,
	loading,
	onLoadMore
}: {
	hasNextPage: boolean
	loading: boolean
	onLoadMore?: () => void
}) {
	const t = useTranslations('TournamentStats')
	if (!hasNextPage || !onLoadMore) return null
	return (
		<div className="flex justify-center border-t bg-slate-50 p-3">
			<button
				type="button"
				disabled={loading}
				onClick={onLoadMore}
				className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-900 shadow-sm hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-60"
			>
				{loading ? t('reviewLoadingMore') : t('reviewLoadMore')}
			</button>
		</div>
	)
}

function PointsReview({
	points,
	trajectory,
	view,
	loadingMore,
	onLoadMore
}: {
	points: MyTournamentReviewPoints
	trajectory?: MyTournamentReviewPoints | null
	view: TournamentReviewV2View
	loadingMore: boolean
	onLoadMore?: () => void
}) {
	const t = useTranslations('TournamentStats')
	const summary = tournamentReviewPointsSummary(points, view)
	const grossLabel =
		view === 'season' ? t('reviewSeasonGross') : t('reviewGross')
	const netLabel = view === 'season' ? t('reviewSeasonNet') : t('reviewNet')
	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-3">
				<div className="rounded-2xl border bg-white p-4 shadow-sm">
					<div className="text-xs uppercase tracking-wide text-slate-500">
						{grossLabel}
					</div>
					<div className="mt-1 text-2xl font-semibold text-slate-950">
						{numberOrDash(summary.grossTotal)}
					</div>
					<div className="text-xs text-slate-500">
						{t('reviewGrossAverage', { value: summary.grossAverage })}
					</div>
				</div>
				<div className="rounded-2xl border bg-white p-4 shadow-sm">
					<div className="text-xs uppercase tracking-wide text-slate-500">
						{netLabel}
					</div>
					<div className="mt-1 text-2xl font-semibold text-slate-950">
						{numberOrDash(summary.netTotal)}
					</div>
					<div className="text-xs text-slate-500">
						{view === 'season' ? t('reviewSeasonNetHint') : t('reviewNetHint')}
					</div>
				</div>
				<div className="rounded-2xl border bg-white p-4 shadow-sm">
					<div className="text-xs uppercase tracking-wide text-slate-500">
						{t('reviewRows')}
					</div>
					<div className="mt-1 text-2xl font-semibold text-slate-950">
						{points.rows.length}
					</div>
					<div className="text-xs text-slate-500">
						{points.hasNextPage ? t('reviewFirstPage') : t('reviewComplete')}
					</div>
				</div>
			</div>
			<div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
				<table className="min-w-full text-left text-sm">
					<thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
						<tr>
							<th className="px-4 py-3">{t('rank')}</th>
							<th className="px-4 py-3">{t('team')}</th>
							<th className="px-4 py-3 text-right">{grossLabel}</th>
							<th className="px-4 py-3 text-right">{t('reviewCost')}</th>
							<th className="px-4 py-3 text-right">{netLabel}</th>
							<th className="px-4 py-3 text-right">
								{t('reviewTournamentScore')}
							</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{points.rows.map(row => {
							const displayed = tournamentReviewPointsRow(row, view)
							return (
								<tr
									key={row.entryId}
									className="text-slate-700"
								>
									<td className="px-4 py-3 font-medium">
										{numberOrDash(row.rank)}
									</td>
									<td className="px-4 py-3">
										<div className="font-medium text-slate-950">
											{row.entryName}
										</div>
										<div className="text-xs text-slate-500">
											{row.playerName}
										</div>
									</td>
									<td className="px-4 py-3 text-right">
										{numberOrDash(displayed.grossPoints)}
									</td>
									<td className="px-4 py-3 text-right text-rose-700">
										{numberOrDash(displayed.transferCost)}
									</td>
									<td className="px-4 py-3 text-right font-medium">
										{numberOrDash(displayed.netPoints)}
									</td>
									<td className="px-4 py-3 text-right">
										{numberOrDash(row.tournamentScore)}
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
				<LoadMore
					hasNextPage={points.hasNextPage}
					loading={loadingMore}
					onLoadMore={onLoadMore}
				/>
			</div>
			{view === 'season' && trajectory ? (
				<section className="rounded-2xl border bg-white p-4 shadow-sm">
					<div className="flex items-baseline justify-between gap-3">
						<h3 className="font-semibold text-slate-950">
							{t('reviewTrajectories')}
						</h3>
						<span className="text-xs text-slate-500">
							{t('reviewTrajectoryHint')}
						</span>
					</div>
					<div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{trajectory.rows.slice(0, 12).map(row => (
							<div
								key={`trajectory-${row.entryId}`}
								className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
							>
								<div className="flex items-center justify-between gap-2 text-sm">
									<span className="truncate font-medium text-slate-950">
										{row.entryName}
									</span>
									<span className="shrink-0 font-semibold tabular-nums text-slate-700">
										{numberOrDash(row.seasonNetPoints)}
									</span>
								</div>
								<div className="mt-1 flex items-center justify-between text-xs text-slate-500">
									<span>{t('reviewSeasonNet')}</span>
									<span>
										{row.previousRank !== null && row.rank !== null
											? `${row.previousRank} → ${row.rank}`
											: numberOrDash(row.rank)}
									</span>
								</div>
							</div>
						))}
					</div>
				</section>
			) : null}
		</div>
	)
}

function H2HReview({
	review,
	loadingMore,
	onLoadMore
}: {
	review: NonNullable<MyTournamentGameweekReview['h2h']>
	loadingMore: boolean
	onLoadMore?: () => void
}) {
	const t = useTranslations('TournamentStats')
	return (
		<div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
			<section className="rounded-2xl border bg-white p-4 shadow-sm">
				<h3 className="font-semibold text-slate-950">{t('reviewMatchups')}</h3>
				<div className="mt-3 space-y-2">
					{review.matches.map(match => (
						<div
							key={match.matchId}
							className="rounded-xl border border-slate-100 bg-slate-50 p-3"
						>
							<div className="mb-2 text-xs text-slate-500">
								{match.isBye
									? t('reviewBye')
									: t('reviewGroup', { group: match.groupId })}
							</div>
							<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
								<div>
									<div className="font-medium">
										{match.home?.isAverage
											? t('reviewAverage')
											: (match.home?.entryName ?? t('reviewBye'))}
									</div>
									<div className="text-xs text-slate-500">
										{numberOrDash(match.home?.netPoints)} {t('reviewNetShort')}
									</div>
								</div>
								<div className="text-xs font-semibold text-slate-400">VS</div>
								<div className="text-right">
									<div className="font-medium">
										{match.away?.isAverage
											? t('reviewAverage')
											: (match.away?.entryName ?? t('reviewBye'))}
									</div>
									<div className="text-xs text-slate-500">
										{numberOrDash(match.away?.netPoints)} {t('reviewNetShort')}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
				<LoadMore
					hasNextPage={review.hasNextPage}
					loading={loadingMore}
					onLoadMore={onLoadMore}
				/>
			</section>
			<section className="rounded-2xl border bg-white p-4 shadow-sm">
				<h3 className="font-semibold text-slate-950">{t('reviewStandings')}</h3>
				<div className="mt-3 overflow-x-auto">
					<table className="min-w-full text-left text-sm">
						<thead className="text-xs text-slate-500">
							<tr>
								<th className="px-2 py-2">#</th>
								<th className="px-2 py-2">{t('reviewGroupLabel')}</th>
								<th className="px-2 py-2">{t('team')}</th>
								<th className="px-2 py-2 text-right">
									{t('reviewMatchPoints')}
								</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							{review.standings.map(row => (
								<tr key={`${row.groupId}-${row.entryId}`}>
									<td className="px-2 py-2 font-medium">{row.rank}</td>
									<td className="px-2 py-2">{row.groupId}</td>
									<td className="px-2 py-2">{row.entryName}</td>
									<td className="px-2 py-2 text-right font-medium">
										{row.matchPoints}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	)
}

function KnockoutReview({
	review,
	loadingMore,
	onLoadMore
}: {
	review: NonNullable<MyTournamentGameweekReview['knockout']>
	loadingMore: boolean
	onLoadMore?: () => void
}) {
	const t = useTranslations('TournamentStats')
	return (
		<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
			{review.matches.map(match => (
				<div
					key={`${match.matchId}-${match.playAgainstId}`}
					className="rounded-2xl border bg-white p-4 shadow-sm"
				>
					<div className="flex items-center justify-between text-xs text-slate-500">
						<span>
							{match.name ??
								t('reviewKnockoutRound', { round: match.round ?? '—' })}
						</span>
						<span>#{match.matchId}</span>
					</div>
					<div className="mt-3 space-y-2 text-sm">
						{[match.home, match.away].map((side, index) => (
							<div
								key={side?.entryId ?? `empty-${index}`}
								className={`flex items-center justify-between rounded-xl px-3 py-2 ${side?.entryId === match.winnerEntryId ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-700'}`}
							>
								<span>{side?.entryName ?? t('reviewBye')}</span>
								<span className="font-medium">
									{numberOrDash(side?.netPoints)}
								</span>
							</div>
						))}
					</div>
				</div>
			))}
			<div className="md:col-span-2 xl:col-span-3">
				<LoadMore
					hasNextPage={review.hasNextPage}
					loading={loadingMore}
					onLoadMore={onLoadMore}
				/>
			</div>
		</div>
	)
}

function ReviewPayload({
	review,
	format,
	view,
	loadingMore,
	onLoadMore
}: {
	review: MyTournamentGameweekReview | MyTournamentSeasonReview
	format: MyTournamentReviewFormat | null
	view: TournamentReviewV2View
	loadingMore: boolean
	onLoadMore?: () => void
}) {
	if (format === 'H2H' && review.h2h)
		return (
			<H2HReview
				review={review.h2h}
				loadingMore={loadingMore}
				onLoadMore={onLoadMore}
			/>
		)
	if (format === 'KNOCKOUT' && review.knockout)
		return (
			<KnockoutReview
				review={review.knockout}
				loadingMore={loadingMore}
				onLoadMore={onLoadMore}
			/>
		)
	if (format === 'POINTS' && review.points)
		return (
			<PointsReview
				points={review.points}
				trajectory={
					view === 'season' && 'trajectoryPoints' in review
						? review.trajectoryPoints
						: null
				}
				view={view}
				loadingMore={loadingMore}
				onLoadMore={onLoadMore}
			/>
		)
	return null
}

export default function TournamentReviewV2Client({
	entryId,
	initialFplClassicRanks,
	initialCatalog,
	initialScope,
	initialView,
	initialSelectedTournamentId,
	initialEventId,
	initialFinalizedEventIds,
	initialGameweekReview,
	initialSeasonReview,
	initialSeasonSections = [],
	initialError
}: TournamentReviewV2ClientProps) {
	const t = useTranslations('TournamentStats')
	const router = useRouter()
	const pathname = usePathname()
	const [catalog, setCatalog] = useState(initialCatalog)
	const [scope, setScope] = useState<MyTournamentReviewScope>(initialScope)
	const [selectedTournamentId, setSelectedTournamentId] = useState<
		number | null
	>(initialSelectedTournamentId)
	const [eventId, setEventId] = useState<number | null>(initialEventId)
	const [finalizedEventIds, setFinalizedEventIds] = useState(
		initialFinalizedEventIds
	)
	const [view, setView] = useState<'gameweek' | 'season'>(initialView)
	const viewRef = useRef(view)
	useEffect(() => {
		viewRef.current = view
	}, [view])
	const [gameweekReview, setGameweekReview] = useState(
		initialGameweekReview ? normalizeGameweek(initialGameweekReview) : null
	)
	const [seasonReview, setSeasonReview] = useState(
		initialSeasonReview ? normalizeSeason(initialSeasonReview) : null
	)
	const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(
		initialSeasonReview?.phases.at(-1)?.phaseId ?? null
	)
	const [loading, setLoading] = useState(false)
	const [loadingMore, setLoadingMore] = useState(false)
	const [error, setError] = useState<string | null>(initialError)
	const [catalogSearch, setCatalogSearch] = useState('')
	const [catalogSearchInput, setCatalogSearchInput] = useState('')
	const [catalogLoadingMore, setCatalogLoadingMore] = useState(false)
	const requestSequence = useRef(0)
	const catalogRequestSequence = useRef(0)
	// A replacement (search/scope switch) advances this generation. Page
	// appends capture it so an older load-more response can never append into a
	// newly searched catalog, even if the network completes out of order.
	const catalogQueryGeneration = useRef(0)
	const seasonSectionPages = useRef<SeasonSectionPages>(
		Object.fromEntries(
			initialSeasonSections.map(section => [section.section, section])
		) as SeasonSectionPages
	)

	const selectedTournament = useMemo(
		() =>
			catalogItems(catalog).find(
				tournament => tournament.tournamentId === selectedTournamentId
			) ?? null,
		[catalog, selectedTournamentId]
	)

	const replaceRoute = useCallback(
		(next: {
			tournamentId?: number | null
			eventId?: number | null
			view?: TournamentReviewV2View
			scope?: MyTournamentReviewScope
		}) => {
			const nextScope = next.scope ?? scope
			const query = buildTournamentStatsQueryString({
				tournamentId:
					next.tournamentId === undefined
						? selectedTournamentId
						: next.tournamentId,
				view: next.view ?? view,
				gw: next.eventId === undefined ? eventId : next.eventId,
				scope: nextScope === 'MANAGED' ? 'ALL' : nextScope
			})
			router.replace(query ? `${pathname}?${query}` : pathname, {
				scroll: false
			})
		},
		[eventId, pathname, router, scope, selectedTournamentId, view]
	)

	const loadCatalogPage = async ({
		after = null,
		search = catalogSearch,
		replace = false,
		nextScope = scope
	}: {
		after?: string | null
		search?: string
		replace?: boolean
		nextScope?: MyTournamentReviewScope
	} = {}) => {
		const queryGeneration = catalogQueryGeneration.current
		const requestId = ++catalogRequestSequence.current
		setCatalogLoadingMore(true)
		try {
			const response = await executeQuery<MyTournamentReviewCatalogResponse>(
				GET_MY_TOURNAMENT_REVIEW_CATALOG,
				{
					scope: nextScope,
					first: 100,
					after,
					search: search.trim() || null
				},
				{ cache: 'no-store', contract: CONTRACT }
			)
			if (
				requestId !== catalogRequestSequence.current ||
				queryGeneration !== catalogQueryGeneration.current
			)
				return
			const nextCatalog = response.myTournamentReviewCatalog
			setCatalog(previous =>
				replace
					? nextCatalog
					: {
							...nextCatalog,
							edges: [...previous.edges, ...nextCatalog.edges]
						}
			)
			setCatalogSearch(search.trim())
		} catch (loadError) {
			if (
				requestId !== catalogRequestSequence.current ||
				queryGeneration !== catalogQueryGeneration.current
			)
				return
			const requestError = loadError as GraphQLRequestError
			setError(
				requestError?.code === 'CLIENT_UPGRADE_REQUIRED'
					? t('reviewClientUpgrade')
					: t('loadFailed')
			)
		} finally {
			if (
				requestId === catalogRequestSequence.current &&
				queryGeneration === catalogQueryGeneration.current
			)
				setCatalogLoadingMore(false)
		}
	}

	const searchCatalog = async (requestedSearch = catalogSearchInput) => {
		const nextSearch = requestedSearch.trim()
		// Invalidate an in-flight load-more response from the previous query. A
		// catalog replacement must never be followed by an old page append.
		++catalogRequestSequence.current
		++catalogQueryGeneration.current
		const requestId = ++requestSequence.current
		setLoading(true)
		setLoadingMore(false)
		setError(null)
		setGameweekReview(null)
		setSeasonReview(null)
		seasonSectionPages.current = {}
		try {
			const response = await executeQuery<MyTournamentReviewCatalogResponse>(
				GET_MY_TOURNAMENT_REVIEW_CATALOG,
				{ scope, first: 100, after: null, search: nextSearch || null },
				{ cache: 'no-store', contract: CONTRACT }
			)
			if (requestId !== requestSequence.current) return
			const nextCatalog = response.myTournamentReviewCatalog
			const nextItems = catalogItems(nextCatalog)
			const nextSelected =
				nextItems.find(item => item.tournamentId === selectedTournamentId) ??
				nextItems[0] ??
				null
			setCatalog(nextCatalog)
			setCatalogSearch(nextSearch)
			setSelectedTournamentId(nextSelected?.tournamentId ?? null)
			const nextEventId = nextSelected?.latestFinalizedEventId ?? null
			setEventId(nextEventId)
			setSelectedPhaseId(null)
			setFinalizedEventIds([])
			replaceRoute({
				tournamentId: nextSelected?.tournamentId ?? null,
				eventId: nextEventId,
				view: viewRef.current
			})
			if (nextSelected && nextEventId) {
				void loadReview(nextSelected.tournamentId, nextEventId, true)
			} else {
				setLoading(false)
			}
		} catch (loadError) {
			if (requestId !== requestSequence.current) return
			const requestError = loadError as GraphQLRequestError
			setError(
				requestError?.code === 'CLIENT_UPGRADE_REQUIRED'
					? t('reviewClientUpgrade')
					: t('loadFailed')
			)
			setLoading(false)
		}
	}

	const loadReview = async (
		tournamentId: number,
		nextEventId: number,
		replaceAvailableEvents = false
	) => {
		const requestId = ++requestSequence.current
		setLoading(true)
		setLoadingMore(false)
		setError(null)
		setGameweekReview(null)
		setSeasonReview(null)
		seasonSectionPages.current = {}
		try {
			const [gameweek, season] = await Promise.all([
				executeQuery<MyTournamentGameweekReviewResponse>(
					GET_MY_TOURNAMENT_GAMEWEEK_REVIEW,
					{ tournamentId, eventId: nextEventId, first: 100 },
					{ cache: 'no-store', contract: CONTRACT }
				),
				executeQuery<MyTournamentSeasonReviewResponse>(
					GET_MY_TOURNAMENT_SEASON_REVIEW,
					{ tournamentId, throughEventId: nextEventId },
					{ cache: 'no-store', contract: CONTRACT }
				)
			])
			if (requestId !== requestSequence.current) return
			const normalizedGameweek = normalizeGameweek(
				gameweek.myTournamentGameweekReview
			)
			const normalizedSeason = normalizeSeason(season.myTournamentSeasonReview)
			const nextPhase = normalizedSeason.phases.at(-1) ?? null
			let seasonWithSection = normalizedSeason
			if (nextPhase) {
				const sectionRequests: Promise<SeasonSectionData | null>[] = [
					fetchSeasonSection(tournamentId, nextEventId, nextPhase)
				]
				if (nextPhase.format === 'POINTS') {
					sectionRequests.push(
						fetchSeasonSection(
							tournamentId,
							nextEventId,
							nextPhase,
							100,
							null,
							'POINTS_TRAJECTORIES'
						)
					)
				}
				if (nextPhase.format === 'H2H') {
					sectionRequests.push(
						fetchSeasonSection(
							tournamentId,
							nextEventId,
							nextPhase,
							100,
							null,
							'H2H_FIXTURES'
						)
					)
				}
				const settledSections = await Promise.allSettled(sectionRequests)
				const primarySection = settledSections[0]
				if (!primarySection)
					throw new Error('Season phase publication is not ready')
				if (primarySection.status === 'rejected') throw primarySection.reason
				const sections = settledSections.map(result =>
					result.status === 'fulfilled' ? result.value : null
				)
				const pages = Object.fromEntries(
					sections
						.filter((section): section is SeasonSectionData => Boolean(section))
						.map(section => [section.section, section])
				) as SeasonSectionPages
				if (requestId !== requestSequence.current) return
				seasonSectionPages.current = pages
				if (sections.some(Boolean))
					seasonWithSection = combineSeasonSections(
						normalizedSeason,
						pages,
						nextPhase.phaseId
					)
			}
			if (requestId !== requestSequence.current) return
			setSelectedPhaseId(nextPhase?.phaseId ?? null)
			setGameweekReview(normalizedGameweek)
			setSeasonReview(seasonWithSection)
			setFinalizedEventIds(previous =>
				replaceAvailableEvents
					? (normalizedSeason.finalizedEventIds ?? previous)
					: mergeTournamentReviewEventIds(
							previous,
							normalizedSeason.finalizedEventIds ?? []
						)
			)
		} catch (loadError) {
			if (requestId !== requestSequence.current) return
			const requestError = loadError as GraphQLRequestError
			setError(
				requestError?.code === 'CLIENT_UPGRADE_REQUIRED'
					? t('reviewClientUpgrade')
					: t('loadFailed')
			)
		} finally {
			if (requestId === requestSequence.current) setLoading(false)
		}
	}

	const loadMore = async () => {
		if (loading || loadingMore || !selectedTournamentId || !eventId) return
		const requestView = view
		const requestTournamentId = selectedTournamentId
		const requestEventId = eventId
		const requestRevision =
			requestView === 'gameweek' ? gameweekReview?.scope?.revision : null
		const gameweekCursor =
			requestView === 'gameweek'
				? (gameweekReview?.points?.nextCursor ??
					gameweekReview?.h2h?.nextCursor ??
					gameweekReview?.knockout?.nextCursor)
				: null
		const seasonPhase =
			requestView === 'season'
				? (seasonReview?.phases.find(
						candidate => candidate.phaseId === selectedPhaseId
					) ?? seasonReview?.phases.at(-1))
				: null
		const seasonPages =
			requestView === 'season' ? seasonSectionPages.current : null
		const pendingSeasonSections = seasonPages
			? Object.values(seasonPages).filter(
					(section): section is SeasonSectionData =>
						Boolean(section?.pageInfo.hasNextPage && section.pageInfo.endCursor)
				)
			: []
		if (requestView === 'gameweek' && (!gameweekCursor || !requestRevision)) {
			setError(t('loadFailed'))
			return
		}
		if (
			requestView === 'season' &&
			(!seasonPhase || !pendingSeasonSections.length)
		)
			return
		const requestId = ++requestSequence.current
		setLoadingMore(true)
		setError(null)
		try {
			if (requestView === 'gameweek') {
				const response = await executeQuery<MyTournamentGameweekReviewResponse>(
					GET_MY_TOURNAMENT_GAMEWEEK_REVIEW,
					{
						tournamentId: requestTournamentId,
						eventId: requestEventId,
						first: 100,
						after: gameweekCursor,
						revision: requestRevision
					},
					{ cache: 'no-store', contract: CONTRACT }
				)
				if (requestId !== requestSequence.current) return
				if (
					response.myTournamentGameweekReview.scope?.revision !==
					requestRevision
				)
					throw new Error(
						'Tournament review revision changed during pagination'
					)
				const normalized = normalizeGameweek(
					response.myTournamentGameweekReview
				)
				setGameweekReview(previous =>
					previous ? mergeGameweekPage(previous, normalized) : normalized
				)
			} else {
				const phase = seasonPhase
				if (!phase?.revision || !phase.semanticSha256)
					throw new Error('Season phase identity missing')
				const responses = await Promise.all(
					pendingSeasonSections.map(section =>
						fetchSeasonSection(
							requestTournamentId,
							requestEventId,
							phase,
							100,
							section.pageInfo.endCursor,
							section.section
						)
					)
				)
				if (responses.some(response => !response))
					throw new Error('Season phase publication is not ready')
				if (requestId !== requestSequence.current) return
				const nextPages = { ...seasonSectionPages.current }
				for (const response of responses) {
					if (!response) continue
					if (
						response.phaseId !== phase.phaseId ||
						response.revision !== phase.revision ||
						response.semanticSha256 !== phase.semanticSha256
					)
						throw new Error('Season phase identity changed during pagination')
					nextPages[response.section] = mergeSeasonSectionPage(
						nextPages[response.section],
						response
					)
				}
				seasonSectionPages.current = nextPages
				setSeasonReview(previous =>
					previous
						? combineSeasonSections(previous, nextPages, phase.phaseId)
						: null
				)
			}
		} catch (loadError) {
			if (requestId !== requestSequence.current) return
			const requestError = loadError as GraphQLRequestError
			setError(
				requestError?.code === 'CLIENT_UPGRADE_REQUIRED'
					? t('reviewClientUpgrade')
					: t('loadFailed')
			)
		} finally {
			if (requestId === requestSequence.current) setLoadingMore(false)
		}
	}

	const loadMoreCatalog = () => {
		if (
			loading ||
			catalogLoadingMore ||
			!catalog.pageInfo.hasNextPage ||
			!catalog.pageInfo.endCursor
		)
			return
		void loadCatalogPage({ after: catalog.pageInfo.endCursor })
	}

	const switchScope = async () => {
		++catalogRequestSequence.current
		++catalogQueryGeneration.current
		const requestId = ++requestSequence.current
		const nextScope: MyTournamentReviewScope =
			scope === 'ALL' ? 'ACCESSIBLE' : 'ALL'
		setLoading(true)
		setLoadingMore(false)
		setError(null)
		try {
			const response = await executeQuery<MyTournamentReviewCatalogResponse>(
				GET_MY_TOURNAMENT_REVIEW_CATALOG,
				{
					scope: nextScope,
					first: 100,
					after: null,
					search: catalogSearch || null
				},
				{ cache: 'no-store', contract: CONTRACT }
			)
			if (requestId !== requestSequence.current) return
			const nextCatalog = response.myTournamentReviewCatalog
			const nextItems = catalogItems(nextCatalog)
			const nextSelected =
				nextItems.find(item => item.tournamentId === selectedTournamentId) ??
				nextItems[0] ??
				null
			setScope(nextScope)
			setCatalog(nextCatalog)
			setCatalogSearchInput(catalogSearch)
			setSelectedTournamentId(nextSelected?.tournamentId ?? null)
			const nextEventId = nextSelected?.latestFinalizedEventId ?? null
			setEventId(nextEventId)
			setFinalizedEventIds([])
			setGameweekReview(null)
			setSeasonReview(null)
			seasonSectionPages.current = {}
			replaceRoute({
				tournamentId: nextSelected?.tournamentId ?? null,
				eventId: nextEventId,
				scope: nextScope,
				view: viewRef.current
			})
			if (nextSelected && nextEventId) {
				void loadReview(nextSelected.tournamentId, nextEventId, true)
			} else setLoading(false)
		} catch (loadError) {
			if (requestId !== requestSequence.current) return
			const requestError = loadError as GraphQLRequestError
			setError(
				requestError?.code === 'CLIENT_UPGRADE_REQUIRED'
					? t('reviewClientUpgrade')
					: t('loadFailed')
			)
			setLoading(false)
		}
	}

	useEffect(() => {
		if (!selectedTournamentId || !eventId) return
		if (
			gameweekReview &&
			seasonReview &&
			(seasonReview.points || seasonReview.h2h || seasonReview.knockout) &&
			Object.keys(seasonSectionPages.current).length > 0
		)
			return
		void loadReview(selectedTournamentId, eventId, true)
		// Initial server data is intentionally used once; subsequent changes load explicitly.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const chooseTournament = (value: string) => {
		++requestSequence.current
		if (!value) {
			setSelectedTournamentId(null)
			setEventId(null)
			setSelectedPhaseId(null)
			setFinalizedEventIds([])
			setGameweekReview(null)
			setSeasonReview(null)
			seasonSectionPages.current = {}
			setLoading(false)
			setLoadingMore(false)
			setError(null)
			replaceRoute({ tournamentId: null, eventId: null })
			return
		}
		const nextId = Number(value)
		const tournament = catalogItems(catalog).find(
			item => item.tournamentId === nextId
		)
		if (!tournament) return
		const nextEventId = tournament.latestFinalizedEventId
		setSelectedTournamentId(nextId)
		setEventId(nextEventId)
		setSelectedPhaseId(null)
		setFinalizedEventIds([])
		setGameweekReview(null)
		setSeasonReview(null)
		seasonSectionPages.current = {}
		setLoading(false)
		setLoadingMore(false)
		setError(null)
		replaceRoute({ tournamentId: nextId, eventId: nextEventId })
		if (nextEventId) void loadReview(nextId, nextEventId, true)
	}

	const chooseEvent = (value: string) => {
		const nextEventId = Number(value)
		if (
			!selectedTournamentId ||
			!Number.isSafeInteger(nextEventId) ||
			nextEventId < 1 ||
			!finalizedEventIds.includes(nextEventId)
		)
			return
		setEventId(nextEventId)
		setSelectedPhaseId(null)
		replaceRoute({ eventId: nextEventId })
		void loadReview(selectedTournamentId, nextEventId)
	}

	const chooseView = (nextView: 'gameweek' | 'season') => {
		// Invalidate an in-flight phase/section request. Its immutable response
		// may still complete, but it must not mutate state after the visible view
		// has changed.
		++requestSequence.current
		setLoadingMore(false)
		setLoading(false)
		viewRef.current = nextView
		setView(nextView)
		replaceRoute({ view: nextView })
	}

	const choosePhase = (phaseId: string) => {
		if (view !== 'season' || !seasonReview || phaseId === selectedPhaseId)
			return
		const phase = seasonReview.phases.find(
			candidate => candidate.phaseId === phaseId
		)
		if (!phase || !selectedTournamentId || !eventId) return
		const requestId = ++requestSequence.current
		setSelectedPhaseId(phaseId)
		setLoading(true)
		setLoadingMore(false)
		setError(null)
		seasonSectionPages.current = {}
		// Remove the previous phase's rows immediately. A settled phase is an
		// immutable bundle, so showing rows from another phase while the selected
		// bundle loads would be a misleading cross-phase response.
		setSeasonReview(previous =>
			previous
				? normalizeSeason(
						{
							...previous,
							state: phase.state,
							points: null,
							h2h: null,
							knockout: null
						},
						phaseId
					)
				: previous
		)
		void (async () => {
			try {
				const sectionRequests: Promise<SeasonSectionData | null>[] = [
					fetchSeasonSection(selectedTournamentId, eventId, phase)
				]
				if (phase.format === 'POINTS')
					sectionRequests.push(
						fetchSeasonSection(
							selectedTournamentId,
							eventId,
							phase,
							100,
							null,
							'POINTS_TRAJECTORIES'
						)
					)
				if (phase.format === 'H2H')
					sectionRequests.push(
						fetchSeasonSection(
							selectedTournamentId,
							eventId,
							phase,
							100,
							null,
							'H2H_FIXTURES'
						)
					)
				const settledSections = await Promise.allSettled(sectionRequests)
				const primarySection = settledSections[0]
				if (!primarySection)
					throw new Error('Season phase publication is not ready')
				if (primarySection.status === 'rejected') throw primarySection.reason
				const sections = settledSections.map(result =>
					result.status === 'fulfilled' ? result.value : null
				)
				if (requestId !== requestSequence.current) return
				const pages = Object.fromEntries(
					sections
						.filter((section): section is SeasonSectionData => Boolean(section))
						.map(section => [section.section, section])
				) as SeasonSectionPages
				seasonSectionPages.current = pages
				const sectionData = sections.find(Boolean) ?? null
				setSeasonReview(previous =>
					previous
						? combineSeasonSections(
								{
									...previous,
									state: sectionData?.state ?? phase.state
								},
								pages,
								phaseId
							)
						: previous
				)
			} catch (loadError) {
				if (requestId !== requestSequence.current) return
				const requestError = loadError as GraphQLRequestError
				setError(
					requestError?.code === 'CLIENT_UPGRADE_REQUIRED'
						? t('reviewClientUpgrade')
						: t('loadFailed')
				)
			} finally {
				if (requestId === requestSequence.current) setLoading(false)
			}
		})()
	}

	const selectedPhase = useMemo(
		() =>
			seasonReview?.phases.find(phase => phase.phaseId === selectedPhaseId) ??
			seasonReview?.phases.at(-1) ??
			null,
		[seasonReview, selectedPhaseId]
	)

	const activeReview = view === 'gameweek' ? gameweekReview : seasonReview
	// Format is scoped to the active settled review. Do not let a previously
	// loaded Gameweek (or the latest phase) leak into an earlier Season phase.
	const format =
		view === 'gameweek'
			? (gameweekReview?.scope?.format ??
				selectedTournament?.latestFinalizedScope?.format ??
				selectedTournament?.phaseSummaries.at(-1)?.format ??
				null)
			: (selectedPhase?.format ?? seasonReview?.phases.at(-1)?.format ?? null)
	const state: MyTournamentReviewState =
		error && !activeReview
			? 'UNAVAILABLE'
			: (activeReview?.state ?? selectedTournament?.state ?? 'UNAVAILABLE')
	return (
		<div className="min-h-screen bg-slate-50">
			<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
				<div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
					<div>
						<div className="text-sm font-medium text-indigo-600">LetLetMe</div>
						<h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
							{t('title')}
						</h1>
						<p className="mt-2 max-w-2xl text-sm text-slate-600">
							{t('reviewSettledOnlyHint')}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
						<Link
							href="/competitions/create"
							className="rounded-full bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
						>
							{t('createTournament')}
						</Link>
						<span className="rounded-full border bg-white px-3 py-1.5">
							{t('reviewViewerEntry', { entryId })}
						</span>
						{selectedTournament && (
							<span className="rounded-full border bg-white px-3 py-1.5">
								{formatLabel(format, t)}
							</span>
						)}
					</div>
				</div>

				<ClassicLeagueRanks ranks={initialFplClassicRanks} />

				<div className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
					<aside className="space-y-3">
						<label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
							{t('selectTournament')}
						</label>
						<select
							value={selectedTournamentId ?? ''}
							onChange={event => chooseTournament(event.target.value)}
							className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500"
						>
							<option value="">{t('selectTournament')}</option>
							{catalogItems(catalog).map(tournament => (
								<option
									key={tournament.tournamentId}
									value={tournament.tournamentId}
								>
									{tournament.name} · {stateLabel(tournament.state, t)}
								</option>
							))}
						</select>
						{catalog.adminReadAll && (
							<button
								type="button"
								onClick={() => void switchScope()}
								className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-xs font-medium text-indigo-900 hover:bg-indigo-100"
							>
								{scope === 'ALL'
									? t('reviewAdminAccessibleScope')
									: t('reviewAdminAllScope')}
							</button>
						)}
						{catalog.adminReadAll && (
							<form
								className="space-y-2 pt-1"
								onSubmit={event => {
									event.preventDefault()
									void searchCatalog()
								}}
							>
								<label
									htmlFor="tournament-review-search"
									className="sr-only"
								>
									{t('reviewSearchPlaceholder')}
								</label>
								<input
									id="tournament-review-search"
									value={catalogSearchInput}
									onChange={event => setCatalogSearchInput(event.target.value)}
									placeholder={t('reviewSearchPlaceholder')}
									className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500"
								/>
								<div className="flex gap-2">
									<button
										type="submit"
										disabled={loading || catalogLoadingMore}
										className="flex-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
									>
										{t('reviewSearch')}
									</button>
									{catalogSearch && (
										<button
											type="button"
											onClick={() => {
												setCatalogSearchInput('')
												void searchCatalog('')
											}}
											className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
										>
											{t('reviewClearSearch')}
										</button>
									)}
								</div>
							</form>
						)}
						{catalog.pageInfo.hasNextPage && (
							<button
								type="button"
								onClick={loadMoreCatalog}
								disabled={catalogLoadingMore}
								className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
							>
								{catalogLoadingMore
									? t('reviewLoadingTournaments')
									: t('reviewLoadMoreTournaments')}
							</button>
						)}
						{selectedTournament && finalizedEventIds.length > 0 && (
							<>
								<label className="block pt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
									{t('reviewEvent')}
								</label>
								<select
									value={eventId ?? ''}
									onChange={event => chooseEvent(event.target.value)}
									className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500"
								>
									{finalizedEventIds.map(id => (
										<option
											key={id}
											value={id}
										>
											GW {id}
										</option>
									))}
								</select>
							</>
						)}
						<div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">
							<div className="font-medium">{t('reviewFutureDirection')}</div>
							<div className="mt-1 text-xs leading-5 text-indigo-800">
								{t('reviewFutureDirectionHint')}
							</div>
						</div>
					</aside>

					<main className="min-w-0">
						{error && (
							<div className="mb-4">
								<ReviewStateBanner
									state="UNAVAILABLE"
									message={error}
								/>
							</div>
						)}
						{!selectedTournament ? (
							<ReviewStateBanner
								state="UNAVAILABLE"
								message={t('noLinked')}
							/>
						) : (
							<>
								<div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
									<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
										<div>
											<div className="text-xs uppercase tracking-wide text-slate-500">
												{selectedTournament.creator}
											</div>
											<h2 className="mt-1 text-2xl font-semibold text-slate-950">
												{selectedTournament.name}
											</h2>
											<div className="mt-2 text-sm text-slate-500">
												{t('teams', { count: selectedTournament.totalTeamNum })}{' '}
												· {formatLabel(format, t)}
											</div>
										</div>
										<div className="text-right text-xs text-slate-500">
											<div>
												{view === 'gameweek'
													? t('viewGameweek')
													: t('viewSeason')}
											</div>
											<SettlementMeta
												settledAt={
													view === 'gameweek'
														? gameweekReview?.scope?.settledAt
														: selectedPhase?.settledAt
												}
												publishedAt={
													view === 'gameweek'
														? gameweekReview?.scope?.publishedAt
														: selectedPhase?.publishedAt
												}
											/>
										</div>
									</div>
									<div
										className="mt-5 flex flex-wrap gap-2"
										role="tablist"
										aria-label={t('viewSwitchLabel')}
									>
										<button
											type="button"
											role="tab"
											aria-selected={view === 'gameweek'}
											onClick={() => chooseView('gameweek')}
											className={`rounded-full px-4 py-2 text-sm font-medium ${view === 'gameweek' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}
										>
											{t('viewGameweek')}
										</button>
										<button
											type="button"
											role="tab"
											aria-selected={view === 'season'}
											onClick={() => chooseView('season')}
											className={`rounded-full px-4 py-2 text-sm font-medium ${view === 'season' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}
										>
											{t('viewSeason')}
										</button>
									</div>
									{view === 'season' && seasonReview?.phases.length ? (
										<div
											className="mt-3 flex flex-wrap gap-2"
											role="tablist"
											aria-label={t('reviewPhaseTimeline')}
										>
											{seasonReview.phases.map(phase => (
												<button
													key={phase.phaseId}
													type="button"
													role="tab"
													aria-selected={
														selectedPhase?.phaseId === phase.phaseId
													}
													onClick={() => choosePhase(phase.phaseId)}
													className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selectedPhase?.phaseId === phase.phaseId ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'}`}
												>
													{formatLabel(phase.format, t)} · GW
													{phase.startEventId}–{phase.endEventId}
												</button>
											))}
										</div>
									) : null}
								</div>

								<div className="mt-4">
									{loading ? (
										<ReviewStateBanner
											state="PENDING"
											message={t('loading')}
										/>
									) : (
										<ReviewStateBanner state={state} />
									)}
									{!loading &&
									state !== 'READY' &&
									selectedTournament.previousReadyEventId &&
									selectedTournament.previousReadyEventId !== eventId ? (
										<div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
											<div className="text-xs text-slate-500">
												{t('reviewPreviousReadyHint')}
											</div>
											<button
												type="button"
												onClick={() =>
													chooseEvent(
														String(selectedTournament.previousReadyEventId)
													)
												}
												className="mt-2 text-sm font-medium text-indigo-700 underline-offset-2 hover:underline"
											>
												{t('reviewPreviousReady', {
													gameweek: selectedTournament.previousReadyEventId
												})}
											</button>
										</div>
									) : null}
									{!loading && state !== 'READY' && eventId ? (
										<Link
											href={`/live/competitions/${selectedTournament.tournamentId}?gw=${eventId}`}
											className="mt-3 inline-block text-sm font-medium text-indigo-700 underline-offset-2 hover:underline"
										>
											{t('reviewLiveLink')}
										</Link>
									) : null}
								</div>
								{activeReview && state === 'READY' && format && (
									<div className="mt-5">
										<ReviewPayload
											review={activeReview}
											format={format}
											view={view}
											loadingMore={loading || loadingMore}
											onLoadMore={() => void loadMore()}
										/>
									</div>
								)}
								{activeReview &&
									state === 'READY' &&
									!activeReview.points &&
									!activeReview.h2h &&
									!activeReview.knockout && (
										<div className="mt-5">
											<ReviewStateBanner
												state="UNAVAILABLE"
												message={t('reviewPayloadMissing')}
											/>
										</div>
									)}
							</>
						)}
					</main>
				</div>
			</div>
		</div>
	)
}
