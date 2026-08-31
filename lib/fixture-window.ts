export const FIXTURE_WINDOW_MAX_EVENT_ID = 38
export const FIXTURE_WINDOW_MAX_COUNT = 5

export type FixturePlanningTeam = {
	id: number
	name: string
	shortName: string
}

export type FixturePlanningFixture = {
	id: number
	eventId: number
	finished: boolean
	/** Optional for backwards compatibility with already cached windows. */
	started?: boolean
	homeTeam: FixturePlanningTeam
	awayTeam: FixturePlanningTeam
	/** Null when the fixture has not produced a score yet. */
	homeScore?: number | null
	awayScore?: number | null
	homeTeamDifficulty: number
	awayTeamDifficulty: number
}

export type FixtureWindowResponse = {
	fromGw: number
	toGw: number
	fixturesByEvent: Record<string, FixturePlanningFixture[]>
	unknownEventIds: number[]
}

export type FixtureWindowLoadResult = FixtureWindowResponse & {
	outcome: 'complete' | 'partial' | 'failed'
	path: 'batch' | 'fallback'
}

export type FixtureWindowQueryExecutor = (
	query: string,
	variables: Record<string, number>
) => Promise<unknown>

export type FixtureWindowParamsResult =
	{ ok: true; fromGw: number; count: number } | { ok: false; error: string }

export type FixtureWindowReadyRating = 'good' | 'needs-improvement' | 'poor'

export function rateFixtureWindowReady(
	durationMs: number
): FixtureWindowReadyRating {
	if (durationMs <= 1_000) return 'good'
	if (durationMs <= 1_500) return 'needs-improvement'
	return 'poor'
}

const POSITIVE_INTEGER = /^[1-9]\d*$/

export function parseFixtureWindowParams(
	searchParams: URLSearchParams
): FixtureWindowParamsResult {
	const fromValues = searchParams.getAll('fromGw')
	const countValues = searchParams.getAll('count')
	if (fromValues.length !== 1 || countValues.length !== 1) {
		return { ok: false, error: 'fromGw and count are required once' }
	}

	const [rawFromGw] = fromValues
	const [rawCount] = countValues
	if (
		rawFromGw == null ||
		rawCount == null ||
		!POSITIVE_INTEGER.test(rawFromGw) ||
		!POSITIVE_INTEGER.test(rawCount)
	) {
		return { ok: false, error: 'fromGw and count must be positive integers' }
	}

	const fromGw = Number(rawFromGw)
	const count = Number(rawCount)
	if (fromGw < 1 || fromGw > FIXTURE_WINDOW_MAX_EVENT_ID) {
		return { ok: false, error: 'fromGw must be between 1 and 38' }
	}
	if (count < 1 || count > FIXTURE_WINDOW_MAX_COUNT) {
		return { ok: false, error: 'count must be between 1 and 5' }
	}
	if (fromGw + count - 1 > FIXTURE_WINDOW_MAX_EVENT_ID) {
		return { ok: false, error: 'fixture window must end by GW38' }
	}

	return { ok: true, fromGw, count }
}

function assertFixtureWindowInput(fromGw: number, count: number): void {
	if (
		!Number.isInteger(fromGw) ||
		!Number.isInteger(count) ||
		fromGw < 1 ||
		fromGw > FIXTURE_WINDOW_MAX_EVENT_ID ||
		count < 1 ||
		count > FIXTURE_WINDOW_MAX_COUNT ||
		fromGw + count - 1 > FIXTURE_WINDOW_MAX_EVENT_ID
	) {
		throw new RangeError(
			'Fixture window must be 1-5 consecutive GWs within 1-38'
		)
	}
}

export function fixtureWindowEventIds(fromGw: number, count: number): number[] {
	assertFixtureWindowInput(fromGw, count)
	return Array.from({ length: count }, (_, index) => fromGw + index)
}

export type FixtureWindowRange = {
	fromGw: number
	count: number
}

/**
 * Split a sparse set of missing gameweeks into valid consecutive API windows.
 * The route accepts at most five consecutive gameweeks per request; keeping
 * gaps out of each range prevents a successful response from being mistaken
 * for coverage of an event that was never requested.
 */
