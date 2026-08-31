import type {
	FixturePlanningFixture,
	FixtureWindowResponse
} from './fixture-window'

export type FixtureWindowSchedule<T> = {
	fixturesByEvent: Map<number, T[]>
	unavailableEventIds: ReadonlySet<number>
	failedWindowCount: number
}

/**
 * Merge full-season window results while preserving partial windows as
 * retryable. A fulfilled response with unknownEventIds is not a complete
 * observation: the provider fallback may have failed only for those events.
 */
export function mergeFixtureWindowSchedules<T>(
	results: readonly PromiseSettledResult<FixtureWindowResponse>[],
	windows: readonly { fromGw: number; count: number }[],
	mapFixtures: (fixtures: FixturePlanningFixture[]) => T[],
	previous: FixtureWindowSchedule<T> | null = null
): FixtureWindowSchedule<T> {
	const fixturesByEvent = new Map(previous?.fixturesByEvent ?? [])
	const unavailableEventIds = new Set(previous?.unavailableEventIds ?? [])
	let failedWindowCount = 0

	results.forEach((result, index) => {
		const window = windows[index]
		if (!window) return
		const eventIds = Array.from(
			{ length: window.count },
			(_, eventIndex) => window.fromGw + eventIndex
		)

		if (result.status === 'rejected') {
			failedWindowCount += 1
			eventIds.forEach(eventId => {
				if (!fixturesByEvent.has(eventId)) unavailableEventIds.add(eventId)
			})
			return
		}

		if (result.value.unknownEventIds.length > 0) {
			failedWindowCount += 1
		}
		eventIds.forEach(eventId => unavailableEventIds.delete(eventId))
		Object.entries(result.value.fixturesByEvent).forEach(
			([rawEventId, fixtures]) => {
				fixturesByEvent.set(Number(rawEventId), mapFixtures(fixtures))
			}
		)
		result.value.unknownEventIds.forEach(eventId => {
			fixturesByEvent.delete(eventId)
			unavailableEventIds.add(eventId)
		})
	})

	return { fixturesByEvent, unavailableEventIds, failedWindowCount }
}
