import 'server-only'

import { GET_LIVE_CONTEXT, type LiveContextResponse } from '@/lib/graphql/operations/live'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	resolveSeasonPresentation,
	type SeasonPresentation,
} from '@/lib/season-presentation'

export type LivePageContext = {
	presentation: SeasonPresentation
	liveContext: LiveContextResponse['liveContext'] | null
}

/** Load the shared public context and preserve a fetch failure as UNAVAILABLE. */
export async function getLivePageContext(): Promise<LivePageContext> {
	try {
		const response = await executePublicServerQuery<LiveContextResponse>(
			'gameweek',
			GET_LIVE_CONTEXT,
			undefined,
			{ cache: 'no-store' },
		)
		return {
			presentation: resolveSeasonPresentation(
				response.coreEventContext,
				response.liveContext?.producerState ?? null,
			),
			liveContext: response.liveContext ?? null,
		}
	} catch (error) {
		console.error('[live-context] failed to load shared context:', error)
		return {
			presentation: resolveSeasonPresentation(null),
			liveContext: null,
		}
	}
}
