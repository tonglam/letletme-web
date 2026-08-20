import { createHash } from 'node:crypto'

import {
	AgentToolError,
	type AgentSession,
	type AgentToolInputMap,
	type AgentToolResponse,
	type AgentWarning,
	type LetLetMeToolName
} from '@/lib/agent-tools/contracts'
import {
	CORE_CONTEXT_DOCUMENT,
	MARKET_CONTEXT_DOCUMENT,
	SELECTION_CONTEXT_DOCUMENT
} from '@/lib/agent-tools/documents'

export type AgentGraphQLExecutor = (
	document: string,
	variables: Record<string, unknown>,
	requestId: string,
	signal?: AbortSignal
) => Promise<unknown>

export type CoreContext = {
	season: string
	revision: string
	sourceCheckedAt: string
	currentEventId: number | null
	nextEventId: number | null
	nextDeadlineTime: string | null
	latestFinishedEventId: number | null
}

export type MarketContext = {
	season: string
	revision: string
	source: string
	snapshotDate: string | null
	capturedAt: string | null
	rowCount: number
}

export type SelectionContext = {
	season: string
	coreRevision: string
	marketRevision: string | null
	checkedAt: string
	eventId: number
	phase: string
	playerPool: {
		state: string
		checkedAt: string | null
		message: string | null
	}
}

export type ToolRunOptions<T extends LetLetMeToolName = LetLetMeToolName> = {
	tool: T
	input: AgentToolInputMap[T]
	session: AgentSession
	requestId: string
	execute: AgentGraphQLExecutor
	signal?: AbortSignal
	now?: () => Date
}

export const asObject = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new AgentToolError(
			'UPSTREAM_UNAVAILABLE',
			'LetLetMe data service returned an invalid response.',
			502,
			true
		)
	}
	return value as Record<string, unknown>
}

export const verifiedEntryId = (session: AgentSession): number | null => {
	const verifiedAt = session.user.fplEntryVerifiedAt
	const id = session.user.fplEntryId
	if (!verifiedAt || !Number.isSafeInteger(id) || (id ?? 0) <= 0) return null
	const parsed = new Date(verifiedAt)
	return Number.isFinite(parsed.getTime()) ? (id as number) : null
}

export const requireVerifiedEntryId = (session: AgentSession): number => {
	const id = verifiedEntryId(session)
	if (id !== null) return id
	throw new AgentToolError(
		'FPL_VERIFICATION_REQUIRED',
		'Verify your FPL entry in LetLetMe before using this tool.',
		403,
		false
	)
}

export const encodeCursor = (
	payload: Record<string, string | number>
): string => Buffer.from(JSON.stringify(payload)).toString('base64url')

export const decodeCursorValue = (
	value: string | undefined,
	expected: { kind: string; mode?: string }
): number | null => {
	if (!value) return null
	try {
		const parsed = JSON.parse(
			Buffer.from(value, 'base64url').toString('utf8')
		) as Record<string, unknown>
		if (
			parsed.kind !== expected.kind ||
			(expected.mode !== undefined && parsed.mode !== expected.mode) ||
			!Number.isSafeInteger(parsed.value) ||
			(parsed.value as number) < 0
		) {
			throw new Error('cursor mismatch')
		}
		return parsed.value as number
	} catch {
		throw new AgentToolError(
			'INVALID_INPUT',
			'Invalid or stale pagination cursor.',
			400,
			false
		)
	}
}

export const decodeCursor = (
	value: string | undefined,
	expected: { kind: string; mode?: string; key: string }
): number | null => {
	if (!value) return null
	const cursorValue = decodeCursorValue(value, expected)
	if (cursorValue === null) return null
	try {
		const parsed = JSON.parse(
			Buffer.from(value, 'base64url').toString('utf8')
		) as Record<string, unknown>
		if (
			parsed.kind !== expected.kind ||
			parsed.key !== expected.key ||
			(expected.mode !== undefined && parsed.mode !== expected.mode) ||
			parsed.value !== cursorValue
		) {
			throw new Error('cursor mismatch')
		}
		return cursorValue
	} catch {
		throw new AgentToolError(
			'INVALID_INPUT',
			'Invalid or stale pagination cursor.',
			400,
			false
		)
	}
}

export const fingerprint = (value: unknown): string =>
	createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)

export const coreRevisions = (core: CoreContext) => ({
	season: core.season,
	core: core.revision
})

export const coreEventId = (core: CoreContext): number =>
	core.currentEventId ?? core.nextEventId ?? core.latestFinishedEventId ?? 1

export const toolResponse = <T>(
	options: ToolRunOptions,
	data: T,
	revisions: AgentToolResponse<T>['revisions'],
	warnings: AgentWarning[] = [],
	page?: AgentToolResponse<T>['page'],
	asOf?: string
): AgentToolResponse<T> => ({
	schemaVersion: '1',
	tool: options.tool,
	requestId: options.requestId,
	asOf: asOf ?? (options.now ?? (() => new Date()))().toISOString(),
	revisions,
	data,
	...(page ? { page } : {}),
	warnings
})

export const executeDocument = async <T>(
	options: ToolRunOptions,
	document: string,
	variables: Record<string, unknown> = {}
): Promise<T> =>
	asObject(
		await options.execute(
			document,
			variables,
			options.requestId,
			options.signal
		)
	) as T

export const loadCoreContext = async (
	options: ToolRunOptions
): Promise<CoreContext> => {
	const result = await executeDocument<{ coreEventContext: CoreContext }>(
		options,
		CORE_CONTEXT_DOCUMENT
	)
	return result.coreEventContext
}

export const loadSelectionContext = async (
	options: ToolRunOptions,
	eventId: number
): Promise<SelectionContext> => {
	const result = await executeDocument<{ teamSelectionDesk: SelectionContext }>(
		options,
		SELECTION_CONTEXT_DOCUMENT,
		{ eventId }
	)
	return result.teamSelectionDesk
}

export const loadMarketContext = async (
	options: ToolRunOptions
): Promise<{
	coreEventContext: CoreContext
	marketSnapshotContext: MarketContext
}> => executeDocument(options, MARKET_CONTEXT_DOCUMENT)

export const assertSelectionRevision = (
	core: CoreContext,
	selection: SelectionContext
): void => {
	if (
		selection.season !== core.season ||
		selection.coreRevision !== core.revision
	) {
		throw new AgentToolError(
			'UPSTREAM_UNAVAILABLE',
			'The published LetLetMe revision changed during this request. Retry the tool.',
			502,
			true
		)
	}
}
