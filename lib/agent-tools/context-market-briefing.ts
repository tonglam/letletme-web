import { AgentToolError, type AgentWarning } from '@/lib/agent-tools/contracts'
import {
	isBriefingState,
	isRenderableBriefingStoryState
} from '@/lib/graphql/operations/briefing'
import {
	BRIEFING_STORY_DOCUMENT,
	BRIEFING_WEEK_DOCUMENT,
	CONTEXT_DOCUMENT,
	MARKET_LINEUP_DOCUMENT,
	MARKET_OWNERSHIP_FALLERS_DOCUMENT,
	MARKET_OWNERSHIP_RISERS_DOCUMENT,
	MARKET_PULSE_MOVERS_DOCUMENT,
	MARKET_PULSE_UPDATES_DOCUMENT
} from '@/lib/agent-tools/documents'
import {
	coreRevisions,
	executeDocument,
	type CoreContext,
	type MarketContext,
	toolResponse,
	type ToolRunOptions
} from '@/lib/agent-tools/runtime'

export async function runContext(options: ToolRunOptions<'letletme_context'>) {
	const result = await executeDocument<{
		coreEventContext: CoreContext
		marketSnapshotContext: MarketContext
		briefingWeek: {
			state: string
			revision: number | null
			publicationId: string | null
			publishedAt: string | null
			sourceCheckedAt: string | null
			staleAt: string | null
			event: unknown
			featured: unknown[]
			sections: Array<{ key: string; items: unknown[] }>
		}
	}>(options, CONTEXT_DOCUMENT, { locale: 'EN' })
	const {
		coreEventContext: core,
		marketSnapshotContext: market,
		briefingWeek: briefing
	} = result
	const warnings: AgentWarning[] = []
	if (market.rowCount === 0) {
		warnings.push({
			code: 'MARKET_NO_DATA',
			message: 'No published market rows are available.'
		})
	}
	if (!['READY', 'STALE'].includes(briefing.state)) {
		warnings.push({
			code: 'BRIEFING_NOT_PUBLISHED',
			message: 'No active published Briefing is available for this period.'
		})
	}
	const now = (options.now ?? (() => new Date()))()
	const deadline = core.nextDeadlineTime
		? new Date(core.nextDeadlineTime)
		: null
	return toolResponse(
		options,
		{
			season: core.season,
			currentEventId: core.currentEventId,
			nextEventId: core.nextEventId,
			latestFinishedEventId: core.latestFinishedEventId,
			nextDeadlineTime: core.nextDeadlineTime,
			timeState:
				deadline && Number.isFinite(deadline.getTime())
					? deadline.getTime() > now.getTime()
						? 'PRE_DEADLINE'
						: 'POST_DEADLINE'
					: 'NO_ACTIVE_DEADLINE',
			coverage: {
				core: { sourceCheckedAt: core.sourceCheckedAt },
				market: {
					source: market.source,
					snapshotDate: market.snapshotDate,
					capturedAt: market.capturedAt,
					rowCount: market.rowCount
				},
				briefing: {
					state: briefing.state,
					publicationId: briefing.publicationId,
					publishedAt: briefing.publishedAt,
					sourceCheckedAt: briefing.sourceCheckedAt,
					staleAt: briefing.staleAt,
					featuredCount: briefing.featured.length,
					sectionCount: briefing.sections.length,
					storyCount: briefing.sections.reduce(
						(total, section) => total + section.items.length,
						briefing.featured.length
					)
				}
			}
		},
		{
			season: core.season,
			core: core.revision,
			market: market.revision,
			...(briefing.revision === null
				? {}
				: { briefing: String(briefing.revision) })
		},
		warnings,
		undefined,
		now.toISOString()
	)
}

