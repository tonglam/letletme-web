'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { executeQuery, type GraphQLRequestError } from '@/lib/graphql-client'
import {
	GET_MY_TOURNAMENT_GAMEWEEK_REVIEW,
	GET_MY_TOURNAMENT_REVIEW_CATALOG,
	GET_MY_TOURNAMENT_SEASON_REVIEW,
	type MyTournamentGameweekReview,
	type MyTournamentGameweekReviewResponse,
	type MyTournamentReviewCatalogResponse,
	type MyTournamentReviewFormat,
	type MyTournamentReviewH2H,
	type MyTournamentReviewKnockout,
	type MyTournamentReviewPoints,
	type MyTournamentReviewFreshness,
	type MyTournamentReviewScope,
	type MyTournamentReviewState,
	type MyTournamentSeasonReview,
	type MyTournamentSeasonReviewResponse
} from '@/lib/graphql/operations/my-fpl'

type Catalog = MyTournamentReviewCatalogResponse['myTournamentReviewCatalog']

export interface TournamentReviewV2ClientProps {
	entryId: number
	initialCatalog: Catalog
	initialScope: MyTournamentReviewScope
	initialView: 'gameweek' | 'season'
	initialSelectedTournamentId: number | null
	initialEventId: number | null
	initialGameweekReview: MyTournamentGameweekReview | null
	initialSeasonReview: MyTournamentSeasonReview | null
	initialError: string | null
}

const CONTRACT = 'my-tournament-review-v2' as const

const formatLabel = (
	format: MyTournamentReviewFormat | null | undefined,
	t: ReturnType<typeof useTranslations>
) => {
	if (format === 'H2H') return t('reviewFormatH2H')
	if (format === 'KNOCKOUT') return t('reviewFormatKnockout')
	return t('reviewFormatPoints')
}

const stateLabel = (
	state: MyTournamentReviewState,
	t: ReturnType<typeof useTranslations>
) => {
	if (state === 'READY') return t('reviewReady')
	if (state === 'WAITING_SOURCE') return t('reviewWaitingSource')
	if (state === 'DEGRADED') return t('reviewDegraded')
	if (state === 'PENDING') return t('reviewPending')
	return t('reviewUnavailable')
}

const numberOrDash = (value: number | null | undefined) =>
	value === null || value === undefined ? '—' : value.toLocaleString()

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

