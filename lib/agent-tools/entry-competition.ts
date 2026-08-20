import { AgentToolError, type AgentWarning } from '@/lib/agent-tools/contracts'
import {
	COMPETITION_DOCUMENT,
	ENTRY_SEARCH_DOCUMENT,
	ENTRY_SNAPSHOT_DOCUMENT,
	OWN_ENTRY_DOCUMENT
} from '@/lib/agent-tools/documents'
import {
	coreEventId,
	coreRevisions,
	decodeCursor,
	encodeCursor,
	executeDocument,
	fingerprint,
	loadCoreContext,
	requireVerifiedEntryId,
	type CoreContext,
	toolResponse,
	type ToolRunOptions,
	verifiedEntryId
} from '@/lib/agent-tools/runtime'

export async function runEntry(options: ToolRunOptions<'letletme_entry'>) {
	const input = options.input
	if (input.query !== undefined) {
		const result = await executeDocument<{
			coreEventContext: CoreContext
			searchEntries: unknown[]
		}>(options, ENTRY_SEARCH_DOCUMENT, { query: input.query, limit: input.limit })
		return toolResponse(
			options,
			{ accessScope: 'public', query: input.query, entries: result.searchEntries },
			coreRevisions(result.coreEventContext),
			[],
			undefined,
			result.coreEventContext.sourceCheckedAt
		)
	}

	const ownId = verifiedEntryId(options.session)
	const entryId = input.entryId ?? requireVerifiedEntryId(options.session)
	if (ownId !== null && entryId === ownId) {
		const result = await executeDocument<{
			coreEventContext: CoreContext
			entrySnapshot: unknown | null
			myFplTeamDesk: {
				state: string
				history: unknown[]
				[key: string]: unknown
			}
		}>(options, OWN_ENTRY_DOCUMENT, { id: entryId, eventId: input.eventId })
		if (!result.entrySnapshot) {
			throw new AgentToolError(
				'NOT_FOUND',
				'The verified entry has not been persisted by LetLetMe yet.',
				404,
				false
			)
		}
		const desk = result.myFplTeamDesk
		const warnings: AgentWarning[] = []
		if (desk.state !== 'READY') {
			warnings.push({
				code: `ENTRY_EXTENSION_${desk.state}`,
				message: 'Some verified-entry analysis is not ready for this period.'
			})
		}
		return toolResponse(
			options,
			{
				accessScope: 'self',
				entry: result.entrySnapshot,
				extensions: { ...desk, history: desk.history.slice(-input.historyLimit) }
			},
			coreRevisions(result.coreEventContext),
			warnings,
			undefined,
			result.coreEventContext.sourceCheckedAt
		)
	}

	const result = await executeDocument<{
		coreEventContext: CoreContext
		entrySnapshot: unknown | null
	}>(options, ENTRY_SNAPSHOT_DOCUMENT, { id: entryId })
	if (!result.entrySnapshot) {
		throw new AgentToolError(
			'NOT_FOUND',
			'No persisted LetLetMe entry snapshot was found.',
			404,
			false
		)
	}
	return toolResponse(
		options,
		{ accessScope: 'public', entry: result.entrySnapshot },
		coreRevisions(result.coreEventContext),
		[],
		undefined,
		result.coreEventContext.sourceCheckedAt
	)
}

const competitionKey = (
	competitionId: number,
	eventId: number,
	entryId: number
): string => fingerprint({ competitionId, eventId, entryId })

export async function runCompetition(options: ToolRunOptions<'letletme_competition'>) {
	const entryId = requireVerifiedEntryId(options.session)
	const eventId = options.input.eventId ?? coreEventId(await loadCoreContext(options))
	const key = competitionKey(options.input.competitionId, eventId, entryId)
	const offset = decodeCursor(options.input.cursor, { kind: 'competition', key }) ?? 0
	const result = await executeDocument<{
		coreEventContext: CoreContext
		tournament: { adminEntryId: number; [key: string]: unknown } | null
		tournamentEventResults: unknown[]
	}>(options, COMPETITION_DOCUMENT, {
		competitionId: options.input.competitionId,
		entryId,
		eventId,
		limit: options.input.limit + 1,
		offset
	})
	if (!result.tournament) {
		throw new AgentToolError(
			'NOT_FOUND',
			'Competition not found or no longer available.',
			404,
			false
		)
	}
	const hasMore = result.tournamentEventResults.length > options.input.limit
	const rows = result.tournamentEventResults.slice(0, options.input.limit)
	const nextCursor = hasMore
		? encodeCursor({ kind: 'competition', key, value: offset + rows.length })
		: null
	return toolResponse(
		options,
		{
			accessScope: result.tournament.adminEntryId === entryId ? 'admin' : 'member',
			eventId,
			competition: result.tournament,
			results: rows
		},
		coreRevisions(result.coreEventContext),
		[],
		{ nextCursor },
		result.coreEventContext.sourceCheckedAt
	)
}
