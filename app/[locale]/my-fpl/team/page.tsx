import TeamStatsClient from '@/app/me/team/TeamStatsClient'
import {
	identityFromEntrySummary,
	identityFromEventResult,
	type SeasonIdentity,
} from '@/app/me/team/_lib/team-stats-model'
import {
	parseTeamStatsGw,
	parseTeamStatsView,
} from '@/app/me/team/_lib/team-stats-url'
import {
	MOCK_TEAM_ENTRY_ID,
	MOCK_TEAM_EVENT_ID,
	MOCK_TEAM_EVENT_RESULT,
	MOCK_TEAM_HISTORY,
	MOCK_TEAM_IDENTITY,
} from '@/app/me/team/_lib/team-stats-mock'
import { getCurrentAndNextEvents } from '@/lib/events'
import {
	maxEventIdFromHistory,
	resolveReviewGameweekAnchor,
} from '@/lib/review-gameweek'
import {
	executeServerQueryWithSession,
} from '@/lib/graphql-server'
import {
	GET_ENTRY,
	GET_ENTRY_EVENT_RESULT,
	GET_ENTRY_HISTORY,
	type EntryEventResult,
	type EntryEventResultResponse,
	type EntryHistoryResponse,
	type EntrySummaryResponse,
} from '@/lib/graphql/operations/entries'
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
	searchParams: Promise<{ view?: string; gw?: string; mock?: string }>
}

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/my-fpl/team',
		titleKey: 'teamStatsTitle',
		descriptionKey: 'teamStatsDescription',
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
export default async function TeamStatsPage({ params, searchParams }: PageProps) {
	const [pageLocale, t, sp] = await Promise.all([
		getPageLocale(params),
		getTranslations('States'),
		searchParams,
	])
	const { locale } = pageLocale
	if (sp.mock === '1' && process.env.NODE_ENV !== 'production') {
		const mockSelectedGameweek = parseTeamStatsGw(
			sp.gw,
			MOCK_TEAM_EVENT_ID,
			MOCK_TEAM_EVENT_ID,
		)
		return (
			<Suspense fallback={<TeamStatsFallback />}>
				<TeamStatsClient
					entryId={MOCK_TEAM_ENTRY_ID}
					currentGameweek={MOCK_TEAM_EVENT_ID}
					initialSelectedGameweek={mockSelectedGameweek}
					initialEntryEventResult={MOCK_TEAM_EVENT_RESULT}
					initialEntryHistory={MOCK_TEAM_HISTORY}
					initialEntryIdentity={MOCK_TEAM_IDENTITY}
					initialEntryTransfers={[]}
					initialError={null}
					initialRequestComplete
				/>
			</Suspense>
		)
	}

	const timing = new RouteLoaderTiming('/my-fpl/team')
	const [context, events] = await Promise.all([
		timing.measure('session', () => getVerifiedEntryContext()),
		timing.measure('events', () => getCurrentAndNextEvents()),
	])
	const initialView = parseTeamStatsView(sp.view)
	const needsGameweekSeed = initialView === 'gameweek'

	const { session, entryId } = context
	if (!session) {
		timing.finish('redirect-login')
		redirect(localizeHref('/auth/login?next=/my-fpl/team', locale))
	}
	if (!entryId) {
		timing.finish('redirect-bind')
		redirect(localizeHref('/onboarding/bind-entry', locale))
	}

	const eventsAnchor = resolveReviewGameweekAnchor(events)

	let initialEntryEventResult: EntryEventResult | null = null
	let initialEntryHistory: EntryHistoryResponse['entryHistory'] | null = null
	let initialEntryIdentity: SeasonIdentity | null = null
	let initialError: string | null = null
	let initialRequestComplete = false

	// Provisional max before history (refined after history loads)
	let reviewMaxGw = eventsAnchor.anchorGw ?? 0
	let currentGameweek = eventsAnchor.currentGw ?? reviewMaxGw

	try {
		// History + identity first so we can refine anchor without isCurrent
		const [historyResult, entryResult] = await Promise.allSettled([
			timing.measure('history', () =>
				executeServerQueryWithSession<EntryHistoryResponse>(
					session,
					GET_ENTRY_HISTORY,
					{ entryId },
					{ cache: 'no-store' },
				)
			),
			timing.measure('entry', () =>
				executeServerQueryWithSession<EntrySummaryResponse>(
					session,
					GET_ENTRY,
					{ id: entryId },
					{ cache: 'no-store' },
				)
			),
		])

		const historyResponse = historyResult.status === 'fulfilled' ? historyResult.value : null
		const entryResponse = entryResult.status === 'fulfilled' ? entryResult.value : null
		if (historyResult.status === 'rejected') console.warn('[team stats] history seed failed:', historyResult.reason)
		if (entryResult.status === 'rejected') console.warn('[team stats] entry seed failed:', entryResult.reason)

		initialEntryHistory = historyResponse?.entryHistory ?? null
		if (entryResponse?.entry) {
			initialEntryIdentity = identityFromEntrySummary(entryResponse.entry)
		}

		const historyMax = maxEventIdFromHistory(initialEntryHistory?.results)
		const refined = resolveReviewGameweekAnchor(events, {
			historyMaxEventId: historyMax,
		})
		reviewMaxGw = refined.anchorGw ?? historyMax ?? 0
		// For workspace max: prefer real current when set, else review anchor
		currentGameweek = refined.currentGw ?? reviewMaxGw

		const seedGw =
			reviewMaxGw > 0
				? parseTeamStatsGw(sp.gw, reviewMaxGw, reviewMaxGw)
				: 0

		if (needsGameweekSeed && seedGw > 0) {
			try {
				const eventResponse = await timing.measure('gameweek', () =>
					executeServerQueryWithSession<EntryEventResultResponse>(
						session,
						GET_ENTRY_EVENT_RESULT,
						{ eventId: seedGw, entryId },
						{ cache: 'no-store' }
					)
				)
				initialEntryEventResult = eventResponse.entryEventResult ?? null
			} catch (error) {
				console.warn('[team stats] event seed failed:', error)
			}
			if (!initialEntryIdentity && initialEntryEventResult) {
				initialEntryIdentity = identityFromEventResult(initialEntryEventResult)
			}
		}

		initialRequestComplete = true

		console.info('[team stats] ssr seed', {
			seedGw,
			view: initialView,
			currentGw: refined.currentGw,
			anchorGw: refined.anchorGw,
			anchorSource: refined.source,
			hasHistory: Boolean(initialEntryHistory?.results?.length),
			historyRows: initialEntryHistory?.results?.length ?? 0,
			hasIdentity: Boolean(initialEntryIdentity),
			hasEvent: Boolean(initialEntryEventResult),
		})

		if (!initialEntryHistory && !initialEntryIdentity) {
			initialError = t('teamStatsUnavailable')
		}
	} catch (error) {
		console.error('[team stats] Failed to seed page data:', error)
		initialError = t('teamStatsUnavailable')
	}
	timing.finish(initialError ? 'unavailable' : 'ready')

	const seedGwForClient =
		reviewMaxGw > 0
			? parseTeamStatsGw(sp.gw, reviewMaxGw, reviewMaxGw)
			: 0

	return (
		<Suspense fallback={<TeamStatsFallback />}>
			<TeamStatsClient
				entryId={entryId}
				currentGameweek={currentGameweek > 0 ? currentGameweek : 0}
				initialSelectedGameweek={seedGwForClient > 0 ? seedGwForClient : undefined}
				initialEntryEventResult={initialEntryEventResult}
				initialEntryHistory={initialEntryHistory}
				initialEntryIdentity={initialEntryIdentity}
				initialEntryTransfers={null}
				initialError={initialError}
				initialRequestComplete={initialRequestComplete}
			/>
		</Suspense>
	)
}
