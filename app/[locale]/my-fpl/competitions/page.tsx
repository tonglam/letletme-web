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
	GET_MY_TOURNAMENT_SEASON_REVIEW_SECTION,
	GET_MY_TOURNAMENT_SEASON_REVIEW,
	type MyTournamentGameweekReviewResponse,
	type MyTournamentReviewCatalogResponse,
	type MyTournamentReviewScope,
	type MyTournamentSeasonReviewResponse,
	type MyTournamentSeasonSection,
	type MyTournamentSeasonSectionResponse
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
	if (latest === null) return []
	const ids = phases.flatMap(phase => {
		const values: number[] = []
		const endEventId = Math.min(phase.endEventId, latest)
		for (
			let eventId = phase.startEventId;
			eventId <= endEventId;
			eventId += 1
		) {
			// The phase window can extend into future rounds. Only the
			// authoritative finalized cutoff belongs in the review selector.
			if (eventId <= latest) values.push(eventId)
		}
		return values
	})
	return ids.length > 0 ? ids : latest ? [latest] : []
}

function phaseAtEvent(
	phases: MyTournamentSeasonReviewResponse['myTournamentSeasonReview']['phases'],
	eventId: number
) {
	return (
		phases.find(
			phase => phase.startEventId <= eventId && phase.endEventId >= eventId
		) ??
		phases.filter(phase => phase.startEventId <= eventId).at(-1) ??
		null
	)
}

const sectionForFormat = (
	format: MyTournamentSeasonReviewResponse['myTournamentSeasonReview']['phases'][number]['format']
) =>
	format === 'POINTS'
		? 'POINTS_STANDINGS'
		: format === 'H2H'
			? 'H2H_STANDINGS'
			: 'KNOCKOUT_BRACKET'

/** Attach the first settled section page to the server seed. The client can
 * hydrate the initial Season view without immediately re-fetching the same
 * immutable bundle after mount. H2H gets both independent projections because
 * the review UI renders fixtures and standings together. */
