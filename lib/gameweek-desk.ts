import {
	GET_GAMEWEEK_DESK,
	type GameweekDeskData,
	type GameweekDeskGraphQLResponse
} from '@/lib/graphql/operations/gameweek'

export type {
	GameweekDeskData,
	GameweekDeskGraphQLResponse
} from '@/lib/graphql/operations/gameweek'

export const GAMEWEEK_DESK_MAX_EVENT_ID = 38
export const GAMEWEEK_DESK_PUBLIC_CACHE_CONTROL =
	'public, s-maxage=300, stale-while-revalidate=300, no-transform'
export const GAMEWEEK_DESK_SETTLED_CACHE_CONTROL =
	'public, s-maxage=60, stale-while-revalidate=60, no-transform'
export const GAMEWEEK_DESK_FINAL_CACHE_CONTROL =
	'public, s-maxage=3600, stale-while-revalidate=86400, no-transform'
export const GAMEWEEK_DESK_UNCACHEABLE_CONTROL = 'no-store'

export type GameweekDeskLoadResult = GameweekDeskData & {
	outcome: 'complete' | 'partial' | 'failed'
}

export type GameweekDeskParamsResult =
	{ ok: true; eventId: number } | { ok: false; error: string }

export type GameweekDeskQueryExecutor = (
	query: string,
	variables?: Record<string, number>
) => Promise<GameweekDeskGraphQLResponse>

const POSITIVE_INTEGER = /^[1-9]\d*$/