export function buildFixtureWindowRanges(
	eventIds: readonly number[]
): FixtureWindowRange[] {
	const uniqueEventIds = Array.from(new Set(eventIds)).sort((a, b) => a - b)
	if (
		uniqueEventIds.some(
			eventId =>
				!Number.isInteger(eventId) ||
				eventId < 1 ||
				eventId > FIXTURE_WINDOW_MAX_EVENT_ID
		)
	) {
		throw new RangeError('Fixture event IDs must be integers within 1-38')
	}
	if (uniqueEventIds.length === 0) return []

	const ranges: FixtureWindowRange[] = []
	let rangeFromGw = uniqueEventIds[0]!
	let count = 1
	for (const eventId of uniqueEventIds.slice(1)) {
		if (eventId === rangeFromGw + count && count < FIXTURE_WINDOW_MAX_COUNT) {
			count += 1
			continue
		}
		ranges.push({ fromGw: rangeFromGw, count })
		rangeFromGw = eventId
		count = 1
	}
	ranges.push({ fromGw: rangeFromGw, count })
	return ranges
}

export function buildFixtureWindowQuery(count: number): string {
	assertFixtureWindowInput(1, count)
	const variables = Array.from(
		{ length: count },
		(_, index) => `$event${index}: Int!`
	).join(', ')
	const aliases = Array.from(
		{ length: count },
		(_, index) =>
			`event${index}: eventFixtures(eventId: $event${index}) { ...FixturePlanningFields }`
	).join('\n    ')

	return /* GraphQL */ `
  query GetFixtureWindow(${variables}) {
    ${aliases}
  }

  fragment FixturePlanningFields on Fixture {
    id
    finished
    started
    homeTeam {
      id
      name
      shortName
    }
    awayTeam {
      id
      name
      shortName
    }
    homeScore
    awayScore
    homeTeamDifficulty
    awayTeamDifficulty
  }
`
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value)
}

function readPlanningTeam(value: unknown): FixturePlanningTeam {
	if (!isRecord(value)) throw new TypeError('Fixture team was not an object')
	const { id, name, shortName } = value
	if (
		typeof id !== 'number' ||
		!Number.isInteger(id) ||
		typeof name !== 'string' ||
		typeof shortName !== 'string'
	) {
		throw new TypeError('Fixture team fields were invalid')
	}
	return { id, name, shortName }
}

export function mapFixturePlanningFixture(
	value: unknown,
	eventId: number
): FixturePlanningFixture {
	if (!isRecord(value)) throw new TypeError('Fixture was not an object')
	const {
		id,
		finished,
		started,
		homeTeam,
		awayTeam,
		homeScore,
		awayScore,
		homeTeamDifficulty,
		awayTeamDifficulty
	} = value
	if (
		typeof id !== 'number' ||
		!Number.isInteger(id) ||
		typeof finished !== 'boolean' ||
		typeof homeTeamDifficulty !== 'number' ||
		!Number.isFinite(homeTeamDifficulty) ||
		typeof awayTeamDifficulty !== 'number' ||
		!Number.isFinite(awayTeamDifficulty) ||
		(started !== undefined && typeof started !== 'boolean') ||
		!isNullableScore(homeScore) ||
		!isNullableScore(awayScore)
	) {
		throw new TypeError('Fixture planning fields were invalid')
	}

	return {
		id,
		eventId,
		finished,
		started: started ?? finished,
		homeTeam: readPlanningTeam(homeTeam),
		awayTeam: readPlanningTeam(awayTeam),
		homeScore: homeScore ?? null,
		awayScore: awayScore ?? null,
		homeTeamDifficulty,
		awayTeamDifficulty
	}
}

function isNullableScore(value: unknown): value is number | null | undefined {
	return (
		value === undefined ||
		value === null ||
		(typeof value === 'number' && Number.isFinite(value) && value >= 0)
	)
}

function readAliasFixtures(
	response: unknown,
	alias: string,
	eventId: number
): FixturePlanningFixture[] {
	if (!isRecord(response))
		throw new TypeError('Fixture window response was invalid')
	const fixtures = response[alias]
	if (!Array.isArray(fixtures)) {
		throw new TypeError(`Fixture window alias ${alias} was unavailable`)
	}
	return fixtures.map(fixture => mapFixturePlanningFixture(fixture, eventId))
}

function variablesForEventIds(eventIds: number[]): Record<string, number> {
	return Object.fromEntries(
		eventIds.map((eventId, index) => [`event${index}`, eventId])
	)
}

