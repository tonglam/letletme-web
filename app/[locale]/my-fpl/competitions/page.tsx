import TournamentStatsClient from '@/app/me/tournament/TournamentStatsClient'
import {
	aggregateToRankingSummary,
	aggregateToSeasonSnapshot,
	boardRowsToEventResults
} from '@/app/me/tournament/_lib/my-fpl-adapters'
import { parseTournamentStatsView } from '@/app/me/tournament/_lib/tournament-stats-url'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import {
	GET_MY_FPL_COMPETITION_BOARD,
	GET_MY_FPL_COMPETITIONS_DESK,
	type MyFplCompetitionAggregate,
	type MyFplCompetitionBoardPage,
	type MyFplCompetitionBoardResponse,
	type MyFplCompetitionsDeskResponse,
	type MyFplReviewState,
	type MyFplSnapshotMeta
} from '@/lib/graphql/operations/my-fpl'
import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { getVerifiedEntryContext } from '@/lib/session'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { RouteLoaderTiming } from '@/lib/route-loader-timing'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: LocaleParams
	searchParams: Promise<{
		tournamentId?: string
		view?: string
		gw?: string
	}>
}

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/my-fpl/competitions',
		titleKey: 'tournamentStatsTitle',
		descriptionKey: 'tournamentStatsDescription'
	})
}

function TournamentStatsFallback() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-8">
			<div className="h-8 w-48 animate-pulse rounded bg-muted/60" />
			<div className="mt-6 h-28 w-full animate-pulse rounded-xl bg-muted/40" />
			<div className="mt-6 h-40 w-full animate-pulse rounded-xl bg-muted/40" />
		</div>
	)
}

