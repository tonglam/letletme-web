import { recordBugReportDiagnostic } from '@/lib/bug-report-diagnostics'
import type {
	EntryLiveCompetitionBoardPage,
	EntryLiveCompetitionBoardRow,
	EntryLiveCompetitionOwnershipFilter,
	EntryLiveCompetitionTeamCountRule,
	EntryLiveCompetitionBoardVariables
} from '@/lib/graphql/operations/tournaments'
import type { TournamentEntry } from '@/types/tournament'

export const LIVE_BOARD_CONTRACT_VERSION = 'entry-live-board-v2'
export const LIVE_BOARD_PAGE_SIZE = 20
const LIVE_BOARD_OPERATION = 'GetEntryLiveCompetitionBoard'
const TRANSIENT_STATUSES = new Set([502, 503, 504])

export type LiveBoardFilterState = {
	chips: string[]
	captainPlayerIds: number[]
	ownership: EntryLiveCompetitionOwnershipFilter | null
	teamCountRules: EntryLiveCompetitionTeamCountRule[]
}

export const EMPTY_LIVE_BOARD_FILTERS: LiveBoardFilterState = {
	chips: [],
	captainPlayerIds: [],
	ownership: null,
	teamCountRules: []
}

type LastGoodScope = {
	sessionKey: string
	season: string
	eventId: number
	entryId: number
	tournamentId: number
}

type StoredLastGood = {
	contractVersion: typeof LIVE_BOARD_CONTRACT_VERSION
	savedAt: string
	page: EntryLiveCompetitionBoardPage
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const isInteger = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value)

const isNonNegativeInteger = (value: unknown): value is number =>
	isInteger(value) && value >= 0

const isNullableString = (value: unknown): value is string | null =>
	value === null || typeof value === 'string'

const isNullableNumber = (value: unknown): value is number | null =>
	value === null || (typeof value === 'number' && Number.isFinite(value))

const isNullableInteger = (value: unknown): value is number | null =>
	value === null || isInteger(value)

const validDate = (value: unknown): value is string | null =>
	value === null ||
	(typeof value === 'string' && Number.isFinite(Date.parse(value)))

const nonEmptyString = (value: unknown): value is string =>
	typeof value === 'string' && value.trim().length > 0

const isStringArray = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every(item => typeof item === 'string')

export class LiveBoardInvalidResponseError extends Error {
	readonly code = 'LIVE_BOARD_INVALID_RESPONSE'
	readonly missingFields: string[]

	constructor(missingFields: string[]) {
		super('The live competition response did not match the expected contract.')
		this.name = 'LiveBoardInvalidResponseError'
		this.missingFields = missingFields
	}
}

export class LiveBoardRequestError extends Error {
	readonly status: number
	readonly code: string
	readonly retryAfterSeconds: number | null
	readonly requestId: string | null

	constructor(options: {
		status: number
		code: string
		retryAfterSeconds?: number | null
		requestId?: string | null
	}) {
		super(options.code)
		this.name = 'LiveBoardRequestError'
		this.status = options.status
		this.code = options.code
		this.retryAfterSeconds = options.retryAfterSeconds ?? null
		this.requestId = options.requestId ?? null
	}
}

const parseRetryAfter = (value: string | null): number | null => {
	if (!value) return null
	const seconds = Number(value)
	if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)
	const at = Date.parse(value)
	return Number.isFinite(at)
		? Math.max(0, Math.ceil((at - Date.now()) / 1_000))
		: null
}

