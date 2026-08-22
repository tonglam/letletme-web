import TeamStatsClient from '@/app/me/team/TeamStatsClient'
import {
	eventResultFromMyFplGameweek,
	historyFromMyFplDesk,
	identityFromMyFplEntry
} from '@/app/me/team/_lib/my-fpl-adapters'
import {
	MOCK_TEAM_ENTRY_ID,
	MOCK_TEAM_EVENT_ID,
	MOCK_TEAM_EVENT_RESULT,
	MOCK_TEAM_HISTORY,
	MOCK_TEAM_IDENTITY
} from '@/app/me/team/_lib/team-stats-mock'
import {
	parseTeamStatsGw,
	parseTeamStatsView
} from '@/app/me/team/_lib/team-stats-url'
import { getCoreEventContext } from '@/lib/events'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import {
	GET_MY_FPL_TEAM_DESK,
	type MyFplReviewState,
	type MyFplSnapshotMeta,
	type MyFplTeamDeskResponse
} from '@/lib/graphql/operations/my-fpl'
import { getVerifiedEntryContext } from '@/lib/session'
import { resolveSeasonPresentation } from '@/lib/season-presentation'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { RouteLoaderTiming } from '@/lib/route-loader-timing'

export const dynamic = 'force-dynamic'

const MOCK_TEAM_BENCH_POINTS = MOCK_TEAM_EVENT_RESULT.eventPicks.reduce(
	(total, pick) => (pick.position > 11 ? total + pick.totalPoints : total),
	0
)

type PageProps = {
	params: LocaleParams
	searchParams: Promise<{
		view?: string
		gw?: string
		mock?: string
		chip?: string
	}>
}

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/my-fpl/team',
		titleKey: 'teamStatsTitle',
		descriptionKey: 'teamStatsDescription'
	})
}

function TeamStatsFallback() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-8">
			<div className="h-8 w-40 animate-pulse rounded bg-muted/60" />
			<div className="mt-6 h-11 w-full max-w-md animate-pulse rounded bg-muted/40" />
			<div className="mt-8 h-40 w-full animate-pulse rounded-xl bg-muted/40" />
		</div>
	)
}

/**
 * My Team is a review page — do NOT hard-fail when isCurrent is missing.
 * Live calc still uses getCurrentEventId() only.
 *
 * Critical path (Season default):
 *   gate once + events + history + entry identity
 * Gameweek deep link: also entryEventResult(seedGw)
 */
