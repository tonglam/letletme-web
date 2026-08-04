import { getCurrentAndNextEvents } from '@/lib/events'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_TOURNAMENT_LIVE_POINTS,
	GET_TOURNAMENT_METADATA,
	GET_TOURNAMENT_PARTICIPANTS,
	type EntryTournament,
	type TournamentParticipant,
	type TournamentMetadataResponse,
	type TournamentParticipantsResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse
} from '@/lib/graphql/operations/tournaments'
import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'
import { getCurrentEntryId } from '@/lib/session'
import TournamentDetailClient from '@/app/live/tournament/[id]/TournamentDetailClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getTournamentLiveBatchSeed } from '@/lib/tournament/liveEntries'
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

export default async function Page({ params, searchParams }: PageProps) {
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
	let participants: TournamentParticipant[] = []
	let initialError: string | null = null
	let initialSnapshot: LiveSnapshotStatus | null = null
	const query = await searchParams
	const justCreated = query.created === '1'

	if (!entryId) {
		initialError = t('bindEntryRequired')
	} else if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
		initialError = t('invalidTournamentLink')
	} else {
		try {
			const metadata = await executeServerQuery<TournamentMetadataResponse>(
				GET_TOURNAMENT_METADATA,
				{ tournamentId, entryId },
				{ cache: 'no-store' }
			)
			tournament = metadata.tournament

			if (!tournament) {
				initialError = t('tournamentNoAccess')
			} else {
				const participantsRequest =
					executeServerQuery<TournamentParticipantsResponse>(
						GET_TOURNAMENT_PARTICIPANTS,
						{ tournamentId },
						{ cache: 'no-store' }
					)
						.then(data => data.tournamentParticipants)
						.catch(error => {
							console.warn(
								'[tournament detail] Participant roster unavailable:',
								error
							)
							return []
						})

				if (tournament.standingsReadyAt && currentEventId) {
					const [loadedParticipants, standings] = await Promise.all([
						participantsRequest,
						executeServerQuery<TournamentLivePointsResponse>(
							GET_TOURNAMENT_LIVE_POINTS,
							{ tournamentId, eventId: currentEventId },
							{ cache: 'no-store' }
						)
					])
					participants = loadedParticipants
					const seed = getTournamentLiveBatchSeed(standings)
					initialRows = seed.rows
					initialSnapshot = seed.snapshot
					if (seed.failedCount > 0) {
						initialError = liveT('partialResults', {
							failed: seed.failedCount,
							total: seed.totalEntries
						})
					}
				} else {
					participants = await participantsRequest
				}
			}
		} catch (error) {
			console.error('[tournament detail] Failed to load:', error)
			initialError = t('tournamentDataUnavailable')
		}
	}

	return (
		<TournamentDetailClient
			key={`${tournament?.updatedAt ?? 'missing'}:${tournament?.setupProgressUpdatedAt ?? ''}`}
			canManage={Boolean(
				tournament && entryId && tournament.adminEntryId === entryId
			)}
			tournament={tournament}
			currentGameweek={currentEventId}
			initialRows={initialRows}
			initialError={initialError}
			initialSnapshot={initialSnapshot}
			initialParticipants={participants}
			justCreated={justCreated}
		/>
	)
}