const validateScore = (
	value: unknown,
	path: string,
	missing: string[]
): void => {
	if (!isRecord(value)) {
		missing.push(path)
		return
	}
	if (!isInteger(value.eventPoints)) missing.push(`${path}.eventPoints`)
	if (!isInteger(value.netEventPoints)) missing.push(`${path}.netEventPoints`)
	if (!isNullableNumber(value.totalPoints)) missing.push(`${path}.totalPoints`)
	if (value.totalScope !== 'OVERALL' && value.totalScope !== 'UNKNOWN')
		missing.push(`${path}.totalScope`)
	if (!isNonNegativeInteger(value.transferCost))
		missing.push(`${path}.transferCost`)
	if (
		value.source !== 'FPL_EVENT_LIVE' &&
		value.source !== 'FPL_FINAL_RESULT' &&
		value.source !== 'UNAVAILABLE'
	)
		missing.push(`${path}.source`)
	if (
		value.calculationMode !== 'PROJECTED_AUTOSUBS' &&
		value.calculationMode !== 'FINAL_RESULT'
	)
		missing.push(`${path}.calculationMode`)

	if (!isRecord(value.revisions)) {
		missing.push(`${path}.revisions`)
	} else {
		for (const field of [
			'publicationId',
			'lifecycle',
			'fixtureIdentity',
			'scoreCore',
			'displayStats',
			'explain',
			'rules',
			'algorithm',
			'input'
		]) {
			if (!nonEmptyString(value.revisions[field]))
				missing.push(`${path}.revisions.${field}`)
		}
		if (!isNonNegativeInteger(value.revisions.generation))
			missing.push(`${path}.revisions.generation`)
		for (const field of [
			'picksBase',
			'officialAdjustment',
			'previousTotals',
			'finalResult'
		]) {
			if (!isNullableString(value.revisions[field]))
				missing.push(`${path}.revisions.${field}`)
		}
	}

	if (!isRecord(value.times)) {
		missing.push(`${path}.times`)
	} else {
		for (const field of [
			'sourceCheckedAt',
			'contentUpdatedAt',
			'publishedAt',
			'servedAt',
			'staleAt'
		]) {
			if (!validDate(value.times[field]) || value.times[field] === null)
				missing.push(`${path}.times.${field}`)
		}
		for (const field of ['checkpointedAt', 'nextRefreshAt']) {
			if (!validDate(value.times[field])) missing.push(`${path}.times.${field}`)
		}
	}

	if (!isRecord(value.delivery)) {
		missing.push(`${path}.delivery`)
	} else {
		if (
			!['FRESH', 'STALE', 'DEGRADED', 'FINAL', 'UNAVAILABLE'].includes(
				String(value.delivery.state)
			)
		)
			missing.push(`${path}.delivery.state`)
		if (
			![
				'REDIS_CURRENT',
				'REDIS_PREVIOUS',
				'PROCESS_LKG',
				'POSTGRES_CHECKPOINT',
				'FINAL_RESULT',
				'UNAVAILABLE'
			].includes(String(value.delivery.servedFrom))
		)
			missing.push(`${path}.delivery.servedFrom`)
		if (!isStringArray(value.delivery.reasonCodes))
			missing.push(`${path}.delivery.reasonCodes`)
	}
}

const validateRow = (
	value: unknown,
	path: string,
	missing: string[]
): value is EntryLiveCompetitionBoardRow => {
	if (!isRecord(value)) {
		missing.push(path)
		return false
	}
	for (const field of [
		'entry',
		'rank',
		'transferCost',
		'played',
		'toPlay',
		'captainId',
		'captainPoints'
	]) {
		if (!isInteger(value[field])) missing.push(`${path}.${field}`)
	}
	if (!isNullableInteger(value.overallRank)) missing.push(`${path}.overallRank`)
	if (typeof value.teamValue !== 'number' || !Number.isFinite(value.teamValue))
		missing.push(`${path}.teamValue`)
	for (const field of ['entryName', 'playerName', 'chip', 'captainName']) {
		if (typeof value[field] !== 'string') missing.push(`${path}.${field}`)
	}
	validateScore(value.score, `${path}.score`, missing)
	return true
}

