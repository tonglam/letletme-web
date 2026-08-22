import { GraphQLRequestError } from '@/lib/graphql-client'
import type { TournamentLivePointsResponse } from '@/lib/graphql/operations/tournaments'

export type TournamentLiveRevisionRef = {
	season: string
	eventId: number
	revision: string
} | null

type TournamentDeskExecutor = (
	ref: TournamentLiveRevisionRef
) => Promise<TournamentLivePointsResponse>

export const isLiveRevisionGone = (error: unknown): boolean =>
	(error instanceof GraphQLRequestError &&
		error.code === 'LIVE_REVISION_GONE') ||
	String(error).includes('LIVE_REVISION_GONE')

/**
 * A publication can advance between the context read and a tournament desk
 * request. Recover once against the current desk instead of surfacing a 409.
 */
export async function loadTournamentLiveDeskWithRevisionRecovery(
	execute: TournamentDeskExecutor,
	ref: TournamentLiveRevisionRef
): Promise<TournamentLivePointsResponse> {
	try {
		return await execute(ref)
	} catch (error) {
		if (!ref || !isLiveRevisionGone(error)) throw error
		return execute(null)
	}
}