export async function runMarket(options: ToolRunOptions<'letletme_market'>) {
	type MarketEnvelope = {
		coreEventContext: CoreContext
		marketSnapshotContext: MarketContext
	}
	const [
		lineupResult,
		risersResult,
		fallersResult,
		moversResult,
		updatesResult
	] = await Promise.all([
		executeDocument<
			MarketEnvelope & {
				marketLineup: unknown
			}
		>(options, MARKET_LINEUP_DOCUMENT),
		executeDocument<
			MarketEnvelope & {
				marketOwnershipOverview: {
					coverage: { status: string; complete: boolean; stale: boolean }
					[key: string]: unknown
				}
			}
		>(options, MARKET_OWNERSHIP_RISERS_DOCUMENT, {
			period: options.input.ownershipPeriod,
			limit: options.input.limit
		}),
		executeDocument<
			MarketEnvelope & {
				marketOwnershipOverview: {
					coverage: { status: string; complete: boolean; stale: boolean }
					[key: string]: unknown
				}
			}
		>(options, MARKET_OWNERSHIP_FALLERS_DOCUMENT, {
			period: options.input.ownershipPeriod,
			limit: options.input.limit
		}),
		executeDocument<
			MarketEnvelope & {
				marketPulse: {
					coverage: { complete: boolean; stale: boolean; observedDays: number }
					[key: string]: unknown
				}
			}
		>(options, MARKET_PULSE_MOVERS_DOCUMENT, { days: options.input.days }),
		executeDocument<
			MarketEnvelope & {
				marketPulse: Record<string, unknown>
			}
		>(options, MARKET_PULSE_UPDATES_DOCUMENT, { days: options.input.days })
	])
	const revisionKey = (result: MarketEnvelope): string =>
		[
			result.coreEventContext.season,
			result.coreEventContext.revision,
			result.marketSnapshotContext.season,
			result.marketSnapshotContext.revision
		].join(':')
	const expectedRevision = revisionKey(lineupResult)
	if (
		![risersResult, fallersResult, moversResult, updatesResult].every(
			result => revisionKey(result) === expectedRevision
		)
	) {
		throw new AgentToolError(
			'UPSTREAM_UNAVAILABLE',
			'The published market revision changed during this request. Retry the tool.',
			502,
			true
		)
	}
	const result = {
		...lineupResult,
		marketOwnershipOverview: {
			...risersResult.marketOwnershipOverview,
			...fallersResult.marketOwnershipOverview,
			risers: risersResult.marketOwnershipOverview.risers ?? []
		},
		marketPulse: { ...moversResult.marketPulse, ...updatesResult.marketPulse }
	} satisfies MarketEnvelope & {
		marketLineup: unknown
		marketOwnershipOverview: {
			coverage: { status: string; complete: boolean; stale: boolean }
			[key: string]: unknown
		}
		marketPulse: {
			coverage: { complete: boolean; stale: boolean; observedDays: number }
			[key: string]: unknown
		}
	}
	const { coreEventContext: core, marketSnapshotContext: market } = result
	const warnings: AgentWarning[] = []
	if (!result.marketPulse.coverage.complete) {
		warnings.push({
			code: 'MARKET_PARTIAL_COVERAGE',
			message: 'The requested market window is only partially covered.'
		})
	}
	if (result.marketPulse.coverage.stale) {
		warnings.push({
			code: 'MARKET_STALE',
			message: 'The published market snapshot is stale.'
		})
	}
	if (result.marketOwnershipOverview.coverage.status !== 'READY') {
		warnings.push({
			code: `OWNERSHIP_${result.marketOwnershipOverview.coverage.status}`,
			message: 'Ownership-change coverage is not fully ready.'
		})
	}
	return toolResponse(
		options,
		{
			snapshot: market,
			lineup: result.marketLineup,
			ownership: result.marketOwnershipOverview,
			pulse: result.marketPulse
		},
		{ season: core.season, core: core.revision, market: market.revision },
		warnings,
		undefined,
		market.capturedAt ?? core.sourceCheckedAt
	)
}

export async function runBriefing(
	options: ToolRunOptions<'letletme_briefing'>
) {
	if (options.input.slug) {
		const result = await executeDocument<{
			coreEventContext: CoreContext
			briefingWeek: {
				state: string
				revision: number | null
				publicationId: string | null
				publishedAt: string | null
				sourceCheckedAt: string | null
				staleAt: string | null
			}
			briefingStory: {
				state: string
				canonicalSlug: string | null
				story: {
					storyRevision: number
					sourceCheckedAt?: string | null
					[key: string]: unknown
				} | null
			} | null
		}>(options, BRIEFING_STORY_DOCUMENT, {
			slug: options.input.slug,
			locale: options.input.locale
		})
		const storyState = result.briefingStory?.state
		const publishable = Boolean(
			storyState &&
			isBriefingState(storyState) &&
			isRenderableBriefingStoryState(storyState) &&
			result.briefingStory?.story
		)
		const warnings = publishable
			? []
			: [
					{
						code: 'BRIEFING_STORY_NOT_PUBLISHED',
						message: 'The requested Briefing story is not active or published.'
					}
				]
		return toolResponse(
			options,
			{
				locale: options.input.locale,
				publication: result.briefingWeek,
				story: publishable ? result.briefingStory : null
			},
			{
				...coreRevisions(result.coreEventContext),
				...(publishable
					? {
							briefing: String(
								result.briefingStory!.story!.storyRevision
							)
						}
					: result.briefingWeek.revision === null
						? {}
						: { briefing: String(result.briefingWeek.revision) })
			},
			warnings,
			undefined,
			result.briefingStory?.story?.sourceCheckedAt ??
				result.briefingWeek.sourceCheckedAt ??
				result.coreEventContext.sourceCheckedAt
		)
	}

	const result = await executeDocument<{
		coreEventContext: CoreContext
		briefingWeek: {
			state: string
			revision: number | null
			publicationId: string | null
			publishedAt: string | null
			sourceCheckedAt: string | null
			featured: unknown[]
			sections: unknown[]
			[key: string]: unknown
		}
	}>(options, BRIEFING_WEEK_DOCUMENT, { locale: options.input.locale })
	const publishable = ['READY', 'STALE'].includes(result.briefingWeek.state)
	const warnings: AgentWarning[] = []
	if (!publishable) {
		warnings.push({
			code: 'BRIEFING_NOT_PUBLISHED',
			message: 'No active published Briefing is available for this period.'
		})
	}
	if (result.briefingWeek.state === 'STALE') {
		warnings.push({
			code: 'BRIEFING_STALE',
			message: 'The published Briefing is stale.'
		})
	}
	const week = publishable
		? result.briefingWeek
		: {
				state: result.briefingWeek.state,
				revision: null,
				publicationId: null,
				publishedAt: null,
				sourceCheckedAt: result.briefingWeek.sourceCheckedAt,
				featured: [],
				sections: []
			}
	return toolResponse(
		options,
		{ locale: options.input.locale, week },
		{
			...coreRevisions(result.coreEventContext),
			...(publishable && result.briefingWeek.revision !== null
				? { briefing: String(result.briefingWeek.revision) }
				: {})
		},
		warnings,
		undefined,
		result.briefingWeek.sourceCheckedAt ??
			result.coreEventContext.sourceCheckedAt
	)
}