export function parseEntryLiveCompetitionBoardPage(
	value: unknown
): EntryLiveCompetitionBoardPage {
	const root =
		isRecord(value) && 'entryLiveCompetitionBoard' in value
			? value.entryLiveCompetitionBoard
			: value
	const missing: string[] = []
	if (!isRecord(root))
		throw new LiveBoardInvalidResponseError(['entryLiveCompetitionBoard'])

	for (const field of [
		'eventId',
		'tournamentId',
		'totalEntries',
		'filteredEntries',
		'page',
		'pageSize'
	]) {
		if (!isInteger(root[field])) missing.push(field)
	}
	for (const field of ['season', 'boardRevision', 'dataAvailability']) {
		if (typeof root[field] !== 'string' || root[field].length === 0)
			missing.push(field)
	}
	if (!isNullableString(root.scoreCoreRevision))
		missing.push('scoreCoreRevision')
	for (const field of ['revisions', 'times', 'delivery']) {
		if (!isRecord(root[field])) missing.push(field)
	}
	if (
		root.coverageState !== 'WARMING' &&
		root.coverageState !== 'COMPLETE' &&
		root.coverageState !== 'PARTIAL' &&
		root.coverageState !== 'UNAVAILABLE'
	)
		missing.push('coverageState')
	if (root.rankScope !== 'FULL_FIELD' && root.rankScope !== 'AVAILABLE_ROWS')
		missing.push('rankScope')
	for (const field of [
		'computedEntries',
		'deferredEntryCount',
		'failedEntryCount',
		'unavailableEntryCount'
	]) {
		if (!isNonNegativeInteger(root[field])) missing.push(field)
	}
	for (const field of ['partial', 'hasMore']) {
		if (typeof root[field] !== 'boolean') missing.push(field)
	}
	if (isRecord(root.times)) {
		for (const field of [
			'sourceCheckedAt',
			'contentUpdatedAt',
			'publishedAt',
			'servedAt',
			'staleAt'
		]) {
			if (!validDate(root.times[field]) || root.times[field] === null)
				missing.push(`times.${field}`)
		}
		for (const field of ['checkpointedAt', 'nextRefreshAt']) {
			if (!validDate(root.times[field])) missing.push(`times.${field}`)
		}
	}
	if (isRecord(root.delivery)) {
		if (
			!['FRESH', 'STALE', 'DEGRADED', 'FINAL', 'UNAVAILABLE'].includes(
				String(root.delivery.state)
			)
		)
			missing.push('delivery.state')
		if (
			![
				'REDIS_CURRENT',
				'REDIS_PREVIOUS',
				'PROCESS_LKG',
				'POSTGRES_CHECKPOINT',
				'FINAL_RESULT',
				'UNAVAILABLE'
			].includes(String(root.delivery.servedFrom))
		)
			missing.push('delivery.servedFrom')
		if (!isStringArray(root.delivery.reasonCodes))
			missing.push('delivery.reasonCodes')
	}
	if (isRecord(root.revisions)) {
		for (const field of [
			'publicationId',
			'lifecycle',
			'fixtureIdentity',
			'scoreCore',
			'displayStats',
			'explain',
			'rules',
			'algorithm',
			'input'
		]) {
			if (!nonEmptyString(root.revisions[field]))
				missing.push(`revisions.${field}`)
		}
		if (!isNonNegativeInteger(root.revisions.generation))
			missing.push('revisions.generation')
		for (const field of [
			'picksBase',
			'officialAdjustment',
			'previousTotals',
			'finalResult'
		]) {
			if (!isNullableString(root.revisions[field]))
				missing.push(`revisions.${field}`)
		}
	}
	if (
		typeof root.officialCoverage !== 'number' ||
		!Number.isFinite(root.officialCoverage) ||
		root.officialCoverage < 0 ||
		root.officialCoverage > 1
	) {
		missing.push('officialCoverage')
	}
	if (!isNullableNumber(root.highestEventPoints))
		missing.push('highestEventPoints')
	if (!isNullableNumber(root.averageEventPoints))
		missing.push('averageEventPoints')
	for (const field of ['unavailableEntryIds', 'failedEntryIds']) {
		if (!Array.isArray(root[field]) || !root[field].every(isInteger))
			missing.push(field)
	}
	if (!Array.isArray(root.rows)) missing.push('rows')
	else
		root.rows.forEach((row, index) =>
			validateRow(row, `rows[${index}]`, missing)
		)
	if (root.viewerRow !== null) validateRow(root.viewerRow, 'viewerRow', missing)

	if (missing.length > 0) throw new LiveBoardInvalidResponseError(missing)
	return root as unknown as EntryLiveCompetitionBoardPage
}

export const isCurrentLiveBoardRequest = (
	requestVersion: number,
	currentVersion: number,
	expectedScope: string,
	activeScope: string | null
): boolean => requestVersion === currentVersion && expectedScope === activeScope

export const shouldAutoRefreshLiveBoardPage = (page: number | null): boolean =>
	page === 1

export const canLoadMoreLiveBoard = (input: {
	hasMore: boolean
	isLoadingMore: boolean
	replacementPending: boolean
	rateLimited: boolean
}): boolean =>
	input.hasMore &&
	!input.isLoadingMore &&
	!input.replacementPending &&
	!input.rateLimited

export const canStartLiveBoardRefresh = (input: {
	replacementPending: boolean
	refreshPending: boolean
}): boolean => !input.replacementPending && !input.refreshPending

export type LiveBoardFreshnessMarker = {
	eventId: number
	scoreCoreRevision: string | null
}

export const liveBoardPublicationChanged = (
	accepted: LiveBoardFreshnessMarker | null,
	observed: LiveBoardFreshnessMarker | null
): boolean =>
	!observed ||
	!accepted ||
	accepted.eventId !== observed.eventId ||
	(accepted.scoreCoreRevision !== observed.scoreCoreRevision &&
		observed.scoreCoreRevision !== null)

export const shouldSyncLiveBoardSearchInput = (
	requestedInput: string,
	currentInput: string
): boolean => requestedInput === currentInput

