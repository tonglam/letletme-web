import TournamentStatsClient from '@/app/me/tournament/TournamentStatsClient'
import { fetchPlayerMetaByIds } from '@/app/me/tournament/_lib/tournament-stats-data'
import {
	parseTournamentStatsGw,
	parseTournamentStatsView,
} from '@/app/me/tournament/_lib/tournament-stats-url'
import { getCurrentAndNextEvents } from '@/lib/events'
import { resolveReviewGameweekAnchor } from '@/lib/review-gameweek'
import {
	executeServerQueryWithSession,
} from '@/lib/graphql-server'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
	GET_TOURNAMENT_EVENT_RESULTS,
	GET_TOURNAMENT_SEASON_SNAPSHOT,
	type EntryTournament,
	type EntryTournamentsResponse,
	type TournamentEntryRankingSummary,
	type TournamentEntryRankingSummaryResponse,
	type TournamentEventResultItem,
	type TournamentEventResultsResponse,
	type TournamentSeasonSnapshotApi,
	type TournamentSeasonSnapshotResponse,
} from '@/lib/graphql/operations/tournaments'
import type { Session } from '@/lib/auth'
import { getVerifiedEntryContext } from '@/lib/session'
import { areTournamentInsightsReady } from '@/lib/tournament/lifecycle'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

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
		pathname: '/me/tournament',
		titleKey: 'tournamentStatsTitle',
		descriptionKey: 'tournamentStatsDescription',
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

async function fetchResults(
	session: Session,
	tournamentId: number,
	eventId: number,
): Promise<TournamentEventResultItem[]> {
	if (eventId <= 0) return []
	const response = await executeServerQueryWithSession<TournamentEventResultsResponse>(
		session,
		GET_TOURNAMENT_EVENT_RESULTS,
		{ tournamentId, eventId },
		{ cache: 'no-store' },
	)
	return response.tournamentEventResults ?? []
}

/**
 * Critical probe only: anchor GW, then at most one previous GW.
 * Avoids 1+4 full-field waterfalls when current has no standings yet.
 */
async function resolveLatestResults(
	session: Session,
	tournamentId: number,
	anchorGw: number,
): Promise<{ latestGw: number; rows: TournamentEventResultItem[]; usedFallback: boolean }> {
	if (anchorGw <= 0) {
		return { latestGw: 0, rows: [], usedFallback: false }
	}
	const primary = await fetchResults(session, tournamentId, anchorGw)
	if (primary.length > 0) {
		return { latestGw: anchorGw, rows: primary, usedFallback: false }
	}
	const prev = anchorGw - 1
	if (prev < 1) {
		return { latestGw: 0, rows: [], usedFallback: false }
	}
	const prevRows = await fetchResults(session, tournamentId, prev)
	if (prevRows.length > 0) {
		return { latestGw: prev, rows: prevRows, usedFallback: true }
	}
	return { latestGw: 0, rows: [], usedFallback: false }
}

/**
 * My Tournament is a review page — do NOT hard-fail when isCurrent is missing.
 * Live standings still use getCurrentEventId() hard gate.
 */
