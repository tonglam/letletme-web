import { recordBugReportDiagnostic } from '@/lib/bug-report-diagnostics'
import type {
	EntryLiveCompetitionBoardPage,
	EntryLiveCompetitionBoardHead,
	EntryLiveCompetitionBoardRow,
	EntryLiveCompetitionBoardScore,
	EntryLiveCompetitionOwnershipFilter,
	EntryLiveCompetitionTeamCountRule,
	EntryLiveCompetitionBoardVariables,
	LeagueLiveHead
} from '@/lib/graphql/operations/tournaments'
import type { TournamentEntry } from '@/types/tournament'

export const LIVE_BOARD_CONTRACT_VERSION = 'entry-live-board-v3'
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

const validateBoardScore = (
	value: unknown,
	path: string,
	missing: string[]
): value is EntryLiveCompetitionBoardScore => {
	if (!isRecord(value)) {
		missing.push(path)
		return false
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
		if (!nonEmptyString(value.revisions.input))
			missing.push(`${path}.revisions.input`)
	}

	if (!isRecord(value.times)) {
		missing.push(`${path}.times`)
	} else {
		for (const field of ['sourceCheckedAt', 'contentUpdatedAt']) {
			if (!validDate(value.times[field]) || value.times[field] === null)
				missing.push(`${path}.times.${field}`)
		}
		for (const field of ['nextRefreshAt']) {
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
	}
	return true
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
	if (
		!['READY', 'PENDING', 'MISSING', 'ERROR'].includes(
			String(value.availability)
		)
	)
		missing.push(`${path}.availability`)
	if (!isInteger(value.entry)) missing.push(`${path}.entry`)
	for (const field of ['entryName', 'playerName']) {
		if (!nonEmptyString(value[field])) missing.push(`${path}.${field}`)
	}
	if (!isNullableInteger(value.liveRank)) missing.push(`${path}.liveRank`)
	if (!isNullableInteger(value.overallRank)) missing.push(`${path}.overallRank`)
	for (const field of [
		'teamValue',
		'transferCost',
		'played',
		'toPlay',
		'captainId',
		'captainPoints'
	]) {
		if (!isNullableNumber(value[field])) missing.push(`${path}.${field}`)
	}
	for (const field of ['chip', 'captainName']) {
		if (!isNullableString(value[field])) missing.push(`${path}.${field}`)
	}
	if (value.score === null) {
		if (value.availability === 'READY') missing.push(`${path}.score`)
	} else {
		validateBoardScore(value.score, `${path}.score`, missing)
	}
	return true
}

const validateHead = (value: unknown, missing: string[]): boolean => {
	if (!isRecord(value)) {
		missing.push('head')
		return false
	}
	for (const field of ['season', 'mode', 'availability']) {
		if (!nonEmptyString(value[field])) missing.push(`head.${field}`)
	}
	if (!isInteger(value.eventId)) missing.push('head.eventId')
	if (!isInteger(value.tournamentId)) missing.push('head.tournamentId')
	if (!isNullableString(value.contentRevision))
		missing.push('head.contentRevision')
	if (!validDate(value.nextRefreshAt)) missing.push('head.nextRefreshAt')
	if (
		!['CLASSIC', 'H2H'].includes(String(value.mode)) ||
		!['READY', 'PENDING', 'MISSING', 'ERROR'].includes(
			String(value.availability)
		)
	) {
		missing.push('head.state')
	}
	if (!isRecord(value.delivery)) {
		missing.push('head.delivery')
	} else {
		if (
			!['FRESH', 'STALE', 'DEGRADED', 'FINAL', 'UNAVAILABLE'].includes(
				String(value.delivery.state)
			)
		)
			missing.push('head.delivery.state')
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
			missing.push('head.delivery.servedFrom')
		if (!isStringArray(value.delivery.reasonCodes))
			missing.push('head.delivery.reasonCodes')
	}
	if (value.publication === null) {
		if (value.availability === 'READY') missing.push('head.publication')
	} else {
		if (!isRecord(value.publication)) missing.push('head.publication')
		else {
			if (!isRecord(value.publication.revisions))
				missing.push('head.publication.revisions')
			else {
				for (const field of [
					'publicationId',
					'roster',
					'scoreCore',
					'fixtureIdentity',
					'entryInputSet',
					'identity',
					'rules',
					'algorithm',
					'content'
				]) {
					if (!nonEmptyString(value.publication.revisions[field]))
						missing.push(`head.publication.revisions.${field}`)
				}
				if (!isNonNegativeInteger(value.publication.revisions.generation))
					missing.push('head.publication.revisions.generation')
				if (!isNullableString(value.publication.revisions.officialRank))
					missing.push('head.publication.revisions.officialRank')
			}
			if (!isRecord(value.publication.times))
				missing.push('head.publication.times')
			else {
				for (const field of [
					'sourceCheckedAt',
					'contentUpdatedAt',
					'publishedAt',
					'servedAt',
					'staleAt'
				]) {
					if (
						!validDate(value.publication.times[field]) ||
						value.publication.times[field] === null
					)
						missing.push(`head.publication.times.${field}`)
				}
				for (const field of ['checkpointedAt', 'nextRefreshAt']) {
					if (!validDate(value.publication.times[field]))
						missing.push(`head.publication.times.${field}`)
				}
			}
		}
	}
	return true
}

const validateBoardHead = (
	value: unknown,
	missing: string[]
): value is EntryLiveCompetitionBoardHead => {
	if (!isRecord(value)) {
		missing.push('head')
		return false
	}
	for (const field of ['season', 'mode', 'availability']) {
		if (!nonEmptyString(value[field])) missing.push(`head.${field}`)
	}
	if (!isInteger(value.eventId)) missing.push('head.eventId')
	if (!isInteger(value.tournamentId)) missing.push('head.tournamentId')
	if (!isNullableString(value.contentRevision))
		missing.push('head.contentRevision')
	if (!validDate(value.nextRefreshAt)) missing.push('head.nextRefreshAt')
	if (
		!['CLASSIC', 'H2H'].includes(String(value.mode)) ||
		!['READY', 'PENDING', 'MISSING', 'ERROR'].includes(
			String(value.availability)
		)
	)
		missing.push('head.state')
	if (!isRecord(value.delivery)) {
		missing.push('head.delivery')
	} else if (
		!['FRESH', 'STALE', 'DEGRADED', 'FINAL', 'UNAVAILABLE'].includes(
			String(value.delivery.state)
		)
	) {
		missing.push('head.delivery.state')
	}
	if (value.publication === null) {
		if (value.availability === 'READY') missing.push('head.publication')
		return true
	}
	if (!isRecord(value.publication)) {
		missing.push('head.publication')
		return true
	}
	if (!isRecord(value.publication.revisions)) {
		missing.push('head.publication.revisions')
	} else {
		if (!nonEmptyString(value.publication.revisions.publicationId))
			missing.push('head.publication.revisions.publicationId')
		if (!isNonNegativeInteger(value.publication.revisions.generation))
			missing.push('head.publication.revisions.generation')
		if (!nonEmptyString(value.publication.revisions.scoreCore))
			missing.push('head.publication.revisions.scoreCore')
	}
	if (!isRecord(value.publication.times)) {
		missing.push('head.publication.times')
	} else {
		if (
			!validDate(value.publication.times.contentUpdatedAt) ||
			value.publication.times.contentUpdatedAt === null
		)
			missing.push('head.publication.times.contentUpdatedAt')
		if (!validDate(value.publication.times.nextRefreshAt))
			missing.push('head.publication.times.nextRefreshAt')
	}
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

	for (const field of ['totalEntries', 'filteredEntries']) {
		if (!isInteger(root[field])) missing.push(field)
	}
	validateBoardHead(root.head, missing)
	if (!isRecord(root.pageInfo)) missing.push('pageInfo')
	else {
		if (typeof root.pageInfo.hasNextPage !== 'boolean')
			missing.push('pageInfo.hasNextPage')
		if (!isNullableString(root.pageInfo.endCursor))
			missing.push('pageInfo.endCursor')
	}
	if (!isNullableNumber(root.highestEventPoints))
		missing.push('highestEventPoints')
	if (!isNullableNumber(root.averageEventPoints))
		missing.push('averageEventPoints')
	if (!Array.isArray(root.rows)) missing.push('rows')
	else
		root.rows.forEach((row, index) =>
			validateRow(row, `rows[${index}]`, missing)
		)
	if (root.viewerRow !== null) validateRow(root.viewerRow, 'viewerRow', missing)

	if (missing.length > 0) throw new LiveBoardInvalidResponseError(missing)
	return root as unknown as EntryLiveCompetitionBoardPage
}

export function parseLeagueLiveHead(value: unknown): LeagueLiveHead {
	const root =
		isRecord(value) && 'leagueLiveHead' in value ? value.leagueLiveHead : value
	const missing: string[] = []
	validateHead(root, missing)
	if (missing.length > 0) throw new LiveBoardInvalidResponseError(missing)
	return root as LeagueLiveHead
}

export const isCurrentLiveBoardRequest = (
	requestVersion: number,
	currentVersion: number,
	expectedScope: string,
	activeScope: string | null
): boolean => requestVersion === currentVersion && expectedScope === activeScope

export const shouldAutoRefreshLiveBoardPage = (
	page: EntryLiveCompetitionBoardPage | null
): boolean => page !== null

/**
 * Only a complete same-scope publication may replace an already rendered
 * board or be persisted as its last-good value. MISSING rows are allowed:
 * the V2 server uses that state only for an explicitly confirmed no-picks
 * entry and keeps its score null.
 */
export const isCompleteLiveBoardPage = (
	page: EntryLiveCompetitionBoardPage | null,
	options: { firstPage?: boolean } = {}
): boolean => {
	if (
		!page ||
		page.head.availability !== 'READY' ||
		page.head.publication === null ||
		page.head.delivery.state === 'UNAVAILABLE'
	)
		return false
	// The viewer row is an explicitly requested overlay and may also be part
	// of the visible page. Only duplicate rows within the page are corrupt.
	if (new Set(page.rows.map(row => row.entry)).size !== page.rows.length)
		return false
	if (page.rows.length > page.filteredEntries) return false
	if (page.filteredEntries > 0 && page.rows.length === 0) return false
	if (page.pageInfo.hasNextPage) {
		if (!page.pageInfo.endCursor || page.rows.length >= page.filteredEntries) {
			return false
		}
	} else if (page.rows.length === 0 && page.pageInfo.endCursor !== null) {
		return false
	} else if (options.firstPage && page.rows.length !== page.filteredEntries) {
		return false
	}
	const rows = page.viewerRow ? [...page.rows, page.viewerRow] : page.rows
	return rows.every(
		row =>
			(row.availability === 'READY' && row.score !== null) ||
			(row.availability === 'MISSING' && row.score === null)
	)
}

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
	contentRevision: string | null
}

