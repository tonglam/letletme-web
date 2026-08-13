import 'server-only'

import { CORE_AUTHORITY_FETCH_OPTIONS } from '@/lib/core-authority-cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	loadGameweekDeskWithExecutor,
	type GameweekDeskData,
	type GameweekDeskGraphQLResponse
} from '@/lib/gameweek-desk'

export async function loadGameweekDesk(
	eventId?: number
): Promise<GameweekDeskData> {
	const result = await loadGameweekDeskWithExecutor(
		eventId,
		(query, variables) =>
			executePublicServerQuery<GameweekDeskGraphQLResponse>(
				query,
				variables,
				CORE_AUTHORITY_FETCH_OPTIONS
			)
	)
	if (result.outcome === 'failed') {
		throw new Error('Gameweek desk is temporarily unavailable')
	}
	const { outcome: _outcome, ...data } = result
	return data
}
