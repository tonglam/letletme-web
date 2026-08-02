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
import type { Metadata } from 'next'
import TournamentDetailClient from './TournamentDetailClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
	title: 'Tournament standings',
	description: 'Review live standings, tournament details, and competition rules.',
}

type PageProps = {
	params: Promise<{ id: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params }: PageProps) {
	const { id } = await params
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
		initialError = 'Sign in and bind an FPL entry to view this tournament.'
	} else if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
		initialError = 'This tournament link is invalid.'
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
				initialError = 'This tournament is unavailable or you do not have access.'
			} else if (!currentEventId) {
				initialError = 'The current gameweek is unavailable.'
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
			initialError = 'Tournament data is temporarily unavailable.'
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
