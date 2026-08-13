import 'server-only'

import { CORE_AUTHORITY_FETCH_OPTIONS } from '@/lib/core-authority-cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	PLAYER_STATS_DESK_QUERIES,
	type PlayerStatsDeskGraphQLResponse,
	type PlayerStatsDeskSection
} from '@/lib/graphql/operations/players'
import {
	normalizePlayerStatsDeskResult,
	type PlayerStatsDeskLoadResult
} from '@/lib/player-stats-desk'

export async function loadPlayerStatsDesk(
	playerIds: number[],
	eventId: number,
	horizon: number,
	section: PlayerStatsDeskSection
): Promise<PlayerStatsDeskLoadResult> {
	const response =
		await executePublicServerQuery<PlayerStatsDeskGraphQLResponse>(
			PLAYER_STATS_DESK_QUERIES[section],
			{ playerIds, eventId, horizon },
			CORE_AUTHORITY_FETCH_OPTIONS
		)
	return normalizePlayerStatsDeskResult(
		response.playerStatsDesk,
		playerIds,
		section
	)
}
