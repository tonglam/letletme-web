import type { EntryTournament } from '@/lib/graphql/operations/tournaments'
import { publicTournamentServiceError } from '@/lib/tournament/public-response'
import { z } from 'zod'

export const createTournamentNameSchema = (messages = {
	tooShort: 'Tournament name must be at least 3 characters',
	tooLong: 'Tournament name must be 80 characters or fewer',
}) => z.object({
	name: z
		.string()
		.trim()
		.min(3, messages.tooShort)
		.max(80, messages.tooLong),
})

export const tournamentNameSchema = createTournamentNameSchema()

export type TournamentNameForm = z.infer<typeof tournamentNameSchema>

const titleCase = (value: string) =>
	value
		.toLowerCase()
		.split('_')
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ')

export const getTournamentStructure = (tournament: EntryTournament) => ({
	groupStage:
		tournament.groupMode === 'NONE'
			? 'No group stage'
			: tournament.groupMode === 'H2H'
				? 'Head-to-head groups'
				: 'Points-race groups',
	knockoutStage:
		tournament.knockoutMode === 'NONE'
			? 'No knockout stage'
			: tournament.knockoutMode === 'DOUBLE_ELIMINATION'
				? 'Home-and-away knockout'
				: 'Single-elimination knockout',
	groupGameweeks:
		tournament.groupStartedEventId && tournament.groupEndedEventId
			? `GW${tournament.groupStartedEventId}–GW${tournament.groupEndedEventId}`
			: 'Not scheduled',
	knockoutGameweeks:
		tournament.knockoutStartedEventId && tournament.knockoutEndedEventId
			? `GW${tournament.knockoutStartedEventId}–GW${tournament.knockoutEndedEventId}`
			: 'Not scheduled',
	state: titleCase(tournament.state),
	type: titleCase(tournament.leagueType),
})

export const formatTournamentDate = (value: string) => {
	const timestamp = Date.parse(value)
	if (!Number.isFinite(timestamp)) return 'Unknown'
	return new Intl.DateTimeFormat('en-AU', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	}).format(timestamp)
}

export const readTournamentMutationError = async (response: Response) => {
	await response.json().catch(() => null)
	return publicTournamentServiceError(response.status)
}