export const isLiveBoardRevisionGoneCode = (code: string): boolean =>
	code === 'LIVE_SCORE_REVISION_GONE'

export const resolveAnchoredGameweek = (input: {
	nextEvent: number
	requestedGameweek: number | null
	followsAnchor: boolean
}): { selectedGameweek: number; followsAnchor: boolean } => {
	if (!input.followsAnchor) {
		return { selectedGameweek: input.nextEvent, followsAnchor: false }
	}
	if (
		input.requestedGameweek !== null &&
		input.requestedGameweek <= input.nextEvent
	) {
		return {
			selectedGameweek: input.requestedGameweek,
			followsAnchor: false
		}
	}
	return { selectedGameweek: input.nextEvent, followsAnchor: true }
}

export const resolveUrlGameweekSelection = (input: {
	currentEvent: number
	requestedGameweek: number | null
}): { selectedGameweek: number; followsAnchor: boolean } =>
	resolveAnchoredGameweek({
		nextEvent: input.currentEvent,
		requestedGameweek: input.requestedGameweek,
		followsAnchor: true
	})

const scopePart = (value: string | number): string =>
	encodeURIComponent(String(value).trim())

export const liveBoardLastGoodKey = (scope: LastGoodScope): string =>
	[
		'letletme:live-board:last-good',
		LIVE_BOARD_CONTRACT_VERSION,
		scopePart(scope.sessionKey),
		scopePart(scope.season),
		scope.eventId,
		scope.entryId,
		scope.tournamentId
	].join(':')

const liveBoardHasUsableLastGoodRows = (
	page: EntryLiveCompetitionBoardPage
): boolean => {
	const visibleRows = page.viewerRow
		? [...page.rows, page.viewerRow]
		: page.rows
	if (page.dataAvailability === 'UNAVAILABLE') return false
	if (page.delivery.state === 'UNAVAILABLE' || page.officialCoverage <= 0)
		return false
	return visibleRows.some(
		row =>
			row.score.source !== 'UNAVAILABLE' &&
			typeof row.score.eventPoints === 'number'
	)
}

export const readLiveBoardLastGood = (
	storage: Storage | null,
	scope: LastGoodScope
): EntryLiveCompetitionBoardPage | null => {
	if (!storage || !scope.sessionKey) return null
	try {
		const raw = storage.getItem(liveBoardLastGoodKey(scope))
		if (!raw) return null
		const parsed = JSON.parse(raw) as unknown
		if (
			!isRecord(parsed) ||
			parsed.contractVersion !== LIVE_BOARD_CONTRACT_VERSION
		)
			return null
		const page = parseEntryLiveCompetitionBoardPage(parsed.page)
		if (
			page.season !== scope.season ||
			page.eventId !== scope.eventId ||
			page.tournamentId !== scope.tournamentId ||
			page.page !== 1
		) {
			return null
		}
		if (!liveBoardHasUsableLastGoodRows(page)) {
			storage.removeItem(liveBoardLastGoodKey(scope))
			return null
		}
		return page
	} catch {
		return null
	}
}

export const writeLiveBoardLastGood = (
	storage: Storage | null,
	scope: LastGoodScope,
	page: EntryLiveCompetitionBoardPage
): void => {
	if (!storage || !scope.sessionKey || page.page !== 1) return
	if (!liveBoardHasUsableLastGoodRows(page)) return
	if (
		page.season !== scope.season ||
		page.eventId !== scope.eventId ||
		page.tournamentId !== scope.tournamentId
	) {
		return
	}
	try {
		const value: StoredLastGood = {
			contractVersion: LIVE_BOARD_CONTRACT_VERSION,
			savedAt: new Date().toISOString(),
			page
		}
		storage.setItem(liveBoardLastGoodKey(scope), JSON.stringify(value))
	} catch {
		// Storage is an optional acceleration layer.
	}
}

export const clearOtherLiveBoardLastGood = (
	storage: Storage | null,
	keepKey: string
): void => {
	if (!storage) return
	try {
		const prefix = `letletme:live-board:last-good:${LIVE_BOARD_CONTRACT_VERSION}:`
		const remove: string[] = []
		for (let index = 0; index < storage.length; index += 1) {
			const key = storage.key(index)
			if (key?.startsWith(prefix) && key !== keepKey) remove.push(key)
		}
		remove.forEach(key => storage.removeItem(key))
	} catch {
		// Ignore unavailable/blocked storage.
	}
}