function mergeSeasonPage(
	previous: MyTournamentSeasonReview,
	next: MyTournamentSeasonReview
): MyTournamentSeasonReview {
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

function Freshness({
	freshness
}: {
	freshness: MyTournamentReviewFreshness | null | undefined
}) {
	const t = useTranslations('TournamentStats')
	if (!freshness) return null
	return (
		<div className="text-xs text-slate-500">
			{t('reviewFreshness', { seconds: freshness.ageSeconds })} ·{' '}
			{new Date(freshness.publishedAt).toLocaleString()}
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
	loadingMore,
	onLoadMore
}: {
	points: MyTournamentReviewPoints
	loadingMore: boolean
	onLoadMore?: () => void
}) {
	const t = useTranslations('TournamentStats')
	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-3">
				<div className="rounded-2xl border bg-white p-4 shadow-sm">
					<div className="text-xs uppercase tracking-wide text-slate-500">
						{t('reviewGross')}
					</div>
					<div className="mt-1 text-2xl font-semibold text-slate-950">
						{numberOrDash(points.grossPointsTotal)}
					</div>
					<div className="text-xs text-slate-500">
						{t('reviewGrossAverage', { value: points.grossPointsAverage })}
					</div>
				</div>
				<div className="rounded-2xl border bg-white p-4 shadow-sm">
					<div className="text-xs uppercase tracking-wide text-slate-500">
						{t('reviewNet')}
					</div>
					<div className="mt-1 text-2xl font-semibold text-slate-950">
						{numberOrDash(points.netPointsTotal)}
					</div>
					<div className="text-xs text-slate-500">{t('reviewNetHint')}</div>
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
							<th className="px-4 py-3 text-right">{t('reviewGross')}</th>
							<th className="px-4 py-3 text-right">{t('reviewCost')}</th>
							<th className="px-4 py-3 text-right">{t('reviewNet')}</th>
							<th className="px-4 py-3 text-right">
								{t('reviewTournamentScore')}
							</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{points.rows.map(row => (
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
									<div className="text-xs text-slate-500">{row.playerName}</div>
								</td>
								<td className="px-4 py-3 text-right">
									{numberOrDash(row.grossPoints)}
								</td>
								<td className="px-4 py-3 text-right text-rose-700">
									{numberOrDash(row.transferCost)}
								</td>
								<td className="px-4 py-3 text-right font-medium">
									{numberOrDash(row.netPoints)}
								</td>
								<td className="px-4 py-3 text-right">
									{numberOrDash(row.tournamentScore)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				<LoadMore
					hasNextPage={points.hasNextPage}
					loading={loadingMore}
					onLoadMore={onLoadMore}
				/>
			</div>
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
											: (match.home?.entryName ?? t('reviewAverage'))}
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
											: (match.away?.entryName ?? t('reviewAverage'))}
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
	loadingMore,
	onLoadMore
}: {
	review: MyTournamentGameweekReview | MyTournamentSeasonReview
	format: MyTournamentReviewFormat | null
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
				loadingMore={loadingMore}
				onLoadMore={onLoadMore}
			/>
		)
	return null
}

export default function TournamentReviewV2Client({
	entryId,
	initialCatalog,
	initialScope,
	initialView,
	initialSelectedTournamentId,
	initialEventId,
	initialGameweekReview,
	initialSeasonReview,
	initialError
}: TournamentReviewV2ClientProps) {
	const t = useTranslations('TournamentStats')
	const [catalog, setCatalog] = useState(initialCatalog)
	const [scope, setScope] = useState<MyTournamentReviewScope>(initialScope)
	const [selectedTournamentId, setSelectedTournamentId] = useState<
		number | null
	>(initialSelectedTournamentId)
	const [eventId, setEventId] = useState<number | null>(initialEventId)
	const [view, setView] = useState<'gameweek' | 'season'>(initialView)
	const [gameweekReview, setGameweekReview] = useState(initialGameweekReview)
	const [seasonReview, setSeasonReview] = useState(initialSeasonReview)
	const [loading, setLoading] = useState(false)
	const [loadingMore, setLoadingMore] = useState(false)
	const [error, setError] = useState<string | null>(initialError)
	const requestSequence = useRef(0)

	const selectedTournament = useMemo(
		() =>
			catalog.tournaments.find(
				tournament => tournament.tournamentId === selectedTournamentId
			) ?? null,
		[catalog.tournaments, selectedTournamentId]
	)

	const loadReview = async (tournamentId: number, nextEventId: number) => {
		const requestId = ++requestSequence.current
		setLoading(true)
		setLoadingMore(false)
		setError(null)
		try {
			const [gameweek, season] = await Promise.all([
				executeQuery<MyTournamentGameweekReviewResponse>(
					GET_MY_TOURNAMENT_GAMEWEEK_REVIEW,
					{ tournamentId, eventId: nextEventId, first: 100 },
					{ cache: 'no-store', contract: CONTRACT }
				),
				executeQuery<MyTournamentSeasonReviewResponse>(
					GET_MY_TOURNAMENT_SEASON_REVIEW,
					{ tournamentId, throughEventId: nextEventId, first: 100 },
					{ cache: 'no-store', contract: CONTRACT }
				)
			])
			if (requestId !== requestSequence.current) return
			setGameweekReview(gameweek.myTournamentGameweekReview)
			setSeasonReview(season.myTournamentSeasonReview)
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
		if (loadingMore || !selectedTournamentId || !eventId) return
		const activeReview = view === 'gameweek' ? gameweekReview : seasonReview
		const nextCursor =
			activeReview?.points?.nextCursor ??
			activeReview?.h2h?.nextCursor ??
			activeReview?.knockout?.nextCursor
		if (!nextCursor) return
		const requestId = ++requestSequence.current
		const requestView = view
		const requestTournamentId = selectedTournamentId
		const requestEventId = eventId
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
						after: nextCursor
					},
					{ cache: 'no-store', contract: CONTRACT }
				)
				if (requestId !== requestSequence.current) return
				setGameweekReview(previous =>
					previous
						? mergeGameweekPage(previous, response.myTournamentGameweekReview)
						: response.myTournamentGameweekReview
				)
			} else {
				const response = await executeQuery<MyTournamentSeasonReviewResponse>(
					GET_MY_TOURNAMENT_SEASON_REVIEW,
					{
						tournamentId: requestTournamentId,
						throughEventId: requestEventId,
						first: 100,
						after: nextCursor
					},
					{ cache: 'no-store', contract: CONTRACT }
				)
				if (requestId !== requestSequence.current) return
				setSeasonReview(previous =>
					previous
						? mergeSeasonPage(previous, response.myTournamentSeasonReview)
						: response.myTournamentSeasonReview
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

	const switchScope = async () => {
		const requestId = ++requestSequence.current
		const nextScope: MyTournamentReviewScope =
			scope === 'ALL' ? 'ACCESSIBLE' : 'ALL'
		setLoading(true)
		setLoadingMore(false)
		setError(null)
		try {
			const response = await executeQuery<MyTournamentReviewCatalogResponse>(
				GET_MY_TOURNAMENT_REVIEW_CATALOG,
				{ scope: nextScope },
				{ cache: 'no-store', contract: CONTRACT }
			)
			if (requestId !== requestSequence.current) return
			const nextCatalog = response.myTournamentReviewCatalog
			const nextSelected =
				nextCatalog.tournaments.find(
					item => item.tournamentId === selectedTournamentId
				) ??
				nextCatalog.tournaments[0] ??
				null
			setScope(nextScope)
			setCatalog(nextCatalog)
			setSelectedTournamentId(nextSelected?.tournamentId ?? null)
			const nextEventId =
				nextSelected?.latestAvailableEventId ??
				nextSelected?.latestFinalizedEventId ??
				null
			setEventId(nextEventId)
			setGameweekReview(null)
			setSeasonReview(null)
			if (nextSelected && nextEventId)
				void loadReview(nextSelected.tournamentId, nextEventId)
			else setLoading(false)
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
		if (gameweekReview || seasonReview) return
		void loadReview(selectedTournamentId, eventId)
		// Initial server data is intentionally used once; subsequent changes load explicitly.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const chooseTournament = (value: string) => {
		const nextId = Number(value)
		const tournament = catalog.tournaments.find(
			item => item.tournamentId === nextId
		)
		if (!tournament) return
		const nextEventId =
			tournament.latestAvailableEventId ?? tournament.latestFinalizedEventId
		setSelectedTournamentId(nextId)
		setEventId(nextEventId)
		setGameweekReview(null)
		setSeasonReview(null)
		if (nextEventId) void loadReview(nextId, nextEventId)
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
		void loadReview(selectedTournamentId, nextEventId)
	}

	const chooseView = (nextView: 'gameweek' | 'season') => {
		setLoadingMore(false)
		setView(nextView)
	}

	const format =
		gameweekReview?.scope?.format ??
		seasonReview?.format ??
		selectedTournament?.latestFormat ??
		null
	const activeReview = view === 'gameweek' ? gameweekReview : seasonReview
	const state =
		activeReview?.state ?? selectedTournament?.state ?? 'UNAVAILABLE'
	const finalizedEventIds =
		seasonReview?.finalizedEventIds ?? (eventId ? [eventId] : [])

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
							{catalog.tournaments.map(tournament => (
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
											<Freshness
												freshness={
													view === 'gameweek'
														? gameweekReview?.scope?.freshness
														: seasonReview?.freshness
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
								</div>
								{activeReview && state === 'READY' && format && (
									<div className="mt-5">
										<ReviewPayload
											review={activeReview}
											format={format}
											loadingMore={loadingMore}
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
