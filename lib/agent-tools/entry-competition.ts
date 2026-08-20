import { AgentToolError, type AgentWarning } from '@/lib/agent-tools/contracts'
import {
	COMPETITION_CONTEXT_DOCUMENT,
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
	type ToolRunOptions
} from '@/lib/agent-tools/runtime'

export async function runEntry(options: ToolRunOptions<'letletme_entry'>) {
	const input = options.input
	if (input.query !== undefined) {
		const result = await executeDocument<{
			coreEventContext: CoreContext
			searchEntries: unknown[]
		}>(options, ENTRY_SEARCH_DOCUMENT, {
			query: input.query,
			limit: input.limit
		})
		return toolResponse(
			options,
			{
				accessScope: 'public',
				query: input.query,
				entries: result.searchEntries
			},
			coreRevisions(result.coreEventContext),
			[],
			undefined,
			result.coreEventContext.sourceCheckedAt
		)
	}

	if (input.entryId === undefined) {
		const entryId = requireVerifiedEntryId(options.session)
		const [snapshot, deskResult] = await Promise.all([
			executeDocument<{
				coreEventContext: CoreContext
				entrySnapshot: unknown | null
			}>(options, ENTRY_SNAPSHOT_DOCUMENT, { id: entryId }),
			executeDocument<{
				coreEventContext: CoreContext
				myFplTeamDesk: {
					state: string
					context: {
						season: string
						coreRevision: string
					}
					history: unknown[]
					[key: string]: unknown
				}
			}>(options, OWN_ENTRY_DOCUMENT, { eventId: input.eventId })
		])
		if (!snapshot.entrySnapshot) {
			throw new AgentToolError(
				'NOT_FOUND',
				'The verified entry has not been persisted by LetLetMe yet.',
				404,
				false
			)
		}
		if (
			snapshot.coreEventContext.season !== deskResult.coreEventContext.season ||
			snapshot.coreEventContext.revision !==
				deskResult.coreEventContext.revision ||
			deskResult.myFplTeamDesk.context.season !==
				snapshot.coreEventContext.season ||
			deskResult.myFplTeamDesk.context.coreRevision !==
				snapshot.coreEventContext.revision
		) {
			throw new AgentToolError(
				'UPSTREAM_UNAVAILABLE',
				'The published entry revision changed during this request. Retry the tool.',
				502,
				true
			)
		}
		const desk = deskResult.myFplTeamDesk
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
				entry: snapshot.entrySnapshot,
				extensions: {
					...desk,
					history: desk.history.slice(-input.historyLimit)
				}
			},
			coreRevisions(deskResult.coreEventContext),
			warnings,
			undefined,
			deskResult.coreEventContext.sourceCheckedAt
		)
	}

	const result = await executeDocument<{
		coreEventContext: CoreContext
		entrySnapshot: unknown | null
	}>(options, ENTRY_SNAPSHOT_DOCUMENT, { id: input.entryId })
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
	entryId: number,
	core: CoreContext,
	tournament: CompetitionTournament,
	liveSnapshot: CompetitionLiveSnapshot
): string =>
	fingerprint({
		competitionId,
		eventId,
		entryId,
		season: core.season,
		coreRevision: core.revision,
		standingsRevision: liveSnapshot?.revision ?? null,
		tournamentUpdatedAt: tournament.updatedAt,
		standingsReadyAt: tournament.standingsReadyAt
	})

type CompetitionTournament = {
	adminEntryId: number
	updatedAt: string
	standingsReadyAt: string | null
	[key: string]: unknown
}

type CompetitionLiveSnapshot = {
	season: string
	eventId: number
	revision: string
	checkedAt: string
} | null

type CompetitionContext = {
	coreEventContext: CoreContext
	liveSnapshot: CompetitionLiveSnapshot
	tournament: CompetitionTournament | null
}

export async function runCompetition(
	options: ToolRunOptions<'letletme_competition'>
) {
	const entryId = requireVerifiedEntryId(options.session)
	const eventId =
		options.input.eventId ?? coreEventId(await loadCoreContext(options))
	const context = await executeDocument<CompetitionContext>(
		options,
		COMPETITION_CONTEXT_DOCUMENT,
		{ competitionId: options.input.competitionId, entryId, eventId }
	)
	if (!context.tournament) {
		throw new AgentToolError(
			'FORBIDDEN',
			'You are not authorized to access this competition.',
			403,
			false
		)
	}
	const key = competitionKey(
		options.input.competitionId,
		eventId,
		entryId,
		context.coreEventContext,
		context.tournament,
		context.liveSnapshot
	)
	const offset =
		decodeCursor(options.input.cursor, { kind: 'competition', key }) ?? 0
	const result = await executeDocument<
		CompetitionContext & {
			tournamentEventResults: unknown[]
		}
	>(options, COMPETITION_DOCUMENT, {
		competitionId: options.input.competitionId,
		entryId,
		eventId,
		limit: options.input.limit + 1,
		offset
	})
	if (!result.tournament) {
		throw new AgentToolError(
			'FORBIDDEN',
			'You are not authorized to access this competition.',
			403,
			false
		)
	}
	const resultKey = competitionKey(
		options.input.competitionId,
		eventId,
		entryId,
		result.coreEventContext,
		result.tournament,
		result.liveSnapshot
	)
	if (resultKey !== key) {
		throw new AgentToolError(
			'UPSTREAM_UNAVAILABLE',
			'Competition standings changed during this request. Retry the tool.',
			502,
			true
		)
	}
	const hasMore = result.tournamentEventResults.length > options.input.limit
	const rows = result.tournamentEventResults.slice(0, options.input.limit)
	const nextCursor = hasMore
		? encodeCursor({
				kind: 'competition',
				key: resultKey,
				value: offset + rows.length
			})
		: null
	return toolResponse(
		options,
		{
			accessScope:
				context.tournament.adminEntryId === entryId ? 'admin' : 'member',
			eventId,
			competition: context.tournament,
			results: rows
		},
		coreRevisions(result.coreEventContext),
		[],
		{ nextCursor },
		result.liveSnapshot?.checkedAt ?? result.coreEventContext.sourceCheckedAt
	)
}
