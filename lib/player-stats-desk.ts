import type {
	PlayerStatsDeskEntryData,
	PlayerStatsDeskPayloadData,
	PlayerStatsDeskSection
} from '@/lib/graphql/operations/players'

export const PLAYER_STATS_DESK_MAX_PLAYERS = 2
export const PLAYER_STATS_DESK_MAX_EVENT_ID = 38
export const PLAYER_STATS_DESK_MAX_HORIZON = 8

export type PlayerStatsDeskResponse = PlayerStatsDeskPayloadData & {
	section: PlayerStatsDeskSection
	unavailablePlayerIds: number[]
}

export type PlayerStatsDeskLoadResult = PlayerStatsDeskResponse & {
	outcome: 'complete' | 'partial' | 'failed'
}

export type PlayerStatsDeskParamsResult =
	| {
			ok: true
			playerIds: number[]
			eventId: number
			horizon: number
			section: PlayerStatsDeskSection
	  }
	| { ok: false; error: string }

const POSITIVE_INTEGER = /^[1-9]\d*$/
const PLAYER_ID_LIST = /^[1-9]\d*(,[1-9]\d*)?$/
const SECTIONS = new Set<PlayerStatsDeskSection>([
	'overview',
	'context',
	'recent',
	'production',
	'process'
])

export function parsePlayerStatsDeskParams(
	searchParams: URLSearchParams
): PlayerStatsDeskParamsResult {
	const playerIdValues = searchParams.getAll('playerIds')
	const eventValues = searchParams.getAll('eventId')
	const horizonValues = searchParams.getAll('horizon')
	const sectionValues = searchParams.getAll('section')
	if (
		playerIdValues.length !== 1 ||
		eventValues.length !== 1 ||
		horizonValues.length > 1 ||
		sectionValues.length !== 1
	) {
		return { ok: false, error: 'Player stats desk parameters are invalid' }
	}
	const rawPlayerIds = playerIdValues[0] ?? ''
	const rawEventId = eventValues[0] ?? ''
	const rawHorizon = horizonValues[0] ?? '5'
	const rawSection = sectionValues[0] ?? ''
	if (
		!PLAYER_ID_LIST.test(rawPlayerIds) ||
		!POSITIVE_INTEGER.test(rawEventId) ||
		!POSITIVE_INTEGER.test(rawHorizon) ||
		!SECTIONS.has(rawSection as PlayerStatsDeskSection)
	) {
		return { ok: false, error: 'Player stats desk parameters are invalid' }
	}
	const playerIds = rawPlayerIds.split(',').map(Number)
	const eventId = Number(rawEventId)
	const horizon = Number(rawHorizon)
	if (
		playerIds.length < 1 ||
		playerIds.length > PLAYER_STATS_DESK_MAX_PLAYERS ||
		new Set(playerIds).size !== playerIds.length ||
		eventId < 1 ||
		eventId > PLAYER_STATS_DESK_MAX_EVENT_ID ||
		horizon < 1 ||
		horizon > PLAYER_STATS_DESK_MAX_HORIZON
	) {
		return { ok: false, error: 'Player stats desk parameters are out of range' }
	}
	return {
		ok: true,
		playerIds,
		eventId,
		horizon,
		section: rawSection as PlayerStatsDeskSection
	}
}

function entryComplete(
	entry: PlayerStatsDeskEntryData,
	section: PlayerStatsDeskSection
): boolean {
	if (section === 'overview') {
		return entry.overview != null && entry.state != null
	}
	if (section === 'context') return entry.state != null
	if (section === 'process')
		return entry.evidence != null && entry.state != null
	return entry.evidence != null
}

function entryHasData(
	entry: PlayerStatsDeskEntryData,
	section: PlayerStatsDeskSection
): boolean {
	if (section === 'overview') {
		return entry.overview != null || entry.state != null
	}
	if (section === 'context') return entry.state != null
	if (section === 'process')
		return entry.evidence != null || entry.state != null
	return entry.evidence != null
}

export function normalizePlayerStatsDeskResult(
	payload: PlayerStatsDeskPayloadData,
	requestedPlayerIds: number[],
	section: PlayerStatsDeskSection
): PlayerStatsDeskLoadResult {
	const byPlayerId = new Map(
		payload.entries.map(entry => [entry.playerId, entry])
	)
	const entries = requestedPlayerIds.map(
		playerId => byPlayerId.get(playerId) ?? { playerId }
	)
	const unavailablePlayerIds = entries
		.filter(entry => !entryComplete(entry, section))
		.map(entry => entry.playerId)
	const hasAnyData = entries.some(entry => entryHasData(entry, section))
	return {
		eventId: payload.eventId,
		horizon: payload.horizon,
		section,
		entries,
		unavailablePlayerIds,
		outcome:
			unavailablePlayerIds.length === 0
				? 'complete'
				: hasAnyData
					? 'partial'
					: 'failed'
	}
}

export function playerStatsDeskResponseFromResult(
	result: PlayerStatsDeskLoadResult
): PlayerStatsDeskResponse {
	const { outcome: _outcome, ...response } = result
	return response
}
