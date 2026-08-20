import type {
	PlayerStatsDeskEntryData,
	PlayerStatsDeskPayloadData,
	PlayerStatsDeskSection,
	PlayerStatsDeskFieldStatus,
	PlayerStatsDeskFieldResult,
	PlayerDetailData,
	PlayerStateOverviewData,
	PlayerStateProfileCoreData,
	PlayerStateContextData,
	PlayerStateProcessData
} from '@/lib/graphql/operations/players'

export const PLAYER_STATS_DESK_MAX_PLAYERS = 2
export const PLAYER_STATS_DESK_MAX_EVENT_ID = 38
export const PLAYER_STATS_DESK_MAX_HORIZON = 8

export type PlayerStatsDeskResponse = Omit<
	PlayerStatsDeskPayloadData,
	'entries'
> & {
	section: PlayerStatsDeskSection
	unavailablePlayerIds: number[]
	entries: PlayerStatsDeskNormalizedEntry[]
}

export type PlayerStatsDeskLoadResult = PlayerStatsDeskResponse & {
	outcome: 'complete' | 'partial' | 'failed' | 'not-found'
}

export type PlayerStatsDeskNormalizedEntry = {
	playerId: number
	overview?: PlayerDetailData | null
	state?:
		| PlayerStateOverviewData
		| PlayerStateProfileCoreData
		| PlayerStateContextData
		| PlayerStateProcessData
		| null
	evidence?: Partial<PlayerDetailData> | null
	fieldStatuses?: {
		overview?: PlayerStatsDeskFieldStatus
		state?: PlayerStatsDeskFieldStatus
		evidence?: PlayerStatsDeskFieldStatus
	}
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
	entry: PlayerStatsDeskNormalizedEntry,
	section: PlayerStatsDeskSection
): boolean {
	const statuses = entry.fieldStatuses ?? {}
	if (section === 'overview') {
		return (
			(statuses.overview ??
				(entry.overview != null ? 'AVAILABLE' : 'NOT_FOUND')) === 'AVAILABLE' &&
			(statuses.state ?? (entry.state != null ? 'AVAILABLE' : 'NOT_FOUND')) ===
				'AVAILABLE' &&
			entry.overview != null &&
			entry.state != null
		)
	}
	if (section === 'context')
		return (
			(statuses.state ?? (entry.state != null ? 'AVAILABLE' : 'NOT_FOUND')) ===
				'AVAILABLE' && entry.state != null
		)
	if (section === 'process')
		return (
			(statuses.evidence ??
				(entry.evidence != null ? 'AVAILABLE' : 'NOT_FOUND')) === 'AVAILABLE' &&
			(statuses.state ?? (entry.state != null ? 'AVAILABLE' : 'NOT_FOUND')) ===
				'AVAILABLE' &&
			entry.evidence != null &&
			entry.state != null
		)
	return (
		(statuses.evidence ??
			(entry.evidence != null ? 'AVAILABLE' : 'NOT_FOUND')) === 'AVAILABLE' &&
		entry.evidence != null
	)
}

function entryHasData(
	entry: PlayerStatsDeskNormalizedEntry,
	section: PlayerStatsDeskSection
): boolean {
	const statuses = entry.fieldStatuses ?? {}
	if (section === 'overview') {
		return (
			(statuses.overview ??
				(entry.overview != null ? 'AVAILABLE' : 'NOT_FOUND')) === 'AVAILABLE' ||
			(statuses.state ?? (entry.state != null ? 'AVAILABLE' : 'NOT_FOUND')) ===
				'AVAILABLE'
		)
	}
	if (section === 'context')
		return (
			(statuses.state ?? (entry.state != null ? 'AVAILABLE' : 'NOT_FOUND')) ===
			'AVAILABLE'
		)
	if (section === 'process')
		return (
			(statuses.evidence ??
				(entry.evidence != null ? 'AVAILABLE' : 'NOT_FOUND')) === 'AVAILABLE' ||
			(statuses.state ?? (entry.state != null ? 'AVAILABLE' : 'NOT_FOUND')) ===
				'AVAILABLE'
		)
	return (
		(statuses.evidence ??
			(entry.evidence != null ? 'AVAILABLE' : 'NOT_FOUND')) === 'AVAILABLE'
	)
}

