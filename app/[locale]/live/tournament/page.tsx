import { getCurrentEntryId } from '@/lib/session'
import { getCurrentAndNextEvents } from '@/lib/events'
import { PageState } from '@/components/feedback/PageState'
import PageShell from '@/components/layout/PageShell'
import { executeServerQuery } from '@/lib/graphql-server'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_LIVE_POINTS,
	type EntryTournamentsResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse
} from '@/lib/graphql/operations/tournaments'
import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import { CalendarX2 } from 'lucide-react'
import { Suspense } from 'react'
import TournamentClient from '@/app/live/tournament/TournamentClient'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/live/tournament',
		titleKey: 'liveTournamentsTitle',
		descriptionKey: 'liveTournamentsDescription'
	})
}

type PageProps = {
	params: LocaleParams
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params, searchParams }: PageProps) {
	await getPageLocale(params)
	const [t, liveT] = await Promise.all([
		getTranslations('States'),
		getTranslations('LiveTournament')
	])
	const resolvedSearchParams = await searchParams
	const [entryId, events] = await Promise.all([
		getCurrentEntryId(),
		getCurrentAndNextEvents()
	])
	const currentEventId = events?.current[0]?.id

	if (!currentEventId) {
		return (
			<PageShell>
				<PageState
					icon={CalendarX2}
					title={t('liveTournamentUnavailableTitle')}
					description={t('gameweekUnavailableDescription')}
				/>
			</PageShell>
		)
	}
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
					{ cache: 'no-store' }
				)
			initialTournaments = tournamentsData.entryTournaments.map(
				mapEntryTournamentToLiveTournament
			)
			const requestedTournamentId =
				typeof resolvedSearchParams.tournamentId === 'string'
					? resolvedSearchParams.tournamentId
					: ''
			initialSelectedTournamentId =
				initialTournaments.find(
					tournament => tournament.id === requestedTournamentId
				)?.id ??
				initialTournaments[0]?.id ??
				''

			const tournamentId = Number(initialSelectedTournamentId)
			if (tournamentId > 0 && currentEventId) {
				const currentResponse =
					await executeServerQuery<TournamentLivePointsResponse>(
						GET_TOURNAMENT_LIVE_POINTS,
						{ tournamentId, eventId: currentEventId },
						{ cache: 'no-store' }
					)
				initialCurrentRows =
					currentResponse.calcLivePointsForTournament.results ?? []
				const batch = currentResponse.calcLivePointsForTournament
				if (batch.meta.failedCount > 0) {
					initialResultsError = liveT('partialResults', {
						failed: batch.meta.failedCount,
						total: batch.meta.totalEntries
					})
				} else {
					initialSnapshot = currentResponse.liveSnapshot
				}
				initialResultsLoaded = true
			}
		} catch (err) {
			console.error('Failed to seed live tournament page:', err)
		}
	}

	return (
		<Suspense
			fallback={
				<div className="mx-auto max-w-4xl px-4 py-12 text-sm text-muted-foreground">
					{t('loadingTournaments')}
				</div>
			}
		>
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
		</Suspense>
	)
}
