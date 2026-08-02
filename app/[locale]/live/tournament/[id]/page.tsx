import { getCurrentAndNextEvents } from '@/lib/events'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_LIVE_POINTS,
	type EntryTournament,
	type EntryTournamentsResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse,
} from '@/lib/graphql/operations/tournaments'
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
		descriptionKey: 'tournamentStandingsDescription',
	})
}

type PageProps = {
	params: LocaleParams<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params }: PageProps) {
	const { id } = await getPageLocale(params)
	const t = await getTranslations('States')
	const tournamentId = Number(id)
	const [entryId, events] = await Promise.all([
		getCurrentEntryId(),
		getCurrentAndNextEvents(),
	])
	const currentEventId = events?.current[0]?.id
	let tournament: EntryTournament | null = null
	let initialRows: TournamentLiveCalcData[] = []
	let initialError: string | null = null

	if (!entryId) {
		initialError = t('bindEntryRequired')
	} else if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
		initialError = t('invalidTournamentLink')
	} else {
		try {
			const tournamentsData = await executeServerQuery<EntryTournamentsResponse>(
				GET_ENTRY_TOURNAMENTS,
				{ entryId },
				{ cache: 'no-store' },
			)
			tournament =
				tournamentsData.entryTournaments.find(item => item.id === tournamentId) ?? null

			if (!tournament) {
				initialError = t('tournamentNoAccess')
			} else if (!currentEventId) {
				initialError = t('currentGameweekUnavailable')
			} else {
				const standings = await executeServerQuery<TournamentLivePointsResponse>(
					GET_TOURNAMENT_LIVE_POINTS,
					{ tournamentId, eventId: currentEventId },
					{ cache: 'no-store' },
				)
				initialRows = standings.calcLivePointsForTournament.results ?? []
			}
		} catch (error) {
			console.error('[tournament detail] Failed to load:', error)
			initialError = t('tournamentDataUnavailable')
		}
	}

	return (
		<TournamentDetailClient
			canManage={Boolean(tournament && entryId && tournament.adminEntryId === entryId)}
			tournament={tournament}
			currentGameweek={currentEventId}
			initialRows={initialRows}
			initialError={initialError}
		/>
	)
}