const isFieldResult = <T>(
	value: unknown
): value is PlayerStatsDeskFieldResult<T> =>
	typeof value === 'object' &&
	value !== null &&
	'status' in value &&
	'value' in value

const wrapperValue = <T>(
	wrapper: PlayerStatsDeskFieldResult<T> | T | null | undefined
): T | null => (isFieldResult<T>(wrapper) ? wrapper.value : (wrapper ?? null))

const wrapperStatus = (
	wrapper: PlayerStatsDeskFieldResult<unknown> | unknown | null | undefined
): PlayerStatsDeskFieldStatus | undefined =>
	isFieldResult(wrapper)
		? wrapper.status
		: wrapper == null
			? undefined
			: 'AVAILABLE'

function normalizeEntry(
	entry: PlayerStatsDeskEntryData,
	section: PlayerStatsDeskSection
): PlayerStatsDeskNormalizedEntry {
	const requested = {
		overview: section === 'overview',
		state:
			section === 'overview' || section === 'context' || section === 'process',
		evidence:
			section === 'recent' || section === 'production' || section === 'process'
	}
	return {
		playerId: entry.playerId,
		overview: wrapperValue(entry.overview),
		state: wrapperValue(entry.state),
		evidence: wrapperValue(entry.evidence),
		fieldStatuses: {
			overview: requested.overview
				? (wrapperStatus(entry.overview) ?? 'NOT_FOUND')
				: undefined,
			state: requested.state
				? (wrapperStatus(entry.state) ?? 'NOT_FOUND')
				: undefined,
			evidence: requested.evidence
				? (wrapperStatus(entry.evidence) ?? 'NOT_FOUND')
				: undefined
		}
	}
}

export function normalizePlayerStatsDeskResult(
	payload: PlayerStatsDeskPayloadData,
	requestedPlayerIds: number[],
	section: PlayerStatsDeskSection
): PlayerStatsDeskLoadResult {
	const byPlayerId = new Map(
		payload.entries.map(entry => [entry.playerId, entry])
	)
	const entries = requestedPlayerIds.map(playerId =>
		normalizeEntry(byPlayerId.get(playerId) ?? { playerId }, section)
	)
	const unavailablePlayerIds = entries
		.filter(entry => !entryComplete(entry, section))
		.map(entry => entry.playerId)
	const hasAnyData = entries.some(entry => entryHasData(entry, section))
	const statusesForEntry = (entry: PlayerStatsDeskNormalizedEntry) =>
		entry.fieldStatuses ?? {}
	const requiredStatuses = entries.flatMap(entry => {
		const statuses = statusesForEntry(entry)
		if (section === 'overview') return [statuses.overview, statuses.state]
		if (section === 'context') return [statuses.state]
		if (section === 'process') return [statuses.evidence, statuses.state]
		return [statuses.evidence]
	})
	const allNotFound =
		requiredStatuses.length > 0 &&
		requiredStatuses.every(status => status === 'NOT_FOUND')
	const allTemporarilyUnavailable =
		requiredStatuses.length > 0 &&
		requiredStatuses.every(status => status === 'TEMPORARILY_UNAVAILABLE')
	return {
		eventId: payload.eventId,
		horizon: payload.horizon,
		section,
		entries,
		unavailablePlayerIds,
		outcome:
			unavailablePlayerIds.length === 0
				? 'complete'
				: allNotFound
					? 'not-found'
					: hasAnyData
						? 'partial'
						: allTemporarilyUnavailable
							? 'failed'
							: 'partial'
	}
}

export function playerStatsDeskResponseFromResult(
	result: PlayerStatsDeskLoadResult
): PlayerStatsDeskResponse {
	const { outcome: _outcome, ...response } = result
	return response
}
