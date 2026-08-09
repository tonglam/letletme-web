import 'server-only'

import type { Session } from '@/lib/auth'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import type { EventsResponse } from '@/lib/graphql/operations/events'
import {
	GET_ENTRY_EVENT_RESULT,
	GET_ENTRY_HISTORY,
	type EntryEventResultResponse,
	type EntryHistoryResponse,
} from '@/lib/graphql/operations/entries'
import { resolveSquadPickElementIds } from '@/lib/squad-pick-resolve'
import {
	squadPickEventCandidates,
	squadPicksFromEntry,
	type SquadPickSeed,
} from '@/lib/squad-picks'

export async function loadEntrySquadPicks(
	session: Session,
	entryId: number,
	events: EventsResponse | null | undefined,
): Promise<SquadPickSeed[]> {
	const history = await executeServerQueryWithSession<EntryHistoryResponse>(
		session,
		GET_ENTRY_HISTORY,
		{ entryId },
		{ cache: 'no-store' },
	).catch(err => {
		console.error('[squad-picks] entry history failed:', err)
		return null
	})

	const historyResults = history?.entryHistory?.results ?? []
	const historyEventIds = historyResults
		.map(row => row.eventId)
		.filter((id): id is number => typeof id === 'number' && id > 0)
	const candidates = squadPickEventCandidates(events, historyEventIds)

	for (const eventId of candidates) {
		const result = await executeServerQueryWithSession<EntryEventResultResponse>(
			session,
			GET_ENTRY_EVENT_RESULT,
			{ entryId, eventId },
			{ cache: 'no-store' },
		).catch(err => {
			console.error(`[squad-picks] entry event ${eventId} failed:`, err)
			return null
		})

		const picks = result?.entryEventResult?.eventPicks ?? []
		if (picks.length > 0) {
			let seeds = squadPicksFromEntry(picks)
			seeds = await resolveSquadPickElementIds(seeds)
			return seeds
		}
	}

	return []
}
