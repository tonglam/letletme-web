import type {
	PlayerStatsDeskEntryData,
	PlayerStatsDeskPayloadData,
	PlayerStatsDeskSection,
	PlayerStatsDeskFieldStatus,
	PlayerStatsDeskFieldResult,
	PlayerDetailDataAvailability,
	PlayerDetailData,
	PlayerStateOverviewData,
	PlayerStateProfileCoreData,
	PlayerStateContextData,
	PlayerStateProcessData
} from '@/lib/graphql/operations/players'

export const PLAYER_STATS_DESK_MAX_PLAYERS = 2
export const PLAYER_STATS_DESK_MAX_EVENT_ID = 38
export const PLAYER_STATS_DESK_MAX_HORIZON = 8
// The public route is CDN-cacheable independently of Next's server cache.
// Bump this query version whenever the response shape changes so old edge
// objects cannot satisfy a request for a newer payload contract.
export const PLAYER_STATS_DESK_PUBLIC_CACHE_VERSION = 'v3'

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

const AUTHORITATIVE_DATA_STATES = new Set(['READY', 'EMPTY', 'NOT_APPLICABLE'])

function overviewIsAuthoritative(
	availability: PlayerDetailDataAvailability | null | undefined
): boolean {
	return Boolean(
		availability?.isFullyAuthoritative &&
		[
			availability.seasonStats,
			availability.market,
			availability.historicalTeam,
			availability.fixtures,
			availability.recentGameweeks
		].every(section => section && AUTHORITATIVE_DATA_STATES.has(section.state))
	)
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
			overviewIsAuthoritative(entry.overview?.dataAvailability) &&
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
			entry.state != null &&
			overviewIsAuthoritative(entry.evidence.dataAvailability)
		)
	return (
		(statuses.evidence ??
			(entry.evidence != null ? 'AVAILABLE' : 'NOT_FOUND')) === 'AVAILABLE' &&
		entry.evidence != null &&
		overviewIsAuthoritative(entry.evidence.dataAvailability)
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

export function mergePlayerStatsDeskLoadResults(
	requestedPlayerIds: number[],
	eventId: number,
	horizon: number,
	section: PlayerStatsDeskSection,
	results: PlayerStatsDeskLoadResult[]
): PlayerStatsDeskLoadResult {
	if (
		requestedPlayerIds.length === 0 ||
		requestedPlayerIds.length !== results.length
	) {
		throw new Error('Player Stats desk merge requires one result per player')
	}
	const entriesByPlayerId = new Map(
		results
			.flatMap(result => result.entries)
			.map(entry => [entry.playerId, entry])
	)
	const unavailable = new Set(
		results.flatMap(result => result.unavailablePlayerIds)
	)
	const entries = requestedPlayerIds.map(
		playerId => entriesByPlayerId.get(playerId) ?? { playerId }
	)
	const unavailablePlayerIds = requestedPlayerIds.filter(
		playerId => unavailable.has(playerId) || !entriesByPlayerId.has(playerId)
	)
	const hasAnyData = results.some(
		result => result.outcome === 'complete' || result.outcome === 'partial'
	)
	const allNotFound = results.every(result => result.outcome === 'not-found')
	const allFailed = results.every(result => result.outcome === 'failed')
	return {
		eventId,
		horizon,
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
						: allFailed
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
