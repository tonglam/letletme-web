import TournamentClient from '@/app/live/tournaments/TournamentClient'
import { SeasonPhaseState } from '@/components/feedback/SeasonPhaseState'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'
import {
	GET_TOURNAMENT_LIVE_DESK,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse
} from '@/lib/graphql/operations/tournaments'
import { executeServerQuery } from '@/lib/graphql-server'
import { getLivePageContext } from '@/lib/live-context-server'
import { liveContextToSnapshot } from '@/lib/live-refresh'
import { getCurrentEntryId } from '@/lib/session'
import { getCurrentSeasonKey } from '@/lib/season'
import { getTournamentLiveBatchSeed } from '@/lib/tournament/liveEntries'
import { loadTournamentLiveDeskWithRevisionRecovery } from '@/lib/tournament/liveDesk'
import { areTournamentStandingsReady } from '@/lib/tournament/lifecycle'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await getPageLocale(params)
	return getPageMetadata({
		locale,
		pathname: '/live/competitions',
		titleKey: 'liveCompetitionsTitle',
		descriptionKey: 'liveCompetitionsDescription'
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

	// Public lifecycle context and the fresh entry authorization hint are
	// independent. Resolve them together so the desk is the only personalized
	// live query on the initial render.
	const [{ presentation, liveContext }, entryId] = await Promise.all([
		getLivePageContext(),
		getCurrentEntryId()
	])
	if (
		presentation.phase === 'PRESEASON' ||
		liveContext?.windowState === 'PRESEASON' ||
		liveContext?.windowState === 'OFFSEASON' ||
		(!liveContext?.anchorEventId &&
			presentation.phase !== 'BETWEEN_GAMEWEEKS') ||
		presentation.phase === 'UNAVAILABLE'
	) {
		return (
			<SeasonPhaseState
				feature="competition"
				presentation={presentation}
			/>
		)
	}

	const currentEventId =
		liveContext?.anchorEventId ?? presentation.currentEventId
	if (!currentEventId) {
		return (
			<SeasonPhaseState
				feature="competition"
				presentation={presentation}
			/>
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
	let initialOfficialCoverage = 0

	if (entryId) {
		try {
			const requestedTournamentId =
				typeof resolvedSearchParams.tournamentId === 'string'
					? resolvedSearchParams.tournamentId
					: ''
			const requestedTournamentIdNumber = Number(requestedTournamentId)
			const context = liveContext
			const ref =
				context?.revision && context.anchorEventId
					? {
							season: context.season || String(getCurrentSeasonKey()),
							eventId: context.anchorEventId,
							revision: context.revision
						}
					: null
			const selectedTournamentId =
				requestedTournamentId &&
				Number.isSafeInteger(requestedTournamentIdNumber) &&
				requestedTournamentIdNumber > 0
					? requestedTournamentIdNumber
					: null
			const desk = await loadTournamentLiveDeskWithRevisionRecovery(
				liveRef =>
					executeServerQuery<TournamentLivePointsResponse>(
						GET_TOURNAMENT_LIVE_DESK,
						{ entryId, selectedTournamentId, ref: liveRef },
						{ cache: 'no-store' }
					),
				ref
			)
			initialTournaments = desk.entryLiveCompetitionsDesk.tournaments.map(
				mapEntryTournamentToLiveTournament
			)
			initialSelectedTournamentId =
				desk.entryLiveCompetitionsDesk.selectedTournamentId?.toString() ??
				initialTournaments[0]?.id ??
				''
			const selectedTournament = initialTournaments.find(
				tournament => tournament.id === initialSelectedTournamentId
			)
			if (
				selectedTournament &&
				areTournamentStandingsReady(selectedTournament)
			) {
				const seed = getTournamentLiveBatchSeed(desk)
				initialCurrentRows = seed.rows
				initialOfficialCoverage = seed.officialCoverage
				initialSnapshot = liveContextToSnapshot(liveContext) ?? seed.snapshot
				if (seed.failedCount > 0) {
					initialResultsError = liveT('partialResults', {
						failed: seed.failedCount,
						total: seed.totalEntries
					})
				}
			}
			initialResultsLoaded = true
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
			initialOfficialCoverage={initialOfficialCoverage}
		/>
	)
}
