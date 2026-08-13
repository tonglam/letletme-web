import TournamentClient from '@/app/live/tournaments/TournamentClient'
import { CurrentGameweekUnavailable } from '@/components/feedback/CurrentGameweekUnavailable'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getCurrentEventId } from '@/lib/events'
import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_LIVE_POINTS,
	type EntryTournamentsResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse,
} from '@/lib/graphql/operations/tournaments'
import { executeServerQuery } from '@/lib/graphql-server'
import { getCurrentEntryId } from '@/lib/session'
import { getTournamentLiveBatchSeed } from '@/lib/tournament/liveEntries'
import { areTournamentStandingsReady } from '@/lib/tournament/lifecycle'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/live/competitions',
		titleKey: 'liveTournamentsTitle',
		descriptionKey: 'liveTournamentsDescription',
	})
}

type PageProps = {
	params: LocaleParams
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params, searchParams }: PageProps) {
	await getPageLocale(params)
	const liveT = await getTranslations('LiveTournament')
	const resolvedSearchParams = await searchParams

	// Gate isCurrent first — do not wait on entry/session.
	const currentEventId = await getCurrentEventId()
	if (!currentEventId) {
		return (
			<CurrentGameweekUnavailable titleKey="liveTournamentUnavailableTitle" />
		)
	}

	const entryId = await getCurrentEntryId()
	let initialTournaments: ReturnType<
		typeof mapEntryTournamentToLiveTournament
	>[] = []
	let initialSelectedTournamentId = ''
	let initialCurrentRows: TournamentLiveCalcData[] = []
	let initialResultsLoaded = false
	let initialResultsError: string | null = null
	let initialSnapshot: LiveSnapshotStatus | null = null

	if (entryId) {
		try {
			const tournamentsData =
				await executeServerQuery<EntryTournamentsResponse>(
					GET_ENTRY_TOURNAMENTS,
					{ entryId },
					{ cache: 'no-store' },
				)
			initialTournaments = tournamentsData.entryTournaments.map(
				mapEntryTournamentToLiveTournament,
			)
			const requestedTournamentId =
				typeof resolvedSearchParams.tournamentId === 'string'
					? resolvedSearchParams.tournamentId
					: ''
			initialSelectedTournamentId =
				initialTournaments.find(
					tournament => tournament.id === requestedTournamentId,
				)?.id ??
				initialTournaments[0]?.id ??
				''

			const tournamentId = Number(initialSelectedTournamentId)
			const selectedTournament = initialTournaments.find(
				tournament => tournament.id === initialSelectedTournamentId,
			)
			if (
				tournamentId > 0 &&
				currentEventId &&
				selectedTournament &&
				areTournamentStandingsReady(selectedTournament)
			) {
				const currentResponse =
					await executeServerQuery<TournamentLivePointsResponse>(
						GET_TOURNAMENT_LIVE_POINTS,
						{ tournamentId, eventId: currentEventId },
						{ cache: 'no-store' },
					)
				const seed = getTournamentLiveBatchSeed(currentResponse)
				initialCurrentRows = seed.rows
				initialSnapshot = seed.snapshot
				if (seed.failedCount > 0) {
					initialResultsError = liveT('partialResults', {
						failed: seed.failedCount,
						total: seed.totalEntries,
					})
				}
				initialResultsLoaded = true
			}
		} catch (err) {
			console.error('Failed to seed live tournament page:', err)
		}
	}

	return (
		<TournamentClient
			entryId={entryId ?? 0}
			initialTournaments={initialTournaments}
			initialSelectedTournamentId={initialSelectedTournamentId}
			initialEventId={currentEventId}
			initialCurrentRows={initialCurrentRows}
			initialResultsLoaded={initialResultsLoaded}
			initialResultsError={initialResultsError}
			initialSnapshot={initialSnapshot}
		/>
	)
}