export default async function TeamStatsPage({
	params,
	searchParams
}: PageProps) {
	const [pageLocale, t, sp] = await Promise.all([
		getPageLocale(params),
		getTranslations('States'),
		searchParams
	])
	const { locale } = pageLocale

	if (sp.mock === '1' && process.env.NODE_ENV !== 'production') {
		const showBenchBoost = sp.chip?.toLowerCase() === 'bb'
		const mockEventResult = showBenchBoost
			? {
					...MOCK_TEAM_EVENT_RESULT,
					eventPoints:
						MOCK_TEAM_EVENT_RESULT.eventPoints + MOCK_TEAM_BENCH_POINTS,
					eventNetPoints:
						MOCK_TEAM_EVENT_RESULT.eventNetPoints + MOCK_TEAM_BENCH_POINTS,
					overallPoints:
						MOCK_TEAM_EVENT_RESULT.overallPoints + MOCK_TEAM_BENCH_POINTS,
					eventBenchPoints: MOCK_TEAM_BENCH_POINTS,
					eventChip: 'BENCH_BOOST'
				}
			: MOCK_TEAM_EVENT_RESULT
		const mockSelectedGameweek = parseTeamStatsGw(
			sp.gw,
			MOCK_TEAM_EVENT_ID,
			MOCK_TEAM_EVENT_ID
		)
		return (
			<Suspense fallback={<TeamStatsFallback />}>
				<TeamStatsClient
					entryId={MOCK_TEAM_ENTRY_ID}
					currentGameweek={MOCK_TEAM_EVENT_ID}
					initialSelectedGameweek={mockSelectedGameweek}
					initialEntryEventResult={mockEventResult}
					initialEntryHistory={MOCK_TEAM_HISTORY}
					initialEntryIdentity={MOCK_TEAM_IDENTITY}
					initialEntryTransfers={[]}
					initialError={null}
					initialRequestComplete
					initialSeasonPhase="SETTLED"
					initialSnapshotMeta={null}
				/>
			</Suspense>
		)
	}

	const timing = new RouteLoaderTiming('/my-fpl/team')
	const [context, coreEventContext] = await Promise.all([
		timing.measure('session', () => getVerifiedEntryContext()),
		timing.measure('event-context', () =>
			getCoreEventContext().catch(error => {
				console.warn('[team stats] event context failed:', error)
				return null
			})
		)
	])
	const initialView = parseTeamStatsView(sp.view)

	const { session, entryId } = context
	if (!session) {
		timing.finish('redirect-login')
		redirect(localizeHref('/auth/login?next=/my-fpl/team', locale))
	}
	if (!entryId) {
		timing.finish('redirect-bind')
		redirect(localizeHref('/onboarding/bind-entry', locale))
	}

	const seasonPresentation = resolveSeasonPresentation(coreEventContext)

	let initialEntryEventResult = null as ReturnType<
		typeof eventResultFromMyFplGameweek
	>
	let initialEntryHistory = null as ReturnType<
		typeof historyFromMyFplDesk
	> | null
	let initialEntryIdentity = null as ReturnType<typeof identityFromMyFplEntry>
	let initialDeskState: MyFplReviewState = 'EMPTY'
	let initialEntryGameweekState: MyFplReviewState | undefined
	let initialPastSeasonsState: MyFplReviewState | undefined
	let initialSnapshotMeta: MyFplSnapshotMeta | null = null
	let initialError: string | null = null
	let initialRequestComplete = false

	const requestedGameweek = Number(sp.gw)
	const requestedEventId =
		Number.isSafeInteger(requestedGameweek) && requestedGameweek > 0
			? requestedGameweek
			: null
	let currentGameweek = 0
	let initialSelectedGameweek: number | undefined

	try {
		const response = await timing.measure('my-fpl-desk', () =>
			executeServerQueryWithSession<MyFplTeamDeskResponse>(
				session,
				GET_MY_FPL_TEAM_DESK,
				{ eventId: requestedEventId },
				{ cache: 'no-store' }
			)
		)
		const desk = response.myFplTeamDesk
		initialDeskState = desk.state
		initialEntryHistory =
			desk.state === 'READY' ? historyFromMyFplDesk(desk) : null
		initialEntryIdentity = identityFromMyFplEntry(desk.entry)
		initialEntryEventResult =
			desk.state === 'READY'
				? eventResultFromMyFplGameweek(desk.gameweek)
				: null
		initialEntryGameweekState =
			desk.state === 'READY' ? desk.gameweek?.state : desk.state
		initialPastSeasonsState = desk.pastSeasonsState
		initialSnapshotMeta = desk.snapshotMeta ?? null
		currentGameweek =
			desk.context.currentEventId ?? desk.context.latestFinalizedEventId ?? 0
		const latestFinalized = desk.context.latestFinalizedEventId ?? 0
		const currentEvent = desk.context.currentEventId ?? 0
		const latestPublished = desk.context.latestPublishedEventId ?? 0
		const maxKnownEvent = Math.max(currentEvent, latestFinalized)
		const maxKnownPublishedEvent = Math.max(maxKnownEvent, latestPublished)
		const safeRequestedEvent =
			requestedEventId !== null && requestedEventId <= maxKnownPublishedEvent
				? requestedEventId
				: null
		initialSelectedGameweek =
			safeRequestedEvent ??
			desk.selectedEventId ??
			(latestPublished > 0
				? latestPublished
				: latestFinalized > 0
					? latestFinalized
					: currentEvent > 0
						? currentEvent
						: undefined)
		const deskGameweekMatchesSelection =
			desk.gameweek?.eventId === (initialSelectedGameweek ?? 0)
		if (!deskGameweekMatchesSelection) {
			initialEntryEventResult = null
			initialEntryGameweekState = undefined
		}

		initialRequestComplete = true

		console.info('[team stats] ssr seed', {
			view: initialView,
			requestedEventId,
			currentGw: desk.context.currentEventId,
			latestFinalizedGw: desk.context.latestFinalizedEventId,
			hasHistory: Boolean(initialEntryHistory?.results?.length),
			historyRows: initialEntryHistory?.results?.length ?? 0,
			hasIdentity: Boolean(initialEntryIdentity),
			hasEvent: Boolean(initialEntryEventResult),
			gameweekState: initialEntryGameweekState,
			pastSeasonsState: desk.pastSeasonsState
		})

		if (
			!initialEntryIdentity &&
			!initialEntryHistory?.results?.length &&
			initialDeskState !== 'PENDING'
		) {
			initialError = t('teamStatsUnavailable')
		}
	} catch (error) {
		console.error('[team stats] Failed to seed page data:', error)
		initialError = t('teamStatsUnavailable')
	}
	timing.finish(initialError ? 'unavailable' : 'ready')

	return (
		<Suspense fallback={<TeamStatsFallback />}>
			<TeamStatsClient
				entryId={entryId}
				currentGameweek={currentGameweek > 0 ? currentGameweek : 0}
				initialSelectedGameweek={initialSelectedGameweek}
				initialEntryEventResult={initialEntryEventResult}
				initialEntryGameweekState={initialEntryGameweekState}
				initialDeskState={initialDeskState}
				initialPastSeasonsState={initialPastSeasonsState}
				initialEntryHistory={initialEntryHistory}
				initialEntryIdentity={initialEntryIdentity}
				initialEntryTransfers={null}
				initialError={initialError}
				initialRequestComplete={initialRequestComplete}
				initialSeasonPhase={seasonPresentation.phase}
				initialSnapshotMeta={initialSnapshotMeta}
			/>
		</Suspense>
	)
}