export const liveBoardPublicationChanged = (
	accepted: LiveBoardFreshnessMarker | null,
	observed: LiveBoardFreshnessMarker | null
): boolean =>
	!observed ||
	!accepted ||
	accepted.eventId !== observed.eventId ||
	(accepted.contentRevision !== observed.contentRevision &&
		observed.contentRevision !== null)

export const shouldSyncLiveBoardSearchInput = (
	requestedInput: string,
	currentInput: string
): boolean => requestedInput === currentInput

export const isLiveBoardRevisionGoneCode = (code: string): boolean =>
	code === 'LIVE_BOARD_REVISION_GONE'

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
	preserveFutureGameweek?: boolean
}): { selectedGameweek: number; followsAnchor: boolean } =>
	input.preserveFutureGameweek &&
	input.requestedGameweek !== null &&
	input.requestedGameweek > input.currentEvent
		? {
				selectedGameweek: input.requestedGameweek,
				followsAnchor: false
			}
		: resolveAnchoredGameweek({
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
	return isCompleteLiveBoardPage(page, { firstPage: true })
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
			page.head.season !== scope.season ||
			page.head.eventId !== scope.eventId ||
			page.head.tournamentId !== scope.tournamentId ||
			page.head.mode !== 'CLASSIC'
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
	if (!storage || !scope.sessionKey) return
	if (!liveBoardHasUsableLastGoodRows(page)) return
	if (
		page.head.season !== scope.season ||
		page.head.eventId !== scope.eventId ||
		page.head.tournamentId !== scope.tournamentId ||
		page.head.mode !== 'CLASSIC'
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
	freeHit: chip === 'FREE_HIT',
	manager: chip === 'MANAGER'
})

export const boardRowToTournamentEntry = (
	row: EntryLiveCompetitionBoardRow
): TournamentEntry => {
	if (row.availability === 'MISSING' && row.score === null) {
		return {
			id: String(row.entry),
			availability: 'MISSING',
			rank: 0,
			teamName: row.entryName,
			managerName: row.playerName,
			captainName: 'N/A',
			captainTeam: 'N/A',
			captainPoints: 0,
			gwPoints: null,
			gwNetPoints: null,
			eventCost: undefined,
			overallRank: row.overallRank ?? undefined,
			livePoints: null,
			totalPoints: null,
			playersPlayed: 0,
			playersToPlay: 0,
			teamValue: row.teamValue ?? undefined,
			picks: [],
			chips: chipFlags('NONE'),
			stale: true
		}
	}
	if (row.availability !== 'READY' || !row.score) {
		throw new LiveBoardInvalidResponseError(['row.score'])
	}
	const score = row.score
	return {
		id: String(row.entry),
		availability: 'READY',
		rank: row.liveRank ?? 0,
		teamName: row.entryName,
		managerName: row.playerName,
		captainName: row.captainName || 'N/A',
		captainTeam: 'N/A',
		captainPoints: row.captainPoints ?? 0,
		gwPoints: score.eventPoints,
		gwNetPoints: score.netEventPoints,
		eventCost: score.transferCost,
		overallRank: row.overallRank ?? undefined,
		livePoints: score.eventPoints,
		totalPoints: score.totalScope === 'OVERALL' ? score.totalPoints : null,
		playersPlayed: row.played ?? 0,
		playersToPlay: row.toPlay ?? 0,
		teamValue: row.teamValue ?? undefined,
		picks: [],
		chips: chipFlags(row.chip ?? 'NONE'),
		stale:
			score.delivery.state === 'STALE' || score.delivery.state === 'DEGRADED'
	}
}

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

export async function fetchLeagueLiveHead(
	tournamentId: number,
	eventId: number,
	mode: 'CLASSIC' | 'H2H' = 'CLASSIC',
	options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {}
): Promise<LeagueLiveHead> {
	const fetchImpl = options.fetchImpl ?? fetch
	const response = await fetchImpl(
		`/api/live/competitions/${tournamentId}/head`,
		{
			method: 'POST',
			cache: 'no-store',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'X-LetLetMe-Contract': 'live-points-v2'
			},
			body: JSON.stringify({ eventId, mode }),
			signal: options.signal
		}
	)
	const requestId = response.headers.get('x-request-id')
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as {
			error?: string
		} | null
		throw new LiveBoardRequestError({
			status: response.status,
			code: body?.error || `LIVE_HEAD_HTTP_${response.status}`,
			retryAfterSeconds: parseRetryAfter(response.headers.get('retry-after')),
			requestId
		})
	}
	const payload = await response.json().catch(() => null)
	try {
		return parseLeagueLiveHead(payload)
	} catch (error) {
		if (error instanceof LiveBoardInvalidResponseError) {
			recordBugReportDiagnostic({
				at: new Date().toISOString(),
				operation: 'GetLeagueLiveHead',
				requestId: requestId ?? undefined,
				code: error.code,
				status: response.status
			})
		}
		throw error
	}
}