async function hydrateSeasonSeed(
	session: NonNullable<
		Awaited<ReturnType<typeof getVerifiedEntryContext>>['session']
	>,
	tournamentId: number,
	throughEventId: number,
	review: MyTournamentSeasonReviewResponse['myTournamentSeasonReview']
): Promise<{
	review: MyTournamentSeasonReviewResponse['myTournamentSeasonReview']
	sections: MyTournamentSeasonSection[]
	error: unknown | null
}> {
	const phase = phaseAtEvent(review.phases, throughEventId)
	if (
		!phase ||
		phase.state !== 'READY' ||
		!phase.revision ||
		!phase.semanticSha256
	)
		return { review, sections: [], error: null }
	const fetchSection = async (
		section:
			| 'POINTS_STANDINGS'
			| 'POINTS_TRAJECTORIES'
			| 'H2H_STANDINGS'
			| 'H2H_FIXTURES'
			| 'KNOCKOUT_BRACKET'
	) =>
		executeServerQueryWithSession<MyTournamentSeasonSectionResponse>(
			session,
			GET_MY_TOURNAMENT_SEASON_REVIEW_SECTION,
			{
				tournamentId,
				throughEventId,
				phaseId: phase.phaseId,
				section,
				first: 100,
				after: null,
				revision: phase.revision,
				semanticSha256: phase.semanticSha256
			},
			{ cache: 'no-store', contract: 'my-tournament-review-v2.1' }
		)
	const optionalSection =
		phase.format === 'POINTS'
			? 'POINTS_TRAJECTORIES'
			: phase.format === 'H2H'
				? 'H2H_FIXTURES'
				: null
	const [primaryResult, optionalResult] = await Promise.allSettled([
		fetchSection(sectionForFormat(phase.format)),
		optionalSection ? fetchSection(optionalSection) : Promise.resolve(null)
	])
	if (primaryResult.status === 'rejected')
		return { review, sections: [], error: primaryResult.reason }
	const primary = primaryResult.value
	const optional =
		optionalResult.status === 'fulfilled' ? optionalResult.value : null
	const sectionHasRows = (
		candidate: MyTournamentSeasonSection | null,
		expectedSection: MyTournamentSeasonSection['section']
	) => {
		if (
			!candidate ||
			candidate.state !== 'READY' ||
			candidate.section !== expectedSection
		)
			return false
		if (
			candidate.section === 'POINTS_STANDINGS' ||
			candidate.section === 'POINTS_TRAJECTORIES'
		)
			return candidate.points !== null
		if (
			candidate.section === 'H2H_STANDINGS' ||
			candidate.section === 'H2H_FIXTURES'
		)
			return candidate.h2h !== null
		return candidate.knockout !== null
	}
	const primarySection = primary.myTournamentSeasonReviewSection
	if (!sectionHasRows(primarySection, sectionForFormat(phase.format)))
		throw new Error('primary season review section is incomplete')
	const optionalPayload = optional?.myTournamentSeasonReviewSection ?? null
	const optionalSectionFailed =
		optionalResult.status === 'rejected' ||
		(optionalSection !== null &&
			!sectionHasRows(optionalPayload, optionalSection))
	const trajectories =
		optionalSection === 'POINTS_TRAJECTORIES' && !optionalSectionFailed
			? optional
			: null
	const fixtures =
		optionalSection === 'H2H_FIXTURES' && !optionalSectionFailed
			? optional
			: null
	const section = primarySection
	const h2h =
		phase.format === 'H2H'
			? {
					...(section.h2h ?? {
						matches: [],
						standings: [],
						nextCursor: null,
						hasNextPage: false
					}),
					matches:
						fixtures?.myTournamentSeasonReviewSection.h2h?.matches ??
						section.h2h?.matches ??
						[],
					hasNextPage: Boolean(
						section.h2h?.hasNextPage ||
						fixtures?.myTournamentSeasonReviewSection.h2h?.hasNextPage
					),
					nextCursor: null
				}
			: section.h2h
	return {
		review: {
			...review,
			state: optionalSectionFailed ? 'DEGRADED' : review.state,
			points: section.points,
			trajectoryPoints:
				trajectories?.myTournamentSeasonReviewSection.points ?? null,
			h2h,
			knockout: section.knockout
		},
		sections: [
			section,
			...(trajectories?.myTournamentSeasonReviewSection
				? [trajectories.myTournamentSeasonReviewSection]
				: []),
			...(fixtures?.myTournamentSeasonReviewSection
				? [fixtures.myTournamentSeasonReviewSection]
				: [])
		],
		error: null
	}
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
	let initialSeasonSections: MyTournamentSeasonSection[] = []
	let initialError: string | null = null
	let initialEventIndexError: string | null = null
	let initialGameweekError: string | null = null
	let initialSeasonError: string | null = null

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
		// A deep link may target a tournament beyond the first catalog page. Ask
		// the catalog's exact-ID search path once rather than walking an
		// unbounded number of keyset pages on every server render.
		if (
			requestedTournamentId !== null &&
			!catalogNodes(initialCatalog).some(
				item => item.tournamentId === requestedTournamentId
			)
		) {
			const directLookup = await timing.measure(
				'my-tournament-review-v2.1-catalog-deep-link-lookup',
				async () => {
					try {
						return await executeServerQueryWithSession<MyTournamentReviewCatalogResponse>(
							session,
							GET_MY_TOURNAMENT_REVIEW_CATALOG,
							{
								scope,
								first: 100,
								after: null,
								search: String(requestedTournamentId)
							},
							{ cache: 'no-store', contract: 'my-tournament-review-v2.1' }
						)
					} catch {
						// Supplemental lookup failure must not erase the first catalog
						// page or turn a usable review center into a page-wide error.
						return null
					}
				}
			)
			const directEdge = directLookup?.myTournamentReviewCatalog.edges.find(
				edge => edge.node.tournamentId === requestedTournamentId
			)
			if (directEdge) {
				initialCatalog = {
					...initialCatalog,
					edges: [directEdge, ...initialCatalog.edges]
				}
			}
		}
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
			let latestSeasonResponse: MyTournamentSeasonReviewResponse | null = null
			try {
				latestSeasonResponse = await timing.measure(
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
			} catch {
				// Keep the catalog and its latest finalized event usable. The client
				// receives a scoped event-index error and can retry from this catalog
				// checkpoint without reloading or losing the selected tournament.
				initialEventId = latestSettledEventId
				initialEventIndexError = t('tournamentStatsFailed')
			}
			if (latestSeasonResponse) {
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
					const [gameweekResult, seasonResult] = await timing.measure(
						'my-tournament-review-v2.1-snapshots',
						() =>
							Promise.allSettled([
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
											{
												cache: 'no-store',
												contract: 'my-tournament-review-v2.1'
											}
										)
							])
					)
					if (gameweekResult.status === 'fulfilled') {
						initialGameweekReview =
							gameweekResult.value.myTournamentGameweekReview
					} else {
						initialGameweekError = t('tournamentStatsFailed')
					}
					if (seasonResult.status === 'fulfilled') {
						try {
							const seasonSeed = await hydrateSeasonSeed(
								session,
								initialSelectedTournamentId,
								initialEventId,
								seasonResult.value.myTournamentSeasonReview
							)
							initialSeasonReview = seasonSeed.review
							initialSeasonSections = seasonSeed.sections
							if (seasonSeed.error)
								initialSeasonError = t('tournamentStatsFailed')
						} catch {
							// The Season overview and Gameweek snapshot are independent
							// publications. Keep both summaries usable when a Season section
							// page is unavailable; the client will retry only the Season view.
							initialSeasonReview = seasonResult.value.myTournamentSeasonReview
							initialSeasonSections = []
							initialSeasonError = t('tournamentStatsFailed')
						}
					} else {
						initialSeasonError = t('tournamentStatsFailed')
					}
				}
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

	timing.finish(
		initialError ||
			initialEventIndexError ||
			initialGameweekError ||
			initialSeasonError
			? 'unavailable'
			: 'ready'
	)
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
				initialSeasonSections={initialSeasonSections}
				initialError={initialError}
				initialEventIndexError={initialEventIndexError}
				initialGameweekError={initialGameweekError}
				initialSeasonError={initialSeasonError}
			/>
		</Suspense>
	)
}
