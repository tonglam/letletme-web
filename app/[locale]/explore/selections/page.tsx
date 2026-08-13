import SelectionsClient, {
	type StatsResult,
} from '@/app/data/selections/SelectionsClient'
import { resolveInitialLeagueTrendsSelection } from '@/app/data/selections/_lib/league-trends'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { CacheTag, publicFetchOptions, RevalidateSeconds } from '@/lib/cache-policy'
import { getCurrentAndNextEvents } from '@/lib/events'
import {
	executePublicServerQuery,
	executeServerQueryWithSession,
} from '@/lib/graphql-server'
import {
	GET_ENTRY_EVENT_RESULT,
	type EntryEventPick,
	type EntryEventResultResponse,
} from '@/lib/graphql/operations/entries'
import {
	GET_PUBLIC_LEAGUE_SELECTION_STATS,
	GET_PUBLIC_LEAGUE_TRENDS,
	type PublicLeagueSelectionStatsResponse,
	type PublicLeagueTrend,
	type PublicLeagueTrendsResponse,
} from '@/lib/graphql/operations/leagues'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_SELECTION_STATS,
	type EntryTournamentsResponse,
	type TournamentSelectionStatsData,
	type TournamentSelectionStatsResponse,
} from '@/lib/graphql/operations/tournaments'
import { resolveReviewGameweekAnchor } from '@/lib/review-gameweek'
import { getVerifiedEntryContext } from '@/lib/session'
import { areTournamentInsightsReady } from '@/lib/tournament/lifecycle'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import type { Tournament } from '@/types/tournament'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: LocaleParams
	searchParams: Promise<{
		scope?: string
		tournament?: string
		gw?: string
	}>
}

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/explore/selections',
		titleKey: 'selectionsTitle',
		descriptionKey: 'selectionsDescription',
	})
}

function toStatsResult(
	stats: TournamentSelectionStatsData | null | undefined,
): StatsResult {
	return {
		totalEntries: stats?.totalEntries ?? 0,
		selection: stats?.mostSelectedPlayers ?? [],
		captain: stats?.captainSelect ?? [],
		transferIn: stats?.mostTransferIn ?? [],
		transferOut: stats?.mostTransferOut ?? [],
	}
}

export default async function SelectionsPage({ params, searchParams }: PageProps) {
	await getPageLocale(params)
	const query = await searchParams

	const [events, { session, entryId }] = await Promise.all([
		getCurrentAndNextEvents(),
		getVerifiedEntryContext(),
	])
	const review = resolveReviewGameweekAnchor(events)
	const defaultGameweek = review.anchorGw ?? 1

	let initialTournaments: Tournament[] = []
	let publicLeagues: PublicLeagueTrend[] = []
	let myLeaguesLoadFailed = false
	let publicLeaguesLoadFailed = false

	const [myLeaguesResult, publicLeaguesResult] = await Promise.allSettled([
		entryId != null && session
			? executeServerQueryWithSession<EntryTournamentsResponse>(
					session,
					GET_ENTRY_TOURNAMENTS,
					{ entryId },
					{ cache: 'no-store' },
				)
			: Promise.resolve({ entryTournaments: [] } as EntryTournamentsResponse),
		executePublicServerQuery<PublicLeagueTrendsResponse>(
			GET_PUBLIC_LEAGUE_TRENDS,
			{},
			publicFetchOptions({
				revalidate: RevalidateSeconds.publicStats,
				tags: [CacheTag.events],
			}),
		),
	])

	if (myLeaguesResult.status === 'fulfilled') {
		initialTournaments = myLeaguesResult.value.entryTournaments.map(
			mapEntryTournamentToLiveTournament,
		)
	} else {
		myLeaguesLoadFailed = true
		console.error('[league-trends] My Leagues seed failed:', myLeaguesResult.reason)
	}
	if (publicLeaguesResult.status === 'fulfilled') {
		publicLeagues = publicLeaguesResult.value.publicLeagueTrends
	} else {
		publicLeaguesLoadFailed = true
		console.error(
			'[league-trends] Public Leagues seed failed:',
			publicLeaguesResult.reason,
		)
	}

	const initialSelection = resolveInitialLeagueTrendsSelection({
		scopeParam: query.scope,
		tournamentParam: query.tournament,
		gwParam: query.gw,
		mineTournamentIds: initialTournaments.map(tournament => Number(tournament.id)),
		publicLeagues,
		defaultGameweek,
	})

	let initialStats: StatsResult | null = null
	let initialEntryPicks: EntryEventPick[] = []
	let initialStatsLoadFailed = false
	const selectedTournamentId = initialSelection.tournamentId

	if (selectedTournamentId != null && initialSelection.scope === 'mine') {
		const tournament = initialTournaments.find(
			item => Number(item.id) === selectedTournamentId,
		)
		if (tournament && areTournamentInsightsReady(tournament) && session && entryId) {
			const [statsResult, entryResult] = await Promise.allSettled([
				executeServerQueryWithSession<TournamentSelectionStatsResponse>(
					session,
					GET_TOURNAMENT_SELECTION_STATS,
					{
						tournamentId: selectedTournamentId,
						eventId: initialSelection.gameweek,
						limit: 12,
					},
					{ cache: 'no-store' },
				),
				executeServerQueryWithSession<EntryEventResultResponse>(
					session,
					GET_ENTRY_EVENT_RESULT,
					{ entryId, eventId: initialSelection.gameweek },
					{ cache: 'no-store' },
				),
			])
			if (statsResult.status === 'fulfilled') {
				initialStats = toStatsResult(statsResult.value.tournamentSelectionStats)
			} else {
				initialStatsLoadFailed = true
				console.error('[league-trends] initial My League stats failed:', statsResult.reason)
			}
			if (entryResult.status === 'fulfilled') {
				initialEntryPicks = entryResult.value.entryEventResult?.eventPicks ?? []
			} else {
				initialStatsLoadFailed = true
				console.error('[league-trends] initial entry picks failed:', entryResult.reason)
			}
		}
	} else if (selectedTournamentId != null && initialSelection.scope === 'public') {
		try {
			const response =
				await executePublicServerQuery<
					PublicLeagueSelectionStatsResponse<TournamentSelectionStatsData>
				>(
					GET_PUBLIC_LEAGUE_SELECTION_STATS,
					{
						tournamentId: selectedTournamentId,
						eventId: initialSelection.gameweek,
						limit: 12,
					},
					publicFetchOptions({
						revalidate: RevalidateSeconds.publicStats,
						tags: [CacheTag.events],
					}),
				)
			initialStats = toStatsResult(response.publicLeagueSelectionStats)
		} catch (error) {
			initialStatsLoadFailed = true
			console.error('[league-trends] initial Public League stats failed:', error)
		}
	}

	return (
		<SelectionsClient
			entryId={entryId ?? 0}
			initialTournaments={initialTournaments}
			publicLeagues={publicLeagues}
			initialSelection={initialSelection}
			initialStats={initialStats}
			initialEntryPicks={initialEntryPicks}
			currentGameweek={defaultGameweek}
			myLeaguesLoadFailed={myLeaguesLoadFailed}
			publicLeaguesLoadFailed={publicLeaguesLoadFailed}
			initialStatsLoadFailed={initialStatsLoadFailed}
		/>
	)
}
