import { GraphQLRequestError } from '@/lib/graphql-client'
import type { TournamentLivePointsResponse } from '@/lib/graphql/operations/tournaments'

export type TournamentLiveScoreRef = {
	season: string
	eventId: number
	scoreCoreRevision: string
} | null

type TournamentDeskExecutor = (
	ref: TournamentLiveScoreRef,
	options?: { handledErrorCodes?: readonly string[] }
) => Promise<TournamentLivePointsResponse>

const REVISION_RECOVERY_OPTIONS = {
	handledErrorCodes: ['LIVE_SCORE_REVISION_GONE']
} as const

export const isLiveScoreRevisionGone = (error: unknown): boolean =>
	(error instanceof GraphQLRequestError &&
		error.code === 'LIVE_SCORE_REVISION_GONE') ||
	String(error).includes('LIVE_SCORE_REVISION_GONE')

/**
 * A publication can advance between the context read and a tournament desk
 * request. Recover once against the current desk instead of surfacing a 409.
 */
export async function loadTournamentLiveDeskWithRevisionRecovery(
	execute: TournamentDeskExecutor,
	ref: TournamentLiveScoreRef
): Promise<TournamentLivePointsResponse> {
	try {
		return await execute(ref, ref ? REVISION_RECOVERY_OPTIONS : undefined)
	} catch (error) {
		if (!ref || !isLiveScoreRevisionGone(error)) throw error
		return execute(null)
	}
}
