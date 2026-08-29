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

const validDate = (value: unknown): value is string | null =>
	value === null ||
	(typeof value === 'string' && Number.isFinite(Date.parse(value)))

const nonEmptyString = (value: unknown): value is string =>
	typeof value === 'string' && value.trim().length > 0

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
	for (const field of [
		'eventPoints',
		'netEventPoints',
		'totalPoints',
		'overallRank',
		'transferCost'
	]) {
		if (!isNullableNumber(value[field])) missing.push(`${path}.${field}`)
	}
	for (const field of ['source', 'state', 'eventPointSemantics']) {
		if (typeof value[field] !== 'string') missing.push(`${path}.${field}`)
	}
	if (
		value.source !== 'FPL_EVENT_LIVE' &&
		value.source !== 'FPL_FINAL_RESULT' &&
		value.source !== 'UNAVAILABLE'
	)
		missing.push(`${path}.source`)
	if (
		value.reconciliation !== 'MATCHED' &&
		value.reconciliation !== 'NO_LINEUP' &&
		value.reconciliation !== 'SOURCE_SKEW' &&
		value.reconciliation !== 'NOT_COMPARABLE'
	)
		missing.push(`${path}.reconciliation`)
	if (
		value.calculationMode !== 'PROJECTED_AUTOSUBS' &&
		value.calculationMode !== 'FINAL_RESULT' &&
		value.calculationMode !== null
	)
		missing.push(`${path}.calculationMode`)
	if (!validDate(value.checkedAt)) missing.push(`${path}.checkedAt`)
	if (!validDate(value.nextRefreshAt)) missing.push(`${path}.nextRefreshAt`)

	if (value.source === 'UNAVAILABLE') {
		if (
			value.calculationMode !== null ||
			value.algorithmVersion !== null ||
			value.revision !== null ||
			value.checkedAt !== null ||
			value.provenance !== null
		)
			missing.push(`${path}.unavailableTraceability`)
		return
	}

	const expectedMode =
		value.source === 'FPL_EVENT_LIVE' ? 'PROJECTED_AUTOSUBS' : 'FINAL_RESULT'
	if (value.calculationMode !== expectedMode)
		missing.push(`${path}.calculationMode`)
	if (!nonEmptyString(value.revision)) missing.push(`${path}.revision`)
	if (!validDate(value.checkedAt) || value.checkedAt === null)
		missing.push(`${path}.checkedAt`)
	const staleLiveScoreNotComparable =
		value.source === 'FPL_EVENT_LIVE' &&
		(value.state === 'STALE' || value.state === 'SETTLING') &&
		value.reconciliation === 'NOT_COMPARABLE'
	if (
		value.reconciliation !== 'MATCHED' &&
		value.reconciliation !== 'NO_LINEUP' &&
		!staleLiveScoreNotComparable
	)
		missing.push(`${path}.reconciliation`)

	if (!isRecord(value.provenance)) {
		missing.push(`${path}.provenance`)
		return
	}
	const provenance = value.provenance
	if (provenance.scoreSource !== value.source)
		missing.push(`${path}.provenance.scoreSource`)
	if (provenance.calculationMode !== expectedMode)
		missing.push(`${path}.provenance.calculationMode`)
	if (!nonEmptyString(provenance.inputRevision))
		missing.push(`${path}.provenance.inputRevision`)
	if (!nonEmptyString(provenance.scoreRevision))
		missing.push(`${path}.provenance.scoreRevision`)
	if (!validDate(provenance.liveCheckedAt))
		missing.push(`${path}.provenance.liveCheckedAt`)
	if (!validDate(provenance.picksCheckedAt))
		missing.push(`${path}.provenance.picksCheckedAt`)
	if (!validDate(provenance.resultCheckedAt))
		missing.push(`${path}.provenance.resultCheckedAt`)
	if (!validDate(provenance.dataCheckedAt))
		missing.push(`${path}.provenance.dataCheckedAt`)
	if (!validDate(provenance.rankCheckedAt))
		missing.push(`${path}.provenance.rankCheckedAt`)

	if (expectedMode === 'PROJECTED_AUTOSUBS') {
		if (value.algorithmVersion !== 'fpl-projected-autosubs-v1')
			missing.push(`${path}.algorithmVersion`)
		if (provenance.algorithmVersion !== 'fpl-projected-autosubs-v1')
			missing.push(`${path}.provenance.algorithmVersion`)
		for (const field of [
			'livePublicationId',
			'liveRevision',
			'picksRevision',
			'previousTotalsRevision'
		]) {
			if (!nonEmptyString(provenance[field]))
				missing.push(`${path}.provenance.${field}`)
		}
		if (
			provenance.resultRevision !== null ||
			provenance.resultCheckedAt !== null ||
			provenance.dataCheckedAt !== null
		)
			missing.push(`${path}.provenance.resultFields`)
	} else {
		if (value.algorithmVersion !== null)
			missing.push(`${path}.algorithmVersion`)
		if (provenance.algorithmVersion !== null)
			missing.push(`${path}.provenance.algorithmVersion`)
		if (
			provenance.livePublicationId !== null ||
			provenance.liveRevision !== null ||
			provenance.liveCheckedAt !== null ||
			provenance.previousTotalsRevision !== null
		)
			missing.push(`${path}.provenance.liveFields`)
		for (const field of ['picksRevision', 'resultRevision']) {
			if (!nonEmptyString(provenance[field]))
				missing.push(`${path}.provenance.${field}`)
		}
		if (
			provenance.resultCheckedAt === null ||
			provenance.dataCheckedAt === null
		)
			missing.push(`${path}.provenance.resultCheckedAt`)
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
		'overallRank',
		'livePoints',
		'transferCost',
		'liveNetPoints',
		'liveTotalPoints',
		'played',
		'toPlay',
		'captainId',
		'captainPoints'
	]) {
		if (!isInteger(value[field])) missing.push(`${path}.${field}`)
	}
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
	for (const field of [
		'season',
		'boardRevision',
		'playerRevision',
		'dataAvailability'
	]) {
		if (typeof root[field] !== 'string' || root[field].length === 0)
			missing.push(field)
	}
	for (const field of ['managerDataAvailability', 'managerServedFrom']) {
		if (typeof root[field] !== 'string') missing.push(field)
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
	for (const field of ['partial', 'hasMore', 'managerRefreshQueued']) {
		if (typeof root[field] !== 'boolean') missing.push(field)
	}
	if (!isNullableString(root.managerRevision)) missing.push('managerRevision')
	if (!validDate(root.managerCheckedAt)) missing.push('managerCheckedAt')
	if (!validDate(root.managerNextRefreshAt))
		missing.push('managerNextRefreshAt')
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

export const shouldRefreshLiveBoardManagerCoverage = (
	page: Pick<
		EntryLiveCompetitionBoardPage,
		| 'page'
		| 'managerRefreshQueued'
		| 'deferredEntryCount'
		| 'coverageState'
		| 'managerDataAvailability'
	> | null
): boolean =>
	Boolean(
		page &&
		page.page === 1 &&
		(page.managerRefreshQueued ||
			page.deferredEntryCount > 0 ||
			page.coverageState === 'WARMING' ||
			page.managerDataAvailability === 'PARTIAL')
	)

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
	revision: string | null
}

