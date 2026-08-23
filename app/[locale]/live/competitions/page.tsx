import TournamentClient from '@/app/live/tournaments/TournamentClient'
import { createHash } from 'node:crypto'
import { SeasonPhaseState } from '@/components/feedback/SeasonPhaseState'
import { getPageLocale, getPageMetadata, type LocaleParams } from '@/i18n/page'
import {
	GET_ENTRY_TOURNAMENTS,
	type EntryTournamentsResponse
} from '@/lib/graphql/operations/tournaments'
import { executeServerQuery } from '@/lib/graphql-server'
import { getLivePageContext } from '@/lib/live-context-server'
import { getVerifiedEntryContext } from '@/lib/session'
import { getCurrentSeasonKey } from '@/lib/season'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'

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
	const resolvedSearchParams = await searchParams

	// Public lifecycle context and the fresh entry authorization hint are
	// independent. Resolve them together; the initial render fetches only the
	// lightweight tournament list, while the browser can paint strict last-good
	// board data before starting the paginated board request.
	const [{ presentation, liveContext }, verified] = await Promise.all([
		getLivePageContext(),
		getVerifiedEntryContext()
	])
	const entryId = verified.entryId
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
	const season = liveContext?.season || String(getCurrentSeasonKey())
	const sessionIdentity = verified.session as unknown as {
		user?: { id?: string }
		session?: { id?: string }
	} | null
	const sessionCacheKey = entryId
		? createHash('sha256')
				.update(
					`${sessionIdentity?.user?.id ?? 'handoff'}:${sessionIdentity?.session?.id ?? 'session'}:${entryId}`
				)
				.digest('hex')
				.slice(0, 24)
		: ''

	if (entryId) {
		try {
			const requestedTournamentId =
				typeof resolvedSearchParams.tournamentId === 'string'
					? resolvedSearchParams.tournamentId
					: ''
			const requestedTournamentIdNumber = Number(requestedTournamentId)
			const selectedTournamentIdFromUrl =
				requestedTournamentId &&
				Number.isSafeInteger(requestedTournamentIdNumber) &&
				requestedTournamentIdNumber > 0
					? requestedTournamentIdNumber
					: null
			const tournamentData = await executeServerQuery<EntryTournamentsResponse>(
				GET_ENTRY_TOURNAMENTS,
				{ entryId },
				{ cache: 'no-store' }
			)
			initialTournaments = tournamentData.entryTournaments.map(
				mapEntryTournamentToLiveTournament
			)
			initialSelectedTournamentId =
				(selectedTournamentIdFromUrl &&
				initialTournaments.some(
					tournament => tournament.id === String(selectedTournamentIdFromUrl)
				)
					? String(selectedTournamentIdFromUrl)
					: initialTournaments[0]?.id) ?? ''
		} catch (err) {
			console.error('Failed to seed live tournament list:', err)
		}
	}

	return (
		<TournamentClient
			entryId={entryId ?? 0}
			initialTournaments={initialTournaments}
			initialSelectedTournamentId={initialSelectedTournamentId}
			initialEventId={currentEventId}
			initialBoardPage={null}
			initialResultsLoaded={false}
			initialResultsError={null}
			season={season}
			sessionCacheKey={sessionCacheKey}
		/>
	)
}
