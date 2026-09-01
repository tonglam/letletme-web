import { AgentToolError, type AgentWarning } from '@/lib/agent-tools/contracts'
import {
	COMPETITION_AVAILABILITY_DOCUMENT,
	COMPETITION_CONTEXT_DOCUMENT,
	COMPETITION_DOCUMENT,
	ENTRY_SEARCH_DOCUMENT,
	ENTRY_SNAPSHOT_DOCUMENT,
	OWN_ENTRY_DOCUMENT,
	OWN_ENTRY_EVENT_DOCUMENT
} from '@/lib/agent-tools/documents'
import {
	coreEventId,
	coreRevisions,
	decodeCursor,
	encodeCursor,
	executeDocument,
	fingerprint,
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
		const [snapshot, reviewResult] = await Promise.all([
			executeDocument<{
				coreEventContext: CoreContext
				entrySnapshot: unknown | null
			}>(options, ENTRY_SNAPSHOT_DOCUMENT, { id: entryId }),
			executeDocument<{
				coreEventContext: CoreContext
				myFplManagerReview: {
					state: string
					context: {
						season: string
						coreRevision: string
					}
					timeline: unknown[]
					currentGameweek?: unknown
					[key: string]: unknown
				}
				myFplManagerGameweek?: unknown
			}>(
				options,
				input.eventId === undefined
					? OWN_ENTRY_DOCUMENT
					: OWN_ENTRY_EVENT_DOCUMENT,
				input.eventId === undefined ? {} : { eventId: input.eventId }
			)
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
			snapshot.coreEventContext.season !==
				reviewResult.coreEventContext.season ||
			snapshot.coreEventContext.revision !==
				reviewResult.coreEventContext.revision ||
			reviewResult.myFplManagerReview.context.season !==
				snapshot.coreEventContext.season ||
			reviewResult.myFplManagerReview.context.coreRevision !==
				snapshot.coreEventContext.revision
		) {
			throw new AgentToolError(
				'UPSTREAM_UNAVAILABLE',
				'The published entry revision changed during this request. Retry the tool.',
				502,
				true
			)
		}
		const review = reviewResult.myFplManagerReview
		const warnings: AgentWarning[] = []
		if (review.state !== 'READY') {
			warnings.push({
				code: `ENTRY_EXTENSION_${review.state}`,
				message: 'Some verified-entry analysis is not ready for this period.'
			})
		}
		return toolResponse(
			options,
			{
				accessScope: 'self',
				entry: snapshot.entrySnapshot,
				extensions: {
					...review,
					history: review.timeline.slice(-input.historyLimit),
					...(reviewResult.myFplManagerGameweek
						? { gameweek: reviewResult.myFplManagerGameweek }
						: {})
				}
			},
			coreRevisions(reviewResult.coreEventContext),
			warnings,
			undefined,
			reviewResult.coreEventContext.sourceCheckedAt
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
		{
			accessScope: 'public',
			entry: result.entrySnapshot
		},
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
		standingsRevision: liveSnapshot?.revisions.scoreCore ?? null,
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
	state: string
	revisions: { scoreCore: string }
	times: {
		sourceCheckedAt: string
		contentUpdatedAt: string
		publishedAt: string
	}
	delivery: { state: string; servedFrom: string; reasonCodes: string[] }
} | null

type CompetitionContext = {
	coreEventContext: CoreContext
	liveSnapshot?: CompetitionLiveSnapshot
	tournament: CompetitionTournament | null
}

type CompetitionLiveContext = {
	season: string
	coreRevision: string
	currentEventId: number | null
	scoreCoreRevision: string | null
	sourceCheckedAt: string | null
}

type CompetitionAvailability = {
	coreEventContext: CoreContext
	liveContext: CompetitionLiveContext | null
}

const hasPublishedLiveEvent = (
	core: CoreContext,
	live: CompetitionLiveContext | null,
	eventId: number
): boolean => {
	if (
		core.latestFinishedEventId !== null &&
		eventId <= core.latestFinishedEventId
	) {
		return true
	}
	return (
		core.currentEventId === eventId &&
		live?.currentEventId === eventId &&
		live.scoreCoreRevision !== null
	)
}

const assertCoreRevision = (
	expected: CoreContext,
	actual: CoreContext
): void => {
	if (
		expected.season !== actual.season ||
		expected.revision !== actual.revision
	) {
		throw new AgentToolError(
			'UPSTREAM_UNAVAILABLE',
			'The published LetLetMe revision changed during this request. Retry the tool.',
			502,
			true
		)
	}
}

const assertLiveContextRevision = (
	core: CoreContext,
	live: CompetitionLiveContext | null
): void => {
	if (!live) return
	if (live.season !== core.season || live.coreRevision !== core.revision) {
		throw new AgentToolError(
			'UPSTREAM_UNAVAILABLE',
			'The published LetLetMe revision changed during this request. Retry the tool.',
			502,
			true
		)
	}
}

const assertCurrentLiveRevision = (
	availability: CompetitionAvailability,
	eventId: number,
	liveSnapshot: CompetitionLiveSnapshot | undefined
): void => {
	const expected = availability.liveContext?.scoreCoreRevision ?? null
	if (
		availability.coreEventContext.currentEventId === eventId &&
		expected !== null &&
		liveSnapshot?.revisions.scoreCore !== expected
	) {
		throw new AgentToolError(
			'UPSTREAM_UNAVAILABLE',
			'The published competition revision changed during this request. Retry the tool.',
			502,
			true
		)
	}
}

export async function runCompetition(
	options: ToolRunOptions<'letletme_competition'>
) {
	const entryId = requireVerifiedEntryId(options.session)
	const availability = await executeDocument<CompetitionAvailability>(
		options,
		COMPETITION_AVAILABILITY_DOCUMENT
	)
	const core = availability.coreEventContext
	assertLiveContextRevision(core, availability.liveContext)
	const eventId = options.input.eventId ?? coreEventId(core)
	const includeLive = hasPublishedLiveEvent(
		core,
		availability.liveContext,
		eventId
	)
	const context = await executeDocument<CompetitionContext>(
		options,
		COMPETITION_CONTEXT_DOCUMENT,
		{
			competitionId: options.input.competitionId,
			entryId,
			eventId,
			includeLive
		}
	)
	assertCoreRevision(core, context.coreEventContext)
	if (!context.tournament) {
		throw new AgentToolError(
			'FORBIDDEN',
			'You are not authorized to access this competition.',
			403,
			false
		)
	}
	assertCurrentLiveRevision(availability, eventId, context.liveSnapshot)
	const key = competitionKey(
		options.input.competitionId,
		eventId,
		entryId,
		context.coreEventContext,
		context.tournament,
		context.liveSnapshot ?? null
	)
	const offset =
		decodeCursor(options.input.cursor, { kind: 'competition', key }) ?? 0
	if (!includeLive) {
		return toolResponse(
			options,
			{
				accessScope:
					context.tournament.adminEntryId === entryId ? 'admin' : 'member',
				eventId,
				competition: context.tournament,
				results: []
			},
			coreRevisions(context.coreEventContext),
			[
				{
					code: 'COMPETITION_RESULTS_NOT_PUBLISHED',
					message:
						'No published live competition results are available for this event.'
				}
			],
			{ nextCursor: null },
			context.coreEventContext.sourceCheckedAt
		)
	}
	const result = await executeDocument<
		CompetitionContext & {
			tournamentEventResults: unknown[]
		}
	>(options, COMPETITION_DOCUMENT, {
		competitionId: options.input.competitionId,
		entryId,
		eventId,
		limit: options.input.limit + 1,
		offset,
		includeLive
	})
	assertCoreRevision(core, result.coreEventContext)
	assertCurrentLiveRevision(availability, eventId, result.liveSnapshot)
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
		result.liveSnapshot ?? null
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
		result.liveSnapshot?.times.sourceCheckedAt ??
			result.coreEventContext.sourceCheckedAt
	)
}