const positiveInteger = (value: string | undefined): number | null => {
	const parsed = Number(value)
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

/** My Competitions review is backed by one pinned My FPL publication revision. */
export default async function TournamentStatsPage({
	params,
	searchParams
}: PageProps) {
	const timing = new RouteLoaderTiming('/my-fpl/competitions')
	const [pageLocale, t, sp, context] = await Promise.all([
		getPageLocale(params),
		getTranslations('States'),
		searchParams,
		timing.measure('session', () => getVerifiedEntryContext())
	])
	const { locale } = pageLocale
	const initialView = parseTournamentStatsView(sp.view)

	const { session, entryId } = context
	if (!session) {
		timing.finish('redirect-login')
		redirect(localizeHref('/auth/login?next=/my-fpl/competitions', locale))
	}
	if (!entryId) {
		timing.finish('redirect-bind')
		redirect(localizeHref('/onboarding/bind-entry', locale))
	}

	const requestedTournamentId = positiveInteger(sp.tournamentId)
	const requestedEventId = positiveInteger(sp.gw)

	let initialTournaments: EntryTournament[] = []
	let initialSelectedTournamentId = ''
	let initialDataGameweek: number | null = null
	let initialSliceGameweek: number | null = null
	let initialCurrentRows = [] as ReturnType<typeof boardRowsToEventResults>
	let initialSeasonFieldRows = initialCurrentRows
	let initialSeasonSnapshot = null as ReturnType<
		typeof aggregateToSeasonSnapshot
	>
	let initialPreviousRows = initialCurrentRows
	let initialRankingSummary = null as ReturnType<
		typeof aggregateToRankingSummary
	>
	let initialBoard: MyFplCompetitionBoardPage | null = null
	let initialAggregate: MyFplCompetitionAggregate | null = null
	let initialPlayerMeta: Record<
		number,
		{ webName: string; teamShortName: string }
	> = {}
	let initialReviewState: MyFplReviewState = 'EMPTY'
	let initialError: string | null = null
	let usedFallbackGameweek = false
	let currentGameweek = 0
	let initialLatestFinalizedGameweek: number | null = null
	let initialSnapshotMeta: MyFplSnapshotMeta | null = null

	try {
		let response: MyFplCompetitionsDeskResponse
		try {
			response = await timing.measure('my-fpl-competitions-desk', () =>
				executeServerQueryWithSession<MyFplCompetitionsDeskResponse>(
					session,
					GET_MY_FPL_COMPETITIONS_DESK,
					{
						tournamentId: requestedTournamentId,
						eventId: initialView === 'season' ? null : requestedEventId
					},
					{ cache: 'no-store' }
				)
			)
		} catch (error) {
			// A stale/non-member URL must not hide the authenticated tournament list.
			if (requestedTournamentId === null) throw error
			console.warn(
				'[tournament stats] selected tournament unavailable; retrying list:',
				error
			)
			response = await timing.measure('my-fpl-competitions-list-retry', () =>
				executeServerQueryWithSession<MyFplCompetitionsDeskResponse>(
					session,
					GET_MY_FPL_COMPETITIONS_DESK,
					{
						tournamentId: null,
						eventId: initialView === 'season' ? null : requestedEventId
					},
					{ cache: 'no-store' }
				)
			)
		}

		const desk = response.myFplCompetitionsDesk
		initialTournaments = desk.tournaments
		initialSelectedTournamentId = String(desk.selectedTournamentId ?? '')
		initialReviewState = desk.state
		initialSnapshotMeta = desk.snapshotMeta
		if (
			desk.state === 'READY' &&
			desk.selectedTournamentId !== null &&
			desk.eventId !== null
		) {
			const boardResponse = await timing.measure(
				'my-fpl-competition-board',
				() =>
					executeServerQueryWithSession<MyFplCompetitionBoardResponse>(
						session,
						GET_MY_FPL_COMPETITION_BOARD,
						{
							tournamentId: desk.selectedTournamentId,
							eventId: desk.eventId,
							page: 1,
							pageSize: 100,
							search: null,
							snapshotRevision: desk.snapshotMeta?.revision ?? null
						},
						{ cache: 'no-store' }
					)
			)
			initialBoard = boardResponse.myFplCompetitionBoard
			initialReviewState = initialBoard.state
		}
		const reviewReady = initialReviewState === 'READY'
		if (!reviewReady) initialBoard = null
		initialAggregate = reviewReady ? desk.aggregate : null
		currentGameweek =
			desk.context.currentEventId ?? desk.context.latestFinalizedEventId ?? 0
		initialSliceGameweek = reviewReady ? desk.eventId : null
		const rows = boardRowsToEventResults(initialBoard, desk.selectedTournament)
		initialCurrentRows = initialReviewState === 'READY' ? rows : []
		initialSeasonFieldRows = initialCurrentRows
		initialLatestFinalizedGameweek = desk.context.latestFinalizedEventId ?? null
		initialDataGameweek =
			initialReviewState === 'READY' && desk.eventId !== null
				? initialView === 'season'
					? (initialLatestFinalizedGameweek ?? desk.eventId)
					: desk.eventId
				: null
		initialSeasonSnapshot = reviewReady
			? aggregateToSeasonSnapshot(initialAggregate, initialBoard)
			: null
		initialRankingSummary = reviewReady
			? aggregateToRankingSummary(initialAggregate)
			: null

		console.info('[tournament stats] SSR snapshot desk seed', {
			view: initialView,
			requestedTournamentId,
			requestedEventId,
			selectedTournamentId: desk.selectedTournamentId,
			currentGw: desk.context.currentEventId,
			latestFinalizedGw: desk.context.latestFinalizedEventId,
			state: initialReviewState,
			rows: initialCurrentRows.length,
			fieldSize: initialBoard?.fieldSize ?? 0
		})
	} catch (error) {
		console.error('[tournament stats] Failed to seed finalized desk:', error)
		initialError = t('tournamentStatsFailed')
	}
	timing.finish(initialError ? 'unavailable' : 'ready')

	return (
		<Suspense fallback={<TournamentStatsFallback />}>
			<TournamentStatsClient
				entryId={entryId}
				initialCurrentGameweek={currentGameweek}
				initialLatestFinalizedGameweek={initialLatestFinalizedGameweek}
				initialTournaments={initialTournaments}
				initialSelectedTournamentId={initialSelectedTournamentId}
				initialDataGameweek={initialDataGameweek}
				initialSliceGameweek={initialSliceGameweek}
				initialCurrentRows={initialCurrentRows}
				initialSeasonFieldRows={initialSeasonFieldRows}
				initialSeasonSnapshot={initialSeasonSnapshot}
				initialPreviousRows={initialPreviousRows}
				initialRankingSummary={initialRankingSummary}
				initialPlayerMeta={initialPlayerMeta}
				initialUsedFallbackGameweek={usedFallbackGameweek}
				initialReviewState={initialReviewState}
				initialBoard={initialBoard}
				initialAggregate={initialAggregate}
				initialError={initialError}
				initialSnapshotMeta={initialSnapshotMeta}
			/>
		</Suspense>
	)
}
