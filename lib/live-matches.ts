import {
	GET_CURRENT_AND_NEXT_EVENTS,
	type EventsResponse
} from '@/lib/graphql/operations/events'
import {
	GET_LIVE_MATCHDAY_DESK,
	type LiveMatchdayDeskRow,
	type LiveMatchdayDeskResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import { executeQuery } from '@/lib/graphql-client'
import { getCurrentSeasonKey } from '@/lib/season'
import { teamFullNames } from '@/types/common'
import type { Match } from '@/types/match'

type QueryExecutor = <T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: { cache?: RequestCache }
) => Promise<T>

function getTeamShortName(fullName: string): string {
	const normalized = fullName.trim()
	const exact = Object.entries(teamFullNames).find(
		([, name]) => name.toLowerCase() === normalized.toLowerCase()
	)
	if (exact) return exact[0]
	const partial = Object.entries(teamFullNames).find(
		([, name]) =>
			name.toLowerCase().includes(normalized.toLowerCase()) ||
			normalized.toLowerCase().includes(name.toLowerCase())
	)
	return partial?.[0] ?? normalized.substring(0, 3).toUpperCase()
}

export function transformLiveMatches(
	rows: LiveMatchdayDeskResponse['liveMatchdayDesk']['matches']
): Match[] {
	return rows.map(row => ({
		id: String(row.fixtureId),
		homeTeam: {
			name: row.homeTeamName,
			shortName: row.homeTeamShortName || getTeamShortName(row.homeTeamName),
			score: row.homeScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		awayTeam: {
			name: row.awayTeamName,
			shortName: row.awayTeamShortName || getTeamShortName(row.awayTeamName),
			score: row.awayScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		status:
			row.finished || row.finishedProvisional
				? 'FT'
				: row.started
					? 'LIVE'
					: 'NOT_STARTED',
		minute: row.minutes,
		kickoff: row.kickoffTime ?? '',
		viewers: 0,
		provisional: row.finishedProvisional === true
	}))
}

export function transformUpcomingFixtures(
	fixtures: ReadonlyArray<
		| LiveMatchdayDeskRow
		| {
				id: number
				homeTeam: { name: string; shortName: string }
				awayTeam: { name: string; shortName: string }
				homeScore: number | null
				awayScore: number | null
				kickoffTime: string
				minutes?: number
		  }
	>
): Match[] {
	return fixtures.map(fixture => ({
		id: `next-${'fixtureId' in fixture ? fixture.fixtureId : fixture.id}`,
		homeTeam: {
			name:
				'homeTeamName' in fixture
					? fixture.homeTeamName
					: fixture.homeTeam.name,
			shortName:
				'homeTeamName' in fixture
					? fixture.homeTeamShortName || getTeamShortName(fixture.homeTeamName)
					: fixture.homeTeam.shortName ||
						getTeamShortName(fixture.homeTeam.name),
			score: fixture.homeScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		awayTeam: {
			name:
				'awayTeamName' in fixture
					? fixture.awayTeamName
					: fixture.awayTeam.name,
			shortName:
				'awayTeamName' in fixture
					? fixture.awayTeamShortName || getTeamShortName(fixture.awayTeamName)
					: fixture.awayTeam.shortName ||
						getTeamShortName(fixture.awayTeam.name),
			score: fixture.awayScore ?? 0,
			possession: 0,
			shots: 0,
			shotsOnTarget: 0,
			corners: 0,
			players: []
		},
		status: 'UPCOMING',
		minute: fixture.minutes ?? 0,
		kickoff: fixture.kickoffTime ?? '',
		viewers: 0
	}))
}

export interface LiveMatchesSnapshot {
	matches: Match[]
	snapshot: LiveSnapshotStatus | null
	currentEventId: number | null
	nextEventId: number | null
	windowState?: string
	dataAvailability?: string
	nextRefreshAt?: string | null
}

export interface LiveMatchesLoadOptions {
	/** Browser refreshes use the cacheable revision-aware GET route. */
	preferHttp?: boolean
	revision?: string | null
	signal?: AbortSignal
}

const validEventId = (value: unknown): number | null =>
	typeof value === 'number' && Number.isInteger(value) && value > 0
		? value
		: null

export async function getLiveMatchesSnapshot(
	nextEventId: number | null,
	executor: QueryExecutor = executeQuery,
	currentEventId: number | null = null,
	options: LiveMatchesLoadOptions = {}
): Promise<LiveMatchesSnapshot> {
	let desk: LiveMatchdayDeskResponse
	if (options.preferHttp && currentEventId && options.revision) {
		const params = new URLSearchParams({
			season: String(getCurrentSeasonKey()),
			eventId: String(currentEventId),
			revision: options.revision
		})
		const response = await fetch(`/api/live/matches?${params.toString()}`, {
			cache: 'no-store',
			signal: options.signal
		})
		if (!response.ok)
			throw new Error(`Live matches request failed (${response.status})`)
		desk = (await response.json()) as LiveMatchdayDeskResponse
	} else {
		const variables =
			currentEventId && options.revision
				? {
						ref: {
							season: String(getCurrentSeasonKey()),
							eventId: currentEventId,
							revision: options.revision
						}
					}
				: undefined
		desk = await executor<LiveMatchdayDeskResponse>(
			GET_LIVE_MATCHDAY_DESK,
			variables,
			{ cache: 'no-store' }
		)
	}
	const current = validEventId(desk.liveMatchdayDesk?.eventId) ?? currentEventId
	const snapshot = desk.liveMatchdayDesk
		? {
				eventId: desk.liveMatchdayDesk.eventId,
				revision: desk.liveMatchdayDesk.liveRevision,
				state: desk.liveMatchdayDesk.windowState ?? desk.liveMatchdayDesk.state,
				publishedAt: desk.liveMatchdayDesk.liveRevision
					? desk.liveMatchdayDesk.publishedAt
					: null,
				checkedAt: desk.liveMatchdayDesk.liveRevision
					? (desk.liveMatchdayDesk.sourceCheckedAt ??
						desk.liveMatchdayDesk.publishedAt)
					: null,
				windowState: desk.liveMatchdayDesk.windowState,
				dataAvailability: desk.liveMatchdayDesk.dataAvailability,
				nextRefreshAt: desk.liveMatchdayDesk.nextRefreshAt
			}
		: null
	return {
		matches: [
			...transformLiveMatches(desk.liveMatchdayDesk?.matches ?? []),
			...transformUpcomingFixtures(desk.liveMatchdayDesk?.nextFixtures ?? [])
		],
		snapshot,
		currentEventId: current,
		nextEventId,
		windowState: desk.liveMatchdayDesk?.windowState,
		dataAvailability: desk.liveMatchdayDesk?.dataAvailability,
		nextRefreshAt: desk.liveMatchdayDesk?.nextRefreshAt ?? null
	}
}

export { GET_CURRENT_AND_NEXT_EVENTS }
export type { EventsResponse }