export const liveBoardPublicationChanged = (
	accepted: LiveBoardFreshnessMarker | null,
	observed: LiveBoardFreshnessMarker | null
): boolean =>
	!observed ||
	!accepted ||
	accepted.eventId !== observed.eventId ||
	(accepted.revision !== observed.revision && observed.revision !== null)

export const shouldSyncLiveBoardSearchInput = (
	requestedInput: string,
	currentInput: string
): boolean => requestedInput === currentInput

export const isLiveBoardRevisionGoneCode = (code: string): boolean =>
	code === 'LIVE_BOARD_REVISION_GONE' || code === 'LIVE_REVISION_GONE'

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
	if (page.dataAvailability === 'SCHEDULED') return visibleRows.length > 0
	if (
		page.managerDataAvailability === 'UNAVAILABLE' ||
		page.officialCoverage <= 0
	)
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
	overallRank: row.score.overallRank ?? row.overallRank,
	livePoints: row.score.eventPoints,
	totalPoints:
		row.score.totalScope === 'OVERALL' ? row.score.totalPoints : null,
	playersPlayed: row.played,
	playersToPlay: row.toPlay,
	teamValue: row.teamValue,
	picks: [],
	chips: chipFlags(row.chip),
	stale: row.score.state === 'STALE'
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
						Accept: 'application/json'
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