export const clearAllLiveBoardLastGood = (storage?: Storage | null): void => {
	let resolved = storage
	if (resolved === undefined && typeof window !== 'undefined') {
		try {
			resolved = window.localStorage
		} catch {
			resolved = null
		}
	}
	if (!resolved) return
	try {
		const prefix = `letletme:live-board:last-good:${LIVE_BOARD_CONTRACT_VERSION}:`
		const remove: string[] = []
		for (let index = 0; index < resolved.length; index += 1) {
			const key = resolved.key(index)
			if (key?.startsWith(prefix)) remove.push(key)
		}
		remove.forEach(key => resolved?.removeItem(key))
	} catch {
		// Logout must continue if storage is unavailable.
	}
}

const chipFlags = (chip: string) => ({
	bench: chip === 'BENCH_BOOST',
	triple: chip === 'TRIPLE_CAPTAIN',
	wildcard: chip === 'WILDCARD',
	freeHit: chip === 'FREE_HIT'
})

export const boardRowToTournamentEntry = (
	row: EntryLiveCompetitionBoardRow
): TournamentEntry => ({
	id: String(row.entry),
	rank: row.rank,
	teamName: row.entryName,
	managerName: row.playerName,
	captainName: row.captainName || 'N/A',
	captainTeam: 'N/A',
	captainPoints: row.captainPoints,
	gwPoints: row.score.eventPoints,
	gwNetPoints: row.score.netEventPoints,
	eventCost: row.score.transferCost,
	overallRank: row.overallRank ?? undefined,
	livePoints: row.score.eventPoints,
	totalPoints:
		row.score.totalScope === 'OVERALL' ? row.score.totalPoints : null,
	playersPlayed: row.played,
	playersToPlay: row.toPlay,
	teamValue: row.teamValue,
	picks: [],
	chips: chipFlags(row.chip),
	stale:
		row.score.delivery.state === 'STALE' ||
		row.score.delivery.state === 'DEGRADED'
})

const sleep = (milliseconds: number): Promise<void> =>
	new Promise(resolve => globalThis.setTimeout(resolve, milliseconds))

const retryDelayMs = (random: () => number): number =>
	Math.min(800, Math.max(400, 400 + Math.floor(random() * 401)))

export async function fetchEntryLiveCompetitionBoard(
	tournamentId: number,
	variables: EntryLiveCompetitionBoardVariables,
	options: {
		signal?: AbortSignal
		fetchImpl?: typeof fetch
		random?: () => number
		sleepImpl?: (milliseconds: number) => Promise<void>
	} = {}
): Promise<EntryLiveCompetitionBoardPage> {
	const fetchImpl = options.fetchImpl ?? fetch
	const random = options.random ?? Math.random
	const sleepImpl = options.sleepImpl ?? sleep
	const startedAt = performance.now()
	let attempt = 0
	for (;;) {
		let response: Response
		try {
			response = await fetchImpl(
				`/api/live/competitions/${tournamentId}/board`,
				{
					method: 'POST',
					cache: 'no-store',
					credentials: 'include',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
						'X-LetLetMe-Contract': 'live-points-v2'
					},
					body: JSON.stringify(variables),
					signal: options.signal
				}
			)
		} catch (error) {
			if (options.signal?.aborted || attempt >= 1) throw error
			attempt += 1
			await sleepImpl(retryDelayMs(random))
			continue
		}

		const requestId = response.headers.get('x-request-id')
		if (!response.ok) {
			const body = (await response.json().catch(() => null)) as {
				error?: string
			} | null
			const code = body?.error || `LIVE_BOARD_HTTP_${response.status}`
			if (TRANSIENT_STATUSES.has(response.status) && attempt < 1) {
				attempt += 1
				await sleepImpl(retryDelayMs(random))
				continue
			}
			throw new LiveBoardRequestError({
				status: response.status,
				code,
				retryAfterSeconds: parseRetryAfter(response.headers.get('retry-after')),
				requestId
			})
		}

		const payload = await response.json().catch(() => null)
		try {
			return parseEntryLiveCompetitionBoardPage(payload)
		} catch (error) {
			if (error instanceof LiveBoardInvalidResponseError) {
				const durationMs = Math.round(performance.now() - startedAt)
				console.error('Invalid live competition board response', {
					operation: LIVE_BOARD_OPERATION,
					requestId,
					durationMs,
					missingFields: error.missingFields
				})
				recordBugReportDiagnostic({
					at: new Date().toISOString(),
					operation: LIVE_BOARD_OPERATION,
					requestId: requestId ?? undefined,
					code: error.code,
					status: response.status
				})
			}
			throw error
		}
	}
}
