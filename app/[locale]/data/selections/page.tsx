import { getCurrentAndNextEvents } from '@/lib/events'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_SELECTION_STATS,
	type EntryTournamentsResponse,
	type TournamentSelectionStatsResponse,
	type TournamentStatPlayer,
} from '@/lib/graphql/operations/tournaments'
import {
	SELECTIONS_MOCK_ENTRY_ID,
	SELECTIONS_MOCK_EVENT_ID,
	SELECTIONS_UI_MOCK_ENABLED,
	getSelectionsUiMockStats,
	getSelectionsUiMockTournaments,
} from '@/lib/dev/selections-ui-mock'
import { getCurrentEntryId } from '@/lib/session'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import { areTournamentInsightsReady } from '@/lib/tournament/lifecycle'
import { CalendarX2 } from 'lucide-react'
import SelectionsClient from '@/app/data/selections/SelectionsClient'
import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getTranslations } from 'next-intl/server'

interface StatsResult {
	selection: TournamentStatPlayer[]
	captain: TournamentStatPlayer[]
	transferIn: TournamentStatPlayer[]
	transferOut: TournamentStatPlayer[]
}

export const dynamic = 'force-dynamic'

type PageProps = { params: LocaleParams }

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/data/selections',
		titleKey: 'selectionsTitle',
		descriptionKey: 'selectionsDescription',
	})
}

export default async function SelectionsPage({ params }: PageProps) {
	await getPageLocale(params)
	const t = await getTranslations('States')

	// TEMP UI mock — seed page without GraphQL / entry
	if (SELECTIONS_UI_MOCK_ENABLED) {
		const tournaments = getSelectionsUiMockTournaments()
		return (
			<SelectionsClient
				entryId={SELECTIONS_MOCK_ENTRY_ID}
				initialTournaments={tournaments}
				initialSelectedTournamentId={tournaments[0]?.id ?? ''}
				initialStats={getSelectionsUiMockStats()}
				initialGameweek={SELECTIONS_MOCK_EVENT_ID}
			/>
		)
	}

	const [entryId, events] = await Promise.all([
		getCurrentEntryId(),
		getCurrentAndNextEvents(),
	])
	const currentGameweek = events?.current[0]?.id

	if (!currentGameweek) {
		return (
			<PageShell>
				<PageState
					icon={CalendarX2}
					title={t('selectionUnavailableTitle')}
					description={t('gameweekUnavailableDescription')}
				/>
			</PageShell>
		)
	}

	let initialTournaments: ReturnType<typeof mapEntryTournamentToLiveTournament>[] =
		[]
	let initialStats: StatsResult | null = null

	if (entryId) {
		try {
			const tournamentsData = await executeServerQuery<EntryTournamentsResponse>(
				GET_ENTRY_TOURNAMENTS,
				{ entryId },
				{ cache: 'no-store' },
			)
			initialTournaments = tournamentsData.entryTournaments.map(
				mapEntryTournamentToLiveTournament,
			)

			const firstTournament = initialTournaments[0]
			const firstTournamentId = Number(firstTournament?.id)
			if (
				firstTournamentId > 0 &&
				firstTournament &&
				areTournamentInsightsReady(firstTournament)
			) {
				const statsData =
					await executeServerQuery<TournamentSelectionStatsResponse>(
						GET_TOURNAMENT_SELECTION_STATS,
						{
							tournamentId: firstTournamentId,
							eventId: currentGameweek,
							limit: 10,
						},
						{ cache: 'no-store' },
					)
				const stats = statsData.tournamentSelectionStats
				initialStats = {
					selection: stats?.mostSelectedPlayers ?? [],
					captain: stats?.captainSelect ?? [],
					transferIn: stats?.mostTransferIn ?? [],
					transferOut: stats?.mostTransferOut ?? [],
				}
			}
		} catch (err) {
			console.error('Failed to seed tournament selections:', err)
		}
	}

	return (
		<SelectionsClient
			entryId={entryId ?? 0}
			initialTournaments={initialTournaments}
			initialSelectedTournamentId={initialTournaments[0]?.id ?? ''}
			initialStats={initialStats}
			initialGameweek={currentGameweek}
		/>
	)
}
