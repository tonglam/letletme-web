import TournamentDetailClient from '@/app/live/tournaments/[id]/TournamentDetailClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import {
	GET_LIVE_CONTEXT,
	type LiveContextResponse
} from '@/lib/graphql/operations/live'
import {
	GET_MANAGED_TOURNAMENT,
	GET_TOURNAMENT_METADATA,
	GET_TOURNAMENT_OFFICIAL_H2H,
	GET_TOURNAMENT_PARTICIPANTS,
	type EntryTournament,
	type TournamentOfficialH2H,
	type TournamentOfficialH2HResponse,
	type TournamentParticipantsResponse,
	type TournamentMetadataResponse,
	type ManagedTournamentResponse,
	type TournamentParticipant
} from '@/lib/graphql/operations/tournaments'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import {
	classifyTournamentDetailError,
	type TournamentDetailLoadError
} from '@/lib/tournament/detail-load-error'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: `/live/competitions/${encodeURIComponent(id)}`,
		titleKey: 'competitionStandingsTitle',
		descriptionKey: 'competitionStandingsDescription'
	})
}

type PageProps = {
	params: LocaleParams<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params, searchParams }: PageProps) {
	const { id, locale } = await getPageLocale(params)
	const liveT = await getTranslations('LiveTournament')
	const tournamentId = Number(id)
	const { entryId, session } = await import('@/lib/session').then(
		({ getVerifiedEntryContext }) => getVerifiedEntryContext()
	)
	let currentEventId: number | null = null
	let tournament: EntryTournament | null = null
	let canManage = false
	let participants: TournamentParticipant[] = []
	let softError: string | null = null
	let loadError: TournamentDetailLoadError | null = null
	let initialOfficialH2H: TournamentOfficialH2H | null = null
	let initialSnapshot = null
	const query = await searchParams
	const justCreated = query.created === '1'
	const requestedGameweekValue =
		typeof query.gw === 'string' ? Number(query.gw) : null
	const requestedGameweek =
		typeof requestedGameweekValue === 'number' &&
		Number.isInteger(requestedGameweekValue) &&
		requestedGameweekValue >= 1 &&
		requestedGameweekValue <= 38
			? requestedGameweekValue
			: null
	let officialGameweek = requestedGameweek ?? 1

	if (!entryId) {
		loadError = 'bind_entry'
	} else if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
		loadError = 'invalid_link'
	} else {
		try {
			// Participant metadata is independent of the lightweight shell queries;
			// start it now so the detail page does not serialize the first render.
			const participantsPromise =
				executeServerQueryWithSession<TournamentParticipantsResponse>(
					session,
					GET_TOURNAMENT_PARTICIPANTS,
					{ tournamentId },
					{ cache: 'no-store' }
				).then(
					data => ({ data, error: null as unknown }),
					error => ({ data: null, error })
				)
			const managedPromise =
				executeServerQueryWithSession<ManagedTournamentResponse>(
					session,
					GET_MANAGED_TOURNAMENT,
					{ tournamentId, entryId },
					{ cache: 'no-store' }
				).then(
					data => ({ data, error: null as unknown }),
					error => ({ data: null, error })
				)
			// Keep the detail shell cheap. Live standings are deliberately not part
			// of this request; the client loads the bounded paginated board below.
			const [metadata, managedResult, liveContext] = await Promise.all([
				executeServerQueryWithSession<TournamentMetadataResponse>(
					session,
					GET_TOURNAMENT_METADATA,
					{ tournamentId, entryId },
					{ cache: 'no-store' }
				),
				managedPromise,
				executeServerQueryWithSession<LiveContextResponse>(
					session,
					GET_LIVE_CONTEXT,
					undefined,
					{ cache: 'no-store' }
				)
			])
			const selectedTournament =
				metadata.tournament ?? managedResult.data?.managedTournament ?? null
			if (!selectedTournament) {
				// A manager-only viewer has no participant metadata. Do not turn a
				// transient management lookup failure into a false no-access result;
				// only tolerate that soft failure once metadata has already authorized
				// the detail page.
				if (managedResult.error) throw managedResult.error
				loadError = 'no_access'
			} else {
				tournament = selectedTournament
				canManage = Boolean(managedResult.data?.managedTournament)
				currentEventId =
					liveContext.liveContext?.anchorEventId ??
					liveContext.coreEventContext.currentEventId ??
					null
				officialGameweek = requestedGameweek ?? currentEventId ?? 1
				const isOfficialH2H =
					selectedTournament.leagueType === 'H2H' &&
					selectedTournament.rosterMode === 'OFFICIAL_SYNC' &&
					selectedTournament.groupMode === 'BATTLE_RACES'
				const officialH2HPromise =
					isOfficialH2H && officialGameweek > 0
						? executeServerQueryWithSession<TournamentOfficialH2HResponse>(
								session,
								GET_TOURNAMENT_OFFICIAL_H2H,
								{ tournamentId, eventId: officialGameweek },
								{ cache: 'no-store' }
							).then(
								data => ({ data, error: null as unknown }),
								error => ({ data: null, error })
							)
						: Promise.resolve(null)
				const [participantResult, officialH2HResult] = await Promise.all([
					participantsPromise,
					officialH2HPromise
				])
				if (!participantResult.data) {
					softError = liveT('participantsUnavailable')
				} else {
					participants = participantResult.data.tournamentParticipants
				}
				if (officialH2HResult) {
					if (officialH2HResult.data) {
						initialOfficialH2H = officialH2HResult.data.tournamentOfficialH2H
						if (!initialOfficialH2H) softError = liveT('officialH2HUnavailable')
					} else {
						softError = liveT('officialH2HUnavailable')
					}
				}
			}
		} catch (error) {
			const kind = classifyTournamentDetailError(error)
			if (kind === 'no_access') {
				console.warn(
					'[tournament detail] No access:',
					error instanceof Error ? error.name : 'UnknownError'
				)
			} else {
				console.error(
					'[tournament detail] Failed to load:',
					error instanceof Error ? error.name : 'UnknownError'
				)
			}
			if (kind === 'unavailable') {
				const fallbackParams = new URLSearchParams({
					tournamentId: String(tournamentId)
				})
				if (requestedGameweek !== null) {
					fallbackParams.set('gw', String(requestedGameweek))
				}
				// The list desk has revision recovery and a bounded retry path. Do
				// not strand a user on the less resilient detail route after a
				// transient live-publication failure.
				redirect(
					localizeHref(
						`/live/competitions?${fallbackParams.toString()}`,
						locale
					)
				)
			}
			loadError = kind
			tournament = null
		}
	}

	return (
		<TournamentDetailClient
			key={`${tournament?.updatedAt ?? 'missing'}:${tournament?.setupProgressUpdatedAt ?? ''}:${officialGameweek}`}
			canManage={canManage}
			tournament={tournament}
			currentGameweek={
				tournament?.leagueType === 'H2H' &&
				tournament.rosterMode === 'OFFICIAL_SYNC' &&
				tournament.groupMode === 'BATTLE_RACES'
					? officialGameweek
					: (currentEventId ?? undefined)
			}
			activeGameweek={currentEventId ?? undefined}
			entryId={entryId}
			initialRows={[]}
			loadError={loadError}
			softError={softError}
			initialSnapshot={initialSnapshot}
			initialOfficialH2H={initialOfficialH2H}
			initialParticipants={participants}
			justCreated={justCreated}
		/>
	)
}
