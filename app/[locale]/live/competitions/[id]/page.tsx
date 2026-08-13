import TournamentDetailClient from '@/app/live/tournaments/[id]/TournamentDetailClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getCurrentEventId } from '@/lib/events'
import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'
import {
	GET_TOURNAMENT_LIVE_POINTS,
	GET_TOURNAMENT_METADATA,
	GET_TOURNAMENT_PARTICIPANTS,
	type EntryTournament,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse,
	type TournamentMetadataResponse,
	type TournamentParticipant,
	type TournamentParticipantsResponse,
} from '@/lib/graphql/operations/tournaments'
import { executeServerQuery } from '@/lib/graphql-server'
import { getCurrentEntryId } from '@/lib/session'
import {
	classifyTournamentDetailError,
	type TournamentDetailLoadError,
} from '@/lib/tournament/detail-load-error'
import { getTournamentLiveBatchSeed } from '@/lib/tournament/liveEntries'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: `/live/competitions/${encodeURIComponent(id)}`,
		titleKey: 'competitionStandingsTitle',
		descriptionKey: 'competitionStandingsDescription',
	})
}

type PageProps = {
	params: LocaleParams<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params, searchParams }: PageProps) {
	const { id } = await getPageLocale(params)
	const liveT = await getTranslations('LiveTournament')
	const tournamentId = Number(id)
	const [entryId, currentEventId] = await Promise.all([
		getCurrentEntryId(),
		getCurrentEventId(),
	])
	let tournament: EntryTournament | null = null
	let initialRows: TournamentLiveCalcData[] = []
	let participants: TournamentParticipant[] = []
	let softError: string | null = null
	let loadError: TournamentDetailLoadError | null = null
	let initialSnapshot: LiveSnapshotStatus | null = null
	const query = await searchParams
	const justCreated = query.created === '1'

	if (!entryId) {
		loadError = 'bind_entry'
	} else if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
		loadError = 'invalid_link'
	} else {
		try {
			const metadata = await executeServerQuery<TournamentMetadataResponse>(
				GET_TOURNAMENT_METADATA,
				{ tournamentId, entryId },
				{ cache: 'no-store' },
			)
			tournament = metadata.tournament

			if (!tournament) {
				loadError = 'no_access'
			} else {
				const participantsRequest =
					executeServerQuery<TournamentParticipantsResponse>(
						GET_TOURNAMENT_PARTICIPANTS,
						{ tournamentId },
						{ cache: 'no-store' },
					)
						.then(data => data.tournamentParticipants)
						.catch(error => {
							console.warn(
								'[tournament detail] Participant roster unavailable:',
								error,
							)
							return []
						})

				if (tournament.standingsReadyAt && currentEventId) {
					const [loadedParticipants, standings] = await Promise.all([
						participantsRequest,
						executeServerQuery<TournamentLivePointsResponse>(
							GET_TOURNAMENT_LIVE_POINTS,
							{ tournamentId, eventId: currentEventId },
							{ cache: 'no-store' },
						),
					])
					participants = loadedParticipants
					const seed = getTournamentLiveBatchSeed(standings)
					initialRows = seed.rows
					initialSnapshot = seed.snapshot
					if (seed.failedCount > 0) {
						softError = liveT('partialResults', {
							failed: seed.failedCount,
							total: seed.totalEntries,
						})
					}
				} else {
					participants = await participantsRequest
				}
			}
		} catch (error) {
			const kind = classifyTournamentDetailError(error)
			if (kind === 'no_access') {
				console.warn(
					'[tournament detail] No access:',
					error instanceof Error ? error.message : error,
				)
			} else {
				console.error('[tournament detail] Failed to load:', error)
			}
			loadError = kind
			tournament = null
		}
	}

	return (
		<TournamentDetailClient
			key={`${tournament?.updatedAt ?? 'missing'}:${tournament?.setupProgressUpdatedAt ?? ''}`}
			canManage={Boolean(
				tournament && entryId && tournament.adminEntryId === entryId,
			)}
			tournament={tournament}
			currentGameweek={currentEventId ?? undefined}
			entryId={entryId}
			initialRows={initialRows}
			loadError={loadError}
			softError={softError}
			initialSnapshot={initialSnapshot}
			initialParticipants={participants}
			justCreated={justCreated}
		/>
	)
}
