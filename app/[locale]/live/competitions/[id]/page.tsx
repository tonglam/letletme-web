import TournamentDetailClient from '@/app/live/tournaments/[id]/TournamentDetailClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { localizeHref } from '@/i18n/routing'
import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'
import {
	GET_TOURNAMENT_DETAIL_DESK,
	type EntryTournament,
	type TournamentDetailDeskResponse,
	type TournamentLiveCalcData,
	type TournamentOfficialH2H,
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
	let initialRows: TournamentLiveCalcData[] = []
	let participants: TournamentParticipant[] = []
	let softError: string | null = null
	let loadError: TournamentDetailLoadError | null = null
	let initialSnapshot: LiveSnapshotStatus | null = null
	let initialOfficialH2H: TournamentOfficialH2H | null = null
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
			const desk =
				await executeServerQueryWithSession<TournamentDetailDeskResponse>(
					session,
					GET_TOURNAMENT_DETAIL_DESK,
					{ tournamentId, entryId, eventId: requestedGameweek },
					{ cache: 'no-store' }
				)
			const detail = desk.tournamentDetailDesk
			if (!detail) {
				loadError = 'no_access'
			} else {
				tournament = detail.tournament
				canManage = detail.canManage
				participants = detail.participants
				currentEventId = detail.context.activeEventId
				officialGameweek = requestedGameweek ?? currentEventId ?? 1
				initialOfficialH2H = detail.officialH2H
				if (detail.unavailableSections.length > 0) {
					softError = liveT('participantsUnavailable')
				}
				if (detail.kind === 'OFFICIAL_H2H' && !initialOfficialH2H) {
					softError = liveT('officialH2HUnavailable')
				}
				if (detail.kind === 'LIVE_POINTS' && detail.live) {
					initialRows = detail.live.rows
					initialSnapshot = {
						eventId: detail.live.eventId,
						revision: detail.live.revision,
						state: detail.live.state as LiveSnapshotStatus['state'],
						publishedAt: null,
						checkedAt: null
					}
					if (detail.live.partial) {
						softError = liveT('partialResults', {
							failed: detail.live.failedEntryIds.length,
							total: detail.live.totalEntries
						})
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
			initialRows={initialRows}
			loadError={loadError}
			softError={softError}
			initialSnapshot={initialSnapshot}
			initialOfficialH2H={initialOfficialH2H}
			initialParticipants={participants}
			justCreated={justCreated}
		/>
	)
}
