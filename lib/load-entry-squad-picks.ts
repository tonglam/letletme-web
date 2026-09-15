import 'server-only'

import { getVerifiedEntryContext, hasSessionCookieHint } from '@/lib/session'
import { getCurrentAndNextEvents } from '@/lib/events'
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
	classifyEntrySquadPicks,
	runSquadReadWithinBudget,
	squadReadOptions,
	type PersonalSquadSeed,
	type SquadReadBudget,
	squadPickEventCandidates,
	squadPicksFromEntry,
	type EntrySquadPicksResult,
	type SquadPickSeed,
} from '@/lib/squad-picks'

export async function loadEntrySquadPicks(
	session: Session,
	entryId: number,
	events: EventsResponse | null | undefined,
	budget?: SquadReadBudget,
): Promise<EntrySquadPicksResult> {
	if (!budget) {
		const result = await runSquadReadWithinBudget(next => loadEntrySquadPicks(session, entryId, events, next))
		return { picks: result.picks, state: result.state === 'unbound' ? 'unavailable' : result.state }
	}
	let requestFailed = false
	let history: EntryHistoryResponse | null = null
	try {
		history = await executeServerQueryWithSession<EntryHistoryResponse>(
			session,
			GET_ENTRY_HISTORY,
			{ entryId },
			{ cache: 'no-store', ...squadReadOptions(budget) }
		)
	} catch (err) {
		requestFailed = true
		console.error('[squad-picks] entry history failed:', err)
	}

	const historyResults = history?.entryHistory?.results ?? []
	const historyEventIds = historyResults
		.map(row => row.eventId)
		.filter((id): id is number => typeof id === 'number' && id > 0)
	const candidates = squadPickEventCandidates(events, historyEventIds)

	for (const eventId of candidates) {
		squadReadOptions(budget)
		let result: EntryEventResultResponse
		try {
			result = await executeServerQueryWithSession<EntryEventResultResponse>(
				session,
				GET_ENTRY_EVENT_RESULT,
				{ entryId, eventId },
				{ cache: 'no-store', ...squadReadOptions(budget) }
			)
		} catch (err) {
			requestFailed = true
			console.error(`[squad-picks] entry event ${eventId} failed:`, err)
			continue
		}

		const picks = result.entryEventResult?.eventPicks ?? []
		if (picks.length > 0) {
			try {
				let seeds: SquadPickSeed[] = squadPicksFromEntry(picks)
				seeds = await resolveSquadPickElementIds(seeds, budget)
				return classifyEntrySquadPicks(seeds, requestFailed)
			} catch (err) {
				console.error('[squad-picks] player identity resolution failed:', err)
				return classifyEntrySquadPicks([], true)
			}
		}
	}

	return classifyEntrySquadPicks([], requestFailed)
}

export function loadPersonalSquadSeed(eventsPromise?: Promise<EventsResponse | null>): Promise<PersonalSquadSeed> {
	return runSquadReadWithinBudget(async budget => {
		if (!(await hasSessionCookieHint())) return { picks: [], state: 'unbound' }
		squadReadOptions(budget)
		const identity = await getVerifiedEntryContext()
		if (!identity.session || identity.entryId == null) return { picks: [], state: 'unbound' }
		squadReadOptions(budget)
		const events = await (eventsPromise ?? getCurrentAndNextEvents())
		squadReadOptions(budget)
		return loadEntrySquadPicks(identity.session, identity.entryId, events, budget)
	})
}