export async function loadFixtureWindowWithExecutor(
	fromGw: number,
	count: number,
	execute: FixtureWindowQueryExecutor
): Promise<FixtureWindowLoadResult> {
	const eventIds = fixtureWindowEventIds(fromGw, count)
	const toGw = eventIds[eventIds.length - 1]!
	const fixturesByEvent: Record<string, FixturePlanningFixture[]> = {}

	try {
		const response = await execute(
			buildFixtureWindowQuery(count),
			variablesForEventIds(eventIds)
		)
		eventIds.forEach((eventId, index) => {
			fixturesByEvent[String(eventId)] = readAliasFixtures(
				response,
				`event${index}`,
				eventId
			)
		})
		return {
			fromGw,
			toGw,
			fixturesByEvent,
			unknownEventIds: [],
			outcome: 'complete',
			path: 'batch'
		}
	} catch {
		const results = await Promise.allSettled(
			eventIds.map(async eventId => {
				const response = await execute(buildFixtureWindowQuery(1), {
					event0: eventId
				})
				return [
					eventId,
					readAliasFixtures(response, 'event0', eventId)
				] as const
			})
		)
		const unknownEventIds: number[] = []
		results.forEach((result, index) => {
			const eventId = eventIds[index]!
			if (result.status === 'fulfilled') {
				fixturesByEvent[String(eventId)] = result.value[1]
			} else {
				unknownEventIds.push(eventId)
			}
		})

		return {
			fromGw,
			toGw,
			fixturesByEvent,
			unknownEventIds,
			outcome:
				unknownEventIds.length === eventIds.length ? 'failed' : 'partial',
			path: 'fallback'
		}
	}
}

export function fixtureWindowResponseFromResult(
	result: FixtureWindowLoadResult
): FixtureWindowResponse {
	return {
		fromGw: result.fromGw,
		toGw: result.toGw,
		fixturesByEvent: result.fixturesByEvent,
		unknownEventIds: result.unknownEventIds
	}
}

function isPlanningTeam(value: unknown): value is FixturePlanningTeam {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		Number.isInteger(value.id) &&
		typeof value.name === 'string' &&
		typeof value.shortName === 'string'
	)
}

function isPlanningFixture(
	value: unknown,
	eventId: number
): value is FixturePlanningFixture {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		Number.isInteger(value.id) &&
		value.eventId === eventId &&
		typeof value.finished === 'boolean' &&
		(value.started === undefined || typeof value.started === 'boolean') &&
		isNullableScore(value.homeScore) &&
		isNullableScore(value.awayScore) &&
		isPlanningTeam(value.homeTeam) &&
		isPlanningTeam(value.awayTeam) &&
		typeof value.homeTeamDifficulty === 'number' &&
		Number.isFinite(value.homeTeamDifficulty) &&
		typeof value.awayTeamDifficulty === 'number' &&
		Number.isFinite(value.awayTeamDifficulty)
	)
}

export function isFixtureWindowResponse(
	value: unknown
): value is FixtureWindowResponse {
	if (!isRecord(value)) return false
	const { fromGw, toGw, fixturesByEvent, unknownEventIds } = value
	if (
		typeof fromGw !== 'number' ||
		!Number.isInteger(fromGw) ||
		typeof toGw !== 'number' ||
		!Number.isInteger(toGw) ||
		fromGw < 1 ||
		toGw < fromGw ||
		toGw > FIXTURE_WINDOW_MAX_EVENT_ID ||
		toGw - fromGw + 1 > FIXTURE_WINDOW_MAX_COUNT ||
		!isRecord(fixturesByEvent) ||
		!Array.isArray(unknownEventIds)
	) {
		return false
	}

	if (
		!unknownEventIds.every(
			eventId =>
				typeof eventId === 'number' &&
				Number.isInteger(eventId) &&
				eventId >= fromGw &&
				eventId <= toGw
		)
	) {
		return false
	}
	if (new Set(unknownEventIds).size !== unknownEventIds.length) return false

	const fixtureEventIds: number[] = []
	const fixturesAreValid = Object.entries(fixturesByEvent).every(
		([rawEventId, fixtures]) => {
			const eventId = Number(rawEventId)
			const valid =
				String(eventId) === rawEventId &&
				Number.isInteger(eventId) &&
				eventId >= fromGw &&
				eventId <= toGw &&
				Array.isArray(fixtures) &&
				fixtures.every(fixture => isPlanningFixture(fixture, eventId))
			if (valid) fixtureEventIds.push(eventId)
			return valid
		}
	)
	if (!fixturesAreValid) return false
	if (fixtureEventIds.some(eventId => unknownEventIds.includes(eventId)))
		return false

	const coveredEventIds = new Set([...fixtureEventIds, ...unknownEventIds])
	if (coveredEventIds.size !== toGw - fromGw + 1) return false
	return Array.from(
		{ length: toGw - fromGw + 1 },
		(_, index) => fromGw + index
	).every(eventId => coveredEventIds.has(eventId))
}