export function parseGameweekDeskParams(
	searchParams: URLSearchParams
): GameweekDeskParamsResult {
	const values = searchParams.getAll('eventId')
	if (values.length !== 1 || !POSITIVE_INTEGER.test(values[0] ?? '')) {
		return { ok: false, error: 'eventId must be a positive integer' }
	}
	const eventId = Number(values[0])
	if (
		!Number.isSafeInteger(eventId) ||
		eventId < 1 ||
		eventId > GAMEWEEK_DESK_MAX_EVENT_ID
	) {
		return { ok: false, error: 'eventId must be between 1 and 38' }
	}
	return { ok: true, eventId }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value != null && typeof value === 'object' && !Array.isArray(value)

const isNullableString = (value: unknown): value is string | null =>
	value === null || typeof value === 'string'

const isNullableNumber = (value: unknown): value is number | null =>
	value === null || (typeof value === 'number' && Number.isFinite(value))

const isOverviewPlayer = (
	value: unknown
): value is NonNullable<GameweekDeskData['overview']>['mostCaptained'] =>
	value === null ||
	(isRecord(value) &&
		typeof value.id === 'number' &&
		Number.isSafeInteger(value.id) &&
		typeof value.webName === 'string' &&
		isNullableString(value.teamShortName))

const isPlayer = (
	value: unknown
): value is GameweekDeskData['dreamTeam'][number] =>
	isRecord(value) &&
	typeof value.id === 'number' &&
	Number.isSafeInteger(value.id) &&
	typeof value.webName === 'string' &&
	['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'].includes(
		String(value.position)
	) &&
	typeof value.teamShortName === 'string' &&
	typeof value.price === 'number' &&
	Number.isFinite(value.price) &&
	isNullableNumber(value.minutes) &&
	isNullableNumber(value.goalsScored) &&
	isNullableNumber(value.assists) &&
	isNullableNumber(value.cleanSheets) &&
	isNullableNumber(value.bonus) &&
	typeof value.totalPoints === 'number' &&
	Number.isFinite(value.totalPoints)

export function isGameweekDeskData(value: unknown): value is GameweekDeskData {
	if (!isRecord(value)) return false
	if (
		typeof value.season !== 'string' ||
		typeof value.coreRevision !== 'string' ||
		!isNullableString(value.liveRevision) ||
		typeof value.anchorEventId !== 'number' ||
		typeof value.eventId !== 'number' ||
		!Number.isSafeInteger(value.anchorEventId) ||
		!Number.isSafeInteger(value.eventId) ||
		value.eventId < 1 ||
		value.eventId > GAMEWEEK_DESK_MAX_EVENT_ID ||
		!isNullableNumber(value.currentEventId) ||
		!isNullableNumber(value.nextEventId) ||
		typeof value.isPreseason !== 'boolean' ||
		!['SCHEDULED', 'PROVISIONAL', 'SETTLED'].includes(
			String(value.lifecycle)
		) ||
		!isNullableString(value.deadlineTime) ||
		!isNullableString(value.publishedAt) ||
		!['PENDING', 'AVAILABLE', 'UNAVAILABLE'].includes(
			String(value.overviewState)
		) ||
		!['PENDING', 'AVAILABLE', 'UNAVAILABLE'].includes(
			String(value.boardsState)
		) ||
		(value.overview !== null && !isRecord(value.overview)) ||
		!Array.isArray(value.dreamTeam) ||
		!Array.isArray(value.hauls) ||
		!value.dreamTeam.every(isPlayer) ||
		!value.hauls.every(isPlayer)
	) {
		return false
	}
	if (value.overview !== null) {
		const overview = value.overview
		if (
			!isNullableNumber(overview.averagePoints) ||
			!isNullableNumber(overview.highestPoints) ||
			!isOverviewPlayer(overview.mostCaptained) ||
			!isOverviewPlayer(overview.mostViceCaptained) ||
			!isOverviewPlayer(overview.mostSelected) ||
			!isOverviewPlayer(overview.mostTransferredIn) ||
			(overview.chipsPlayed !== null &&
				(!isRecord(overview.chipsPlayed) ||
					!isNullableNumber(overview.chipsPlayed.benchBoost) ||
					!isNullableNumber(overview.chipsPlayed.tripleCaptain) ||
					!isNullableNumber(overview.chipsPlayed.wildcard) ||
					!isNullableNumber(overview.chipsPlayed.freeHit)))
		) {
			return false
		}
	}
	return true
}

function resultOutcome(
	data: GameweekDeskData
): GameweekDeskLoadResult['outcome'] {
	const unavailable = [data.overviewState, data.boardsState].filter(
		state => state === 'UNAVAILABLE'
	).length
	if (unavailable === 0) return 'complete'
	if (unavailable === 2) return 'failed'
	return 'partial'
}

export async function loadGameweekDeskWithExecutor(
	eventId: number | undefined,
	execute: GameweekDeskQueryExecutor
): Promise<GameweekDeskLoadResult> {
	const response = await execute(
		GET_GAMEWEEK_DESK,
		eventId === undefined ? undefined : { eventId }
	)
	if (!isGameweekDeskData(response.gameweekDesk)) {
		throw new TypeError('Gameweek desk response was invalid')
	}
	const data = response.gameweekDesk
	if (eventId !== undefined && data.eventId !== eventId) {
		throw new TypeError('Gameweek desk event ID did not match the request')
	}
	return { ...data, outcome: resultOutcome(data) }
}

export function gameweekDeskResponseFromResult(
	result: GameweekDeskLoadResult
): GameweekDeskData {
	const { outcome: _outcome, ...response } = result
	return response
}

export function gameweekDeskCacheControl(
	data: GameweekDeskData,
	now = Date.now()
): string {
	if (data.overviewState === 'PENDING' || data.boardsState === 'PENDING') {
		return 'public, s-maxage=30, stale-while-revalidate=30, no-transform'
	}
	if (data.lifecycle === 'SETTLED') {
		// A settled desk can precede the canonical live publication. Once its
		// revision is present, the historical response can retain long caching.
		return data.liveRevision === null
			? GAMEWEEK_DESK_SETTLED_CACHE_CONTROL
			: GAMEWEEK_DESK_FINAL_CACHE_CONTROL
	}
	if (data.lifecycle === 'PROVISIONAL') {
		return 'public, s-maxage=10, stale-while-revalidate=20, no-transform'
	}
	const deadline = data.deadlineTime
		? Date.parse(data.deadlineTime)
		: Number.NaN
	const shortWindow =
		Number.isFinite(deadline) && deadline - now <= 30 * 60 * 1000
	return shortWindow
		? 'public, s-maxage=30, stale-while-revalidate=30, no-transform'
		: GAMEWEEK_DESK_PUBLIC_CACHE_CONTROL
}