export default async function TournamentStatsPage({
	params,
	searchParams,
}: PageProps) {
	const { locale } = await getPageLocale(params)
	const t = await getTranslations('States')
	const sp = await searchParams
	const initialView = parseTournamentStatsView(sp.view)
	const needsGameweekSeed = initialView === 'gameweek'

	const [{ session, entryId }, events] = await Promise.all([
		getVerifiedEntryContext(),
		getCurrentAndNextEvents(),
	])

	if (!session) {
		redirect(localizeHref('/auth/login?next=/me/tournament', locale))
	}
	if (!entryId) {
		redirect(localizeHref('/onboarding/bind-entry', locale))
	}

	const review = resolveReviewGameweekAnchor(events)
	// Workspace max / default: real current when set, else review anchor (may be 0)
	const currentGameweek = review.currentGw ?? review.anchorGw ?? 0
	const seedGw =
		currentGameweek > 0
			? parseTournamentStatsGw(sp.gw, currentGameweek, currentGameweek)
			: 0

	let initialTournaments: EntryTournament[] = []
	let initialSelectedTournamentId = ''
	let initialDataGameweek: number | null = null
	let initialSliceGameweek: number | null = null
	let initialCurrentRows: TournamentEventResultItem[] = []
	let initialSeasonFieldRows: TournamentEventResultItem[] = []
	let initialSeasonSnapshot: TournamentSeasonSnapshotApi | null = null
	let initialPreviousRows: TournamentEventResultItem[] = []
	let initialRankingSummary: TournamentEntryRankingSummary | null = null
	let initialPlayerMeta: Record<
		number,
		{ webName: string; teamShortName: string }
	> = {}
	let initialError: string | null = null
	let usedFallbackGameweek = false

	try {
		const tournamentsData =
			await executeServerQueryWithSession<EntryTournamentsResponse>(
				session,
				GET_ENTRY_TOURNAMENTS,
				{ entryId },
				{ cache: 'no-store' },
			)
		initialTournaments = tournamentsData.entryTournaments

		const requestedTournamentId =
			typeof sp.tournamentId === 'string' ? sp.tournamentId : ''
		initialSelectedTournamentId = initialTournaments.find(
			tournament => String(tournament.id) === requestedTournamentId,
		)
			? requestedTournamentId
			: String(initialTournaments[0]?.id ?? '')

		const selectedTournament = initialTournaments.find(
			tournament => String(tournament.id) === initialSelectedTournamentId,
		)
		const tournamentId = selectedTournament?.id ?? 0

		const anchorForProbe = review.anchorGw ?? currentGameweek

		if (
			tournamentId > 0 &&
			selectedTournament &&
			areTournamentInsightsReady(selectedTournament) &&
			anchorForProbe > 0
		) {
			const resolved = await resolveLatestResults(
				session,
				tournamentId,
				anchorForProbe,
			)
			const latestGw = resolved.latestGw
			const probeRows = resolved.rows
			usedFallbackGameweek = resolved.usedFallback

			initialDataGameweek = probeRows.length > 0 ? latestGw : null
			initialSliceGameweek = probeRows.length > 0 ? latestGw : null
			initialSeasonFieldRows = probeRows
			initialCurrentRows = probeRows

			const rankingPromise =
				probeRows.length > 0
					? executeServerQueryWithSession<TournamentEntryRankingSummaryResponse>(
							session,
							GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
							{
								tournamentId,
								eventId: latestGw,
								entryId,
							},
							{ cache: 'no-store' },
						).catch(err => {
							console.warn('[tournament stats] ranking seed failed:', err)
							return null
						})
					: Promise.resolve(null)

			const snapshotPromise =
				probeRows.length > 0
					? executeServerQueryWithSession<TournamentSeasonSnapshotResponse>(
							session,
							GET_TOURNAMENT_SEASON_SNAPSHOT,
							{ tournamentId, eventId: latestGw },
							{ cache: 'no-store' },
						).catch(err => {
							console.warn(
								'[tournament stats] season snapshot seed failed:',
								err,
							)
							return null
						})
					: Promise.resolve(null)

			if (needsGameweekSeed && latestGw > 0) {
				const targetGw =
					seedGw > 0 ? Math.min(seedGw, latestGw) : latestGw
				const currentRows =
					targetGw === latestGw
						? probeRows
						: await fetchResults(session, tournamentId, targetGw)
				initialCurrentRows = currentRows
				initialSliceGameweek = targetGw

				const captainIds = currentRows
					.map(row => row.captainId)
					.filter((id): id is number => id != null && id > 0)

				const [previousRows, rankingResponse, snapshotResponse, playerMeta] =
					await Promise.all([
						targetGw > 1
							? fetchResults(session, tournamentId, targetGw - 1).catch(
									() => [],
								)
							: Promise.resolve([] as TournamentEventResultItem[]),
						rankingPromise,
						snapshotPromise,
						fetchPlayerMetaByIds(captainIds).catch(err => {
							console.warn(
								'[tournament stats] captain meta seed failed:',
								err,
							)
							return {}
						}),
					])

				initialPreviousRows = previousRows
				initialRankingSummary =
					rankingResponse?.tournamentEntryRankingSummary ?? null
				initialSeasonSnapshot =
					snapshotResponse?.tournamentSeasonSnapshot ?? null
				initialPlayerMeta = playerMeta
			} else {
				const [rankingResponse, snapshotResponse] = await Promise.all([
					rankingPromise,
					snapshotPromise,
				])
				initialRankingSummary =
					rankingResponse?.tournamentEntryRankingSummary ?? null
				initialSeasonSnapshot =
					snapshotResponse?.tournamentSeasonSnapshot ?? null
			}

			console.info('[tournament stats] ssr seed', {
				entryId,
				tournamentId,
				view: initialView,
				currentGw: review.currentGw,
				anchorGw: review.anchorGw,
				anchorSource: review.source,
				dataGameweek: initialDataGameweek,
				sliceGameweek: initialSliceGameweek,
				needsGameweekSeed,
				rows: initialCurrentRows.length,
				hasRanking: Boolean(initialRankingSummary),
				captainMeta: Object.keys(initialPlayerMeta).length,
			})
		} else {
			console.info('[tournament stats] ssr seed (list only)', {
				entryId,
				tournamentId,
				anchorGw: review.anchorGw,
				insightsReady: selectedTournament
					? areTournamentInsightsReady(selectedTournament)
					: false,
			})
		}
	} catch (err) {
		console.error('[tournament stats] Failed to seed page:', err)
		// Soft fail — still render shell with tournaments list if we got any
		initialError = t('tournamentStatsFailed')
	}

	return (
		<Suspense fallback={<TournamentStatsFallback />}>
			<TournamentStatsClient
				entryId={entryId}
				initialCurrentGameweek={currentGameweek > 0 ? currentGameweek : 0}
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
				initialError={initialError}
			/>
		</Suspense>
	)
}
