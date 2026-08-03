import { getCurrentAndNextEvents } from '@/lib/events'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_LIVE_POINTS,
	type EntryTournament,
	type EntryTournamentsResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse
} from '@/lib/graphql/operations/tournaments'
import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'
import { getCurrentEntryId } from '@/lib/session'
import TournamentDetailClient from '@/app/live/tournament/[id]/TournamentDetailClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: `/live/tournament/${encodeURIComponent(id)}`,
		titleKey: 'tournamentStandingsTitle',
		descriptionKey: 'tournamentStandingsDescription'
	})
}

type PageProps = {
	params: LocaleParams<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params }: PageProps) {
	const { id } = await getPageLocale(params)
	const [t, liveT] = await Promise.all([
		getTranslations('States'),
		getTranslations('LiveTournament')
	])
	const tournamentId = Number(id)
	const [entryId, events] = await Promise.all([
		getCurrentEntryId(),
		getCurrentAndNextEvents()
	])
	const currentEventId = events?.current[0]?.id
	let tournament: EntryTournament | null = null
	let initialRows: TournamentLiveCalcData[] = []
	let initialError: string | null = null
	let initialSnapshot: LiveSnapshotStatus | null = null

	if (!entryId) {
		initialError = t('bindEntryRequired')
	} else if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
		initialError = t('invalidTournamentLink')
	} else {
		try {
			const tournamentsData =
				await executeServerQuery<EntryTournamentsResponse>(
					GET_ENTRY_TOURNAMENTS,
					{ entryId },
					{ cache: 'no-store' }
				)
			tournament =
				tournamentsData.entryTournaments.find(
					item => item.id === tournamentId
				) ?? null

			if (!tournament) {
				initialError = t('tournamentNoAccess')
			} else if (!currentEventId) {
				initialError = t('currentGameweekUnavailable')
			} else {
				const standings =
					await executeServerQuery<TournamentLivePointsResponse>(
						GET_TOURNAMENT_LIVE_POINTS,
						{ tournamentId, eventId: currentEventId },
						{ cache: 'no-store' }
					)
				const batch = standings.calcLivePointsForTournament
				initialRows = batch.results ?? []
				if (batch.meta.failedCount > 0) {
					initialError = liveT('partialResults', {
						failed: batch.meta.failedCount,
						total: batch.meta.totalEntries
					})
				} else {
					initialSnapshot = standings.liveSnapshot
				}
			}
		} catch (error) {
			console.error('[tournament detail] Failed to load:', error)
			initialError = t('tournamentDataUnavailable')
		}
	}

	return (
		<TournamentDetailClient
			canManage={Boolean(
				tournament && entryId && tournament.adminEntryId === entryId
			)}
			tournament={tournament}
			currentGameweek={currentEventId}
			initialRows={initialRows}
			initialError={initialError}
			initialSnapshot={initialSnapshot}
		/>
	)
}
