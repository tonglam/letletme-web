import TournamentReviewV2Client from '@/app/me/tournament/TournamentReviewV2Client'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import {
	GET_ENTRY_LEAGUES,
	selectUntrackedFplClassicLeagueRanks,
	type EntryLeaguesResponse,
	type FplClassicLeagueRank
} from '@/lib/graphql/operations/leagues'
import {
	GET_MY_TOURNAMENT_GAMEWEEK_REVIEW,
	GET_MY_TOURNAMENT_REVIEW_CATALOG,
	GET_MY_TOURNAMENT_SEASON_REVIEW,
	type MyTournamentGameweekReviewResponse,
	type MyTournamentReviewCatalogResponse,
	type MyTournamentReviewScope,
	type MyTournamentSeasonReviewResponse
} from '@/lib/graphql/operations/my-fpl'
import { getVerifiedEntryContext } from '@/lib/session'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { RouteLoaderTiming } from '@/lib/route-loader-timing'
import { parseTournamentStatsView } from '@/app/me/tournament/_lib/tournament-stats-url'
import { selectTournamentReviewEventId } from '@/app/me/tournament/_lib/tournament-review-v2'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: LocaleParams
	searchParams: Promise<{
		tournamentId?: string
		view?: string
		gw?: string
		scope?: string
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

function TournamentReviewFallback() {
	return (
		<div className="container mx-auto max-w-6xl px-4 py-8">
			<div className="h-8 w-64 animate-pulse rounded bg-muted/60" />
			<div className="mt-6 h-28 w-full animate-pulse rounded-xl bg-muted/40" />
			<div className="mt-6 h-56 w-full animate-pulse rounded-xl bg-muted/40" />
		</div>
	)
}

const positiveInteger = (value: string | undefined): number | null => {
	const parsed = Number(value)
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

const requestedScope = (value: string | undefined): MyTournamentReviewScope =>
	value?.toLowerCase() === 'all' ? 'ALL' : 'ACCESSIBLE'

const catalogNodes = (
	catalog: MyTournamentReviewCatalogResponse['myTournamentReviewCatalog']
) => catalog.edges.map(edge => edge.node)

const eventIdsFromPhases = (
	phases: MyTournamentSeasonReviewResponse['myTournamentSeasonReview']['phases'],
	latest: number | null
) => {
	const ids = phases.flatMap(phase => {
		const values: number[] = []
		for (
			let eventId = phase.startEventId;
			eventId <= phase.endEventId;
			eventId += 1
		) {
			values.push(eventId)
		}
		return values
	})
	return ids.length > 0 ? ids : latest ? [latest] : []
}

const isScopeAuthorizationError = (error: unknown): boolean => {
	if (!error || typeof error !== 'object') return false
	const candidate = error as { code?: unknown; status?: unknown }
	return candidate.code === 'FORBIDDEN' || candidate.status === 403
}

/**
 * V2 is the only new consumer path: this page reads immutable, finalized
 * tournament-review publications. Unsettled gameweeks remain in Live.
 */
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
	let scope = requestedScope(sp.scope)

	const { session, entryId } = context
	if (!session) {
		timing.finish('redirect-login')
		redirect(localizeHref('/auth/login?next=/my-fpl/competitions', locale))
	}
	if (!entryId) {
		timing.finish('redirect-bind')
		redirect(localizeHref('/onboarding/bind-entry', locale))
	}

	const fplClassicRanksPromise: Promise<FplClassicLeagueRank[]> = timing
		.measure('fpl-classic-ranks', () =>
			executeServerQueryWithSession<EntryLeaguesResponse>(
				session,
				GET_ENTRY_LEAGUES,
				{ entryId },
				{ cache: 'no-store', timeoutMs: 1_500 }
			)
		)
		.then(response =>
			selectUntrackedFplClassicLeagueRanks(response.entryLeagues)
		)
		.catch(error => {
			console.warn('[tournament review] FPL Classic ranks unavailable', {
				error: error instanceof Error ? error.name : 'UnknownError'
			})
			return []
		})

	const requestedTournamentId = positiveInteger(sp.tournamentId)
	const requestedEventId = positiveInteger(sp.gw)
	let initialCatalog: MyTournamentReviewCatalogResponse['myTournamentReviewCatalog'] =
		{
			state: 'UNAVAILABLE',
			asOf: new Date().toISOString(),
			viewerEntryId: entryId,
			adminReadAll: false,
			edges: [],
			pageInfo: { hasNextPage: false, endCursor: null }
		}
	let initialSelectedTournamentId: number | null = null
	let initialEventId: number | null = null
	let initialFinalizedEventIds: number[] = []
	let initialGameweekReview:
		MyTournamentGameweekReviewResponse['myTournamentGameweekReview'] | null =
		null
	let initialSeasonReview:
		MyTournamentSeasonReviewResponse['myTournamentSeasonReview'] | null = null
	let initialError: string | null = null

	try {
		let catalogResponse: MyTournamentReviewCatalogResponse
		try {
			catalogResponse = await timing.measure(
				'my-tournament-review-v2.1-catalog',
				() =>
					executeServerQueryWithSession<MyTournamentReviewCatalogResponse>(
						session,
						GET_MY_TOURNAMENT_REVIEW_CATALOG,
						{ scope, first: 50 },
						{ cache: 'no-store', contract: 'my-tournament-review-v2.1' }
					)
			)
		} catch (error) {
			// A query-string scope is a preference, not proof of the platform
			// admin capability. Fall back to the viewer's accessible catalog when
			// a shared/manual `scope=all` URL is opened by a normal user.
			if (scope !== 'ALL' || !isScopeAuthorizationError(error)) throw error
			scope = 'ACCESSIBLE'
			catalogResponse = await timing.measure(
				'my-tournament-review-v2.1-catalog-accessible-fallback',
				() =>
					executeServerQueryWithSession<MyTournamentReviewCatalogResponse>(
						session,
						GET_MY_TOURNAMENT_REVIEW_CATALOG,
						{ scope, first: 50 },
						{ cache: 'no-store', contract: 'my-tournament-review-v2.1' }
					)
			)
		}
		initialCatalog = catalogResponse.myTournamentReviewCatalog
		const selected =
			catalogNodes(initialCatalog).find(
				item => item.tournamentId === requestedTournamentId
			) ??
			catalogNodes(initialCatalog)[0] ??
			null
		initialSelectedTournamentId = selected?.tournamentId ?? null
		const latestSettledEventId = selected?.latestFinalizedEventId ?? null
		if (initialSelectedTournamentId && latestSettledEventId) {
			// Resolve the tournament's immutable event set before accepting a URL
			// gameweek. A positive event below the latest one may still predate a
			// custom tournament and therefore have no publication.
			const latestSeasonResponse = await timing.measure(
				'my-tournament-review-v2.1-event-index',
				() =>
					executeServerQueryWithSession<MyTournamentSeasonReviewResponse>(
						session,
						GET_MY_TOURNAMENT_SEASON_REVIEW,
						{
							tournamentId: initialSelectedTournamentId,
							throughEventId: latestSettledEventId
						},
						{ cache: 'no-store', contract: 'my-tournament-review-v2.1' }
					)
			)
			const latestSeasonReview = latestSeasonResponse.myTournamentSeasonReview
			initialFinalizedEventIds = eventIdsFromPhases(
				latestSeasonReview.phases,
				latestSeasonReview.latestFinalizedEventId
			)
			initialEventId = selectTournamentReviewEventId(
				requestedEventId,
				latestSettledEventId,
				initialFinalizedEventIds
			)

			if (initialEventId) {
				const [gameweekResponse, seasonResponse] = await timing.measure(
					'my-tournament-review-v2.1-snapshots',
					() =>
						Promise.all([
							executeServerQueryWithSession<MyTournamentGameweekReviewResponse>(
								session,
								GET_MY_TOURNAMENT_GAMEWEEK_REVIEW,
								{
									tournamentId: initialSelectedTournamentId,
									eventId: initialEventId,
									first: 50
								},
								{ cache: 'no-store', contract: 'my-tournament-review-v2.1' }
							),
							initialEventId === latestSettledEventId
								? Promise.resolve(latestSeasonResponse)
								: executeServerQueryWithSession<MyTournamentSeasonReviewResponse>(
										session,
										GET_MY_TOURNAMENT_SEASON_REVIEW,
										{
											tournamentId: initialSelectedTournamentId,
											throughEventId: initialEventId
										},
										{ cache: 'no-store', contract: 'my-tournament-review-v2.1' }
									)
						])
				)
				initialGameweekReview = gameweekResponse.myTournamentGameweekReview
				initialSeasonReview = seasonResponse.myTournamentSeasonReview
			}
		}
	} catch (error) {
		// Keep server logs free of query variables, identities, and upstream
		// response bodies. The request-stage metric carries the bounded failure
		// outcome for diagnosis.
		console.error('[tournament review v2] Finalized review seed unavailable')
		initialError = t('tournamentStatsFailed')
	}
	const initialFplClassicRanks = await fplClassicRanksPromise

	timing.finish(initialError ? 'unavailable' : 'ready')
	return (
		<Suspense fallback={<TournamentReviewFallback />}>
			<TournamentReviewV2Client
				entryId={entryId}
				initialFplClassicRanks={initialFplClassicRanks}
				initialCatalog={initialCatalog}
				initialScope={scope}
				initialView={initialView}
				initialSelectedTournamentId={initialSelectedTournamentId}
				initialEventId={initialEventId}
				initialFinalizedEventIds={initialFinalizedEventIds}
				initialGameweekReview={initialGameweekReview}
				initialSeasonReview={initialSeasonReview}
				initialError={initialError}
			/>
		</Suspense>
	)
}
