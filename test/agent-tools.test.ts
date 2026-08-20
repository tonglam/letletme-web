import assert from 'node:assert/strict'
import test from 'node:test'

import {
	AGENT_TOOL_CAPABILITIES,
	LETLETME_TOOL_NAMES,
	type AgentSession
} from '@/lib/agent-tools/contracts'
import {
	AGENT_GRAPHQL_DOCUMENTS,
	BRIEFING_STORY_DOCUMENT,
	COMPETITION_AVAILABILITY_DOCUMENT,
	COMPETITION_CONTEXT_DOCUMENT,
	COMPETITION_DOCUMENT,
	CONTEXT_DOCUMENT,
	CORE_CONTEXT_DOCUMENT,
	ENTRY_SNAPSHOT_DOCUMENT,
	MARKET_CONTEXT_DOCUMENT,
	MARKET_LINEUP_DOCUMENT,
	MARKET_OWNERSHIP_FALLERS_DOCUMENT,
	MARKET_OWNERSHIP_RISERS_DOCUMENT,
	MARKET_PULSE_MOVERS_DOCUMENT,
	MARKET_PULSE_UPDATES_DOCUMENT,
	OWN_ENTRY_DOCUMENT,
	PLAYER_CATALOG_DOCUMENT,
	PLAYERS_DOCUMENT,
	SELECTION_CONTEXT_DOCUMENT
} from '@/lib/agent-tools/documents'
import {
	AGENT_MAX_INPUT_BYTES,
	handleAgentCapabilitiesRequest,
	handleAgentToolRequest,
	type AgentGatewayDependencies,
	type AgentGatewayLog
} from '@/lib/agent-tools/route-handler'
import { GraphQLRequestError } from '@/lib/graphql-client'
import { decodeCursor, encodeCursor } from '@/lib/agent-tools/runtime'
import { parse, visit } from 'graphql'

const authenticated: AgentSession = { user: { id: 'user-1' } }
const verified: AgentSession = {
	user: {
		id: 'user-1',
		fplEntryId: 123,
		fplEntryVerifiedAt: '2026-08-20T00:00:00.000Z'
	}
}

const enabledEnv = {
	AGENT_TOOLS_ENABLED: 'true',
	BACKEND_PROXY_SECRET: 'test-proxy-secret'
}

const request = (
	body: unknown,
	headers: Record<string, string> = {}
): Request =>
	new Request('https://www.letletme.top/api/agent/v1/tools/letletme_context', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: JSON.stringify(body)
	})

const contextResult = {
	coreEventContext: {
		season: '2627',
		revision: 'core-7',
		sourceCheckedAt: '2026-08-20T00:00:00.000Z',
		currentEventId: 1,
		nextEventId: 2,
		nextDeadlineTime: '2026-08-27T17:30:00.000Z',
		latestFinishedEventId: null
	},
	marketSnapshotContext: {
		season: '2627',
		revision: 'market-4',
		source: 'DATA_PUBLICATION',
		snapshotDate: '2026-08-20',
		capturedAt: '2026-08-20T00:01:00.000Z',
		rowCount: 700
	},
	teamSelectionDesk: {
		season: '2627',
		coreRevision: 'core-7',
		marketRevision: 'market-4',
		checkedAt: '2026-08-20T00:01:00.000Z',
		eventId: 1,
		phase: 'PRE_DEADLINE',
		playerPool: { state: 'READY', checkedAt: null, message: null }
	},
	briefingWeek: {
		state: 'READY',
		revision: 3,
		publicationId: 'publication-3',
		publishedAt: '2026-08-20T00:02:00.000Z',
		sourceCheckedAt: '2026-08-20T00:02:00.000Z',
		staleAt: null,
		event: null,
		featured: [],
		sections: []
	}
}

const dependencies = (
	session: AgentSession | null,
	execute: AgentGatewayDependencies['execute'] = async () => contextResult,
	overrides: Partial<AgentGatewayDependencies> = {}
): AgentGatewayDependencies => ({
	getSession: async () => session,
	execute,
	env: enabledEnv,
	now: () => new Date('2026-08-20T01:00:00.000Z'),
	log: () => {},
	...overrides
})

test('capabilities expose exactly the seven fixed tools after authentication', async () => {
	const response = await handleAgentCapabilitiesRequest(
		new Request('https://www.letletme.top/api/agent/v1/capabilities'),
		dependencies(verified)
	)
	assert.equal(response.status, 200)
	const body = await response.json()
	assert.deepEqual(
		body.tools.map((tool: { name: string }) => tool.name),
		LETLETME_TOOL_NAMES
	)
	assert.deepEqual(
		AGENT_TOOL_CAPABILITIES.map(tool => tool.name),
		LETLETME_TOOL_NAMES
	)
	assert.equal(body.verifiedFplEntry, true)
})

test('the total switch and beta allowlist fail closed', async () => {
	const disabled = await handleAgentCapabilitiesRequest(
		new Request('https://www.letletme.top/api/agent/v1/capabilities'),
		dependencies(authenticated, undefined, {
			env: { ...enabledEnv, AGENT_TOOLS_ENABLED: 'false' }
		})
	)
	assert.equal(disabled.status, 503)
	assert.equal((await disabled.json()).code, 'UPSTREAM_UNAVAILABLE')

	const outsideBeta = await handleAgentCapabilitiesRequest(
		new Request('https://www.letletme.top/api/agent/v1/capabilities'),
		dependencies(authenticated, undefined, {
			env: { ...enabledEnv, AGENT_BETA_USER_IDS: 'user-2,user-3' }
		})
	)
	assert.equal(outsideBeta.status, 403)
	assert.equal((await outsideBeta.json()).code, 'FORBIDDEN')
})

test('a forged body identity never substitutes for a Better Auth session', async () => {
	const response = await handleAgentToolRequest(
		request({ userId: 'user-1', fplEntryId: 123 }),
		'letletme_context',
		dependencies(null)
	)
	assert.equal(response.status, 401)
	assert.deepEqual(await response.json(), {
		code: 'AUTH_REQUIRED',
		message: 'Sign in to LetLetMe to use Agent tools.',
		retryable: false,
		requestId: response.headers.get('x-request-id')
	})
})

test('unknown tools and unknown input fields are rejected', async () => {
	const unknown = await handleAgentToolRequest(
		request({}),
		'letletme_sql',
		dependencies(authenticated)
	)
	assert.equal(unknown.status, 404)
	assert.equal((await unknown.json()).code, 'NOT_FOUND')

	const invalid = await handleAgentToolRequest(
		request({ targetUrl: 'https://attacker.example', authorization: 'secret' }),
		'letletme_context',
		dependencies(authenticated)
	)
	assert.equal(invalid.status, 400)
	assert.equal((await invalid.json()).code, 'INVALID_INPUT')
})

test('tool requests require JSON and enforce the 16 KiB body limit', async () => {
	const wrongType = await handleAgentToolRequest(
		new Request(
			'https://www.letletme.top/api/agent/v1/tools/letletme_context',
			{
				method: 'POST',
				headers: { 'Content-Type': 'text/plain' },
				body: '{}'
			}
		),
		'letletme_context',
		dependencies(authenticated)
	)
	assert.equal(wrongType.status, 415)

	const oversized = await handleAgentToolRequest(
		request({ value: 'x'.repeat(AGENT_MAX_INPUT_BYTES) }),
		'letletme_context',
		dependencies(authenticated)
	)
	assert.equal(oversized.status, 413)
	assert.equal((await oversized.json()).code, 'INVALID_INPUT')
})

test('a successful response carries request, time, revision and warning metadata', async () => {
	const response = await handleAgentToolRequest(
		request({}, { 'X-Request-Id': 'agent-test-123' }),
		'letletme_context',
		dependencies(authenticated)
	)
	assert.equal(response.status, 200)
	assert.equal(response.headers.get('cache-control'), 'no-store, no-transform')
	const body = await response.json()
	assert.equal(body.schemaVersion, '1')
	assert.equal(body.tool, 'letletme_context')
	assert.equal(body.requestId, 'agent-test-123')
	assert.equal(body.asOf, '2026-08-20T01:00:00.000Z')
	assert.deepEqual(body.revisions, {
		season: '2627',
		core: 'core-7',
		market: 'market-4',
		briefing: '3'
	})
	assert.deepEqual(body.warnings, [])
})

test('preseason context and market return published empty coverage without a market snapshot', async () => {
	const preseasonSelection = {
		...contextResult.teamSelectionDesk,
		marketRevision: null,
		phase: 'PRESEASON',
		playerPool: {
			state: 'AVAILABLE',
			checkedAt: '2026-08-20T00:01:00.000Z',
			message: null
		}
	}
	const seen = new Set<string>()
	const execute: AgentGatewayDependencies['execute'] = async document => {
		seen.add(document)
		if (document === CORE_CONTEXT_DOCUMENT) {
			return { coreEventContext: contextResult.coreEventContext }
		}
		if (document === CONTEXT_DOCUMENT) {
			return {
				coreEventContext: contextResult.coreEventContext,
				briefingWeek: contextResult.briefingWeek
			}
		}
		if (document === SELECTION_CONTEXT_DOCUMENT) {
			return { teamSelectionDesk: preseasonSelection }
		}
		throw new Error('Market documents must not run before publication')
	}

	const contextResponse = await handleAgentToolRequest(
		request({}),
		'letletme_context',
		dependencies(authenticated, execute)
	)
	assert.equal(contextResponse.status, 200)
	const contextBody = await contextResponse.json()
	assert.equal(contextBody.data.coverage.market.state, 'NOT_PUBLISHED')
	assert.equal(contextBody.data.coverage.market.rowCount, 0)
	assert.equal(contextBody.revisions.market, undefined)
	assert.ok(
		contextBody.warnings.some(
			(warning: { code: string }) => warning.code === 'MARKET_NOT_PUBLISHED'
		)
	)

	const marketResponse = await handleAgentToolRequest(
		request({}),
		'letletme_market',
		dependencies(authenticated, execute)
	)
	assert.equal(marketResponse.status, 200)
	const marketBody = await marketResponse.json()
	assert.equal(marketBody.data.snapshot, null)
	assert.equal(marketBody.data.lineup, null)
	assert.deepEqual(marketBody.data.ownership.risers, [])
	assert.deepEqual(marketBody.data.pulse.transferMovers, [])
	assert.equal(marketBody.revisions.market, undefined)
	assert.equal(marketBody.warnings[0]?.code, 'MARKET_NOT_PUBLISHED')
	assert.equal(seen.has(MARKET_CONTEXT_DOCUMENT), false)
})

test('preseason player pages use Desk revisions without requiring marketSnapshotContext', async () => {
	const preseasonSelection = {
		...contextResult.teamSelectionDesk,
		marketRevision: null,
		phase: 'PRESEASON'
	}
	const response = await handleAgentToolRequest(
		request({ limit: 1 }),
		'letletme_players',
		dependencies(authenticated, async document => {
			if (document === CORE_CONTEXT_DOCUMENT) {
				return { coreEventContext: contextResult.coreEventContext }
			}
			assert.equal(document, PLAYERS_DOCUMENT)
			assert.doesNotMatch(document, /marketSnapshotContext/)
			return {
				coreEventContext: contextResult.coreEventContext,
				teamSelectionDesk: preseasonSelection,
				playersForPicker: {
					totalCount: 1,
					nextCursor: null,
					items: [
						{
							id: 1,
							webName: 'Alpha',
							team: { id: 1, name: 'Team', shortName: 'T' },
							position: 'MIDFIELDER',
							price: 50,
							selectedByPercent: 5,
							totalPoints: 0,
							form: null
						}
					]
				}
			}
		})
	)
	assert.equal(response.status, 200)
	const body = await response.json()
	assert.equal(body.data.items.length, 1)
	assert.equal(body.revisions.market, undefined)
	assert.ok(
		body.warnings.some(
			(warning: { code: string }) => warning.code === 'MARKET_NOT_PUBLISHED'
		)
	)
})

test('player search remains a GraphQL variable and cannot replace the fixed document', async () => {
	let capturedDocument = ''
	let capturedVariables: Record<string, unknown> = {}
	const response = await handleAgentToolRequest(
		request({ query: 'query Evil { __schema { types { name } } }' }),
		'letletme_players',
		dependencies(authenticated, async (document, variables) => {
			if (document === CORE_CONTEXT_DOCUMENT) {
				return { coreEventContext: contextResult.coreEventContext }
			}
			assert.equal(document, PLAYERS_DOCUMENT)
			capturedDocument = document
			capturedVariables = variables
			return {
				coreEventContext: contextResult.coreEventContext,
				teamSelectionDesk: contextResult.teamSelectionDesk,
				playersForPicker: { totalCount: 0, nextCursor: null, items: [] }
			}
		})
	)
	assert.equal(response.status, 200)
	assert.equal(capturedDocument, PLAYERS_DOCUMENT)
	assert.equal(
		capturedVariables.search,
		'query Evil { __schema { types { name } } }'
	)
	assert.doesNotMatch(capturedDocument, /query Evil/)
})

test('a 100-player page is assembled from production-budgeted GraphQL chunks', async () => {
	const chunkLimits: number[] = []
	const response = await handleAgentToolRequest(
		request({ limit: 100 }),
		'letletme_players',
		dependencies(authenticated, async (document, variables) => {
			if (document === CORE_CONTEXT_DOCUMENT) {
				return { coreEventContext: contextResult.coreEventContext }
			}
			assert.equal(document, PLAYERS_DOCUMENT)
			assert.equal(variables.sort, 'AUTO')
			const limit = variables.limit as number
			const cursor = (variables.cursor as number | null) ?? 0
			chunkLimits.push(limit)
			return {
				coreEventContext: contextResult.coreEventContext,
				teamSelectionDesk: contextResult.teamSelectionDesk,
				playersForPicker: {
					totalCount: 100,
					nextCursor: cursor + limit < 100 ? cursor + limit : null,
					items: Array.from({ length: limit }, (_, index) => ({
						id: cursor + index + 1,
						webName: `Player ${cursor + index + 1}`,
						team: { id: 1, name: 'Team', shortName: 'T' },
						position: 'MIDFIELDER',
						price: 50,
						totalPoints: 0,
						form: 0
					}))
				}
			}
		})
	)
	assert.equal(response.status, 200)
	assert.deepEqual(chunkLimits, [36, 36, 28])
	assert.equal((await response.json()).data.items.length, 100)
})

test('picker cursors expire when the player publication changes', async () => {
	const page = (coreRevision: string, cursor: number | null) => ({
		coreEventContext: {
			...contextResult.coreEventContext,
			revision: coreRevision
		},
		teamSelectionDesk: {
			...contextResult.teamSelectionDesk,
			coreRevision
		},
		playersForPicker: {
			totalCount: 2,
			nextCursor: cursor,
			items: [
				{
					id: 1,
					webName: 'Alpha',
					team: { id: 1, name: 'Team', shortName: 'T' },
					position: 'MIDFIELDER',
					price: 50,
					totalPoints: 0,
					form: 0
				}
			]
		}
	})
	const first = await handleAgentToolRequest(
		request({ limit: 1 }),
		'letletme_players',
		dependencies(authenticated, async document =>
			document === CORE_CONTEXT_DOCUMENT
				? { coreEventContext: page('core-7', 1).coreEventContext }
				: page('core-7', 1)
		)
	)
	const cursor = (await first.json()).page.nextCursor
	const stale = await handleAgentToolRequest(
		request({ limit: 1, cursor }),
		'letletme_players',
		dependencies(authenticated, async document =>
			document === CORE_CONTEXT_DOCUMENT
				? { coreEventContext: page('core-8', null).coreEventContext }
				: page('core-8', null)
		)
	)
	assert.equal(stale.status, 400)
	assert.equal((await stale.json()).code, 'INVALID_INPUT')
})

test('an explicit event selects the revision-bound player catalog', async () => {
	const catalog = (coreRevision: string) => ({
		teamSelectionDesk: {
			season: '2627',
			coreRevision,
			marketRevision: 'market-4',
			checkedAt: '2026-08-20T00:01:00.000Z',
			eventId: 5,
			phase: 'PRE_DEADLINE',
			playerPool: { state: 'READY', checkedAt: null, message: null },
			players: [
				{
					id: 1,
					webName: 'Alpha',
					team: { id: 1, name: 'Team', shortName: 'T' },
					position: 'MIDFIELDER',
					price: 50,
					totalPoints: 10,
					form: 1,
					status: 'a'
				},
				{
					id: 2,
					webName: 'Beta',
					team: { id: 2, name: 'Other', shortName: 'O' },
					position: 'FORWARD',
					price: 60,
					totalPoints: 9,
					form: 1,
					status: 'a'
				}
			]
		}
	})
	const first = await handleAgentToolRequest(
		request({ eventId: 5, limit: 1 }),
		'letletme_players',
		dependencies(authenticated, async (document, variables) => {
			assert.equal(document, PLAYER_CATALOG_DOCUMENT)
			assert.equal(variables.eventId, 5)
			return catalog('core-7')
		})
	)
	assert.equal(first.status, 200)
	const firstBody = await first.json()
	assert.equal(firstBody.data.mode, 'published-catalog')
	assert.ok(firstBody.page.nextCursor)

	const stale = await handleAgentToolRequest(
		request({ eventId: 5, limit: 1, cursor: firstBody.page.nextCursor }),
		'letletme_players',
		dependencies(authenticated, async () => catalog('core-8'))
	)
	assert.equal(stale.status, 400)
	assert.equal((await stale.json()).code, 'INVALID_INPUT')
})

test('AUTO catalog sorting follows the published selection phase', async () => {
	const catalog = (phase: string) => ({
		teamSelectionDesk: {
			season: '2627',
			coreRevision: 'core-7',
			marketRevision: 'market-4',
			checkedAt: '2026-08-20T00:01:00.000Z',
			eventId: 1,
			phase,
			playerPool: { state: 'READY', checkedAt: null, message: null },
			players: [
				{
					id: 1,
					webName: 'Points',
					team: { id: 1, name: 'Team', shortName: 'T' },
					position: 'MIDFIELDER',
					price: 50,
					ownership: 5,
					totalPoints: 20,
					form: 1,
					status: 'a'
				},
				{
					id: 2,
					webName: 'Ownership',
					team: { id: 2, name: 'Other', shortName: 'O' },
					position: 'FORWARD',
					price: 60,
					ownership: 25,
					totalPoints: 10,
					form: 1,
					status: 'a'
				}
			]
		}
	})
	const idsForPhase = async (phase: string) => {
		const response = await handleAgentToolRequest(
			request({ eventId: 1, limit: 2 }),
			'letletme_players',
			dependencies(authenticated, async document => {
				assert.equal(document, PLAYER_CATALOG_DOCUMENT)
				return catalog(phase)
			})
		)
		assert.equal(response.status, 200)
		return (await response.json()).data.items.map(
			(player: { id: number }) => player.id
		)
	}

	assert.deepEqual(await idsForPhase('PRESEASON'), [2, 1])
	assert.deepEqual(await idsForPhase('PRE_DEADLINE'), [1, 2])
})

test('pagination cursors reject negative offsets', () => {
	const cursor = encodeCursor({
		kind: 'players',
		mode: 'catalog',
		key: 'filters',
		value: -1
	})
	assert.throws(
		() =>
			decodeCursor(cursor, {
				kind: 'players',
				mode: 'catalog',
				key: 'filters'
			}),
		(error: unknown) =>
			error instanceof Error &&
			'code' in error &&
			(error as { code: string }).code === 'INVALID_INPUT'
	)
})

test('corrected Briefing stories remain published Agent data', async () => {
	const response = await handleAgentToolRequest(
		request({ slug: 'corrected-story', locale: 'EN' }),
		'letletme_briefing',
		dependencies(authenticated, async document => {
			assert.equal(document, BRIEFING_STORY_DOCUMENT)
			return {
				coreEventContext: contextResult.coreEventContext,
				briefingWeek: contextResult.briefingWeek,
				briefingStory: {
					state: 'CORRECTED',
					canonicalSlug: 'corrected-story',
					story: {
						id: 'story-1',
						slug: 'corrected-story',
						storyRevision: 2,
						sourceCheckedAt: '2026-08-20T00:04:00.000Z'
					}
				}
			}
		})
	)
	assert.equal(response.status, 200)
	const body = await response.json()
	assert.equal(body.data.story.state, 'CORRECTED')
	assert.equal(body.revisions.briefing, '2')
	assert.equal(body.asOf, '2026-08-20T00:04:00.000Z')
	assert.deepEqual(body.warnings, [])
})

test('Briefing envelopes without a story payload are not published', async () => {
	const response = await handleAgentToolRequest(
		request({ slug: 'missing-story', locale: 'EN' }),
		'letletme_briefing',
		dependencies(authenticated, async document => {
			assert.equal(document, BRIEFING_STORY_DOCUMENT)
			return {
				coreEventContext: contextResult.coreEventContext,
				briefingWeek: contextResult.briefingWeek,
				briefingStory: {
					state: 'READY',
					canonicalSlug: 'missing-story',
					story: null
				}
			}
		})
	)
	assert.equal(response.status, 200)
	const body = await response.json()
	assert.equal(body.data.story, null)
	assert.equal(body.warnings[0]?.code, 'BRIEFING_STORY_NOT_PUBLISHED')
})

test('verified-entry extensions must declare the same core revision', async () => {
	const response = await handleAgentToolRequest(
		request({}),
		'letletme_entry',
		dependencies(verified, async document => {
			if (document === ENTRY_SNAPSHOT_DOCUMENT) {
				return {
					coreEventContext: contextResult.coreEventContext,
					entrySnapshot: { id: 123 }
				}
			}
			assert.equal(document, OWN_ENTRY_DOCUMENT)
			return {
				coreEventContext: contextResult.coreEventContext,
				myFplTeamDesk: {
					state: 'READY',
					context: { season: '2627', coreRevision: 'core-6' },
					history: []
				}
			}
		})
	)
	assert.equal(response.status, 503)
	assert.equal((await response.json()).code, 'UPSTREAM_UNAVAILABLE')
})

test('all saved GraphQL operations are queries and never use the side-effectful entry field', () => {
	for (const [name, document] of Object.entries(AGENT_GRAPHQL_DOCUMENTS)) {
		const parsed = parse(document)
		let astNodes = 0
		visit(parsed, { enter: () => void (astNodes += 1) })
		assert.ok(astNodes <= 200, `${name} has ${astNodes} AST nodes`)
		for (const definition of parsed.definitions) {
			if (definition.kind === 'OperationDefinition') {
				assert.equal(definition.operation, 'query', name)
			}
		}
		assert.doesNotMatch(document, /\bmutation\b/i, name)
		assert.doesNotMatch(document, /\bentry\s*\(/, name)
	}
})

test('market projections stay fixed, budgeted and revision coherent', async () => {
	const seen = new Set<string>()
	const response = await handleAgentToolRequest(
		request({ days: 7, ownershipPeriod: 'DAILY', limit: 5 }),
		'letletme_market',
		dependencies(authenticated, async document => {
			const envelope = {
				coreEventContext: contextResult.coreEventContext,
				marketSnapshotContext: contextResult.marketSnapshotContext
			}
			if (document === CORE_CONTEXT_DOCUMENT) {
				return { coreEventContext: contextResult.coreEventContext }
			}
			if (document === SELECTION_CONTEXT_DOCUMENT) {
				return { teamSelectionDesk: contextResult.teamSelectionDesk }
			}
			if (document === MARKET_CONTEXT_DOCUMENT) return envelope
			seen.add(document)
			if (document === MARKET_LINEUP_DOCUMENT) {
				return { ...envelope, marketLineup: { formation: '3-4-3', slots: [] } }
			}
			if (document === MARKET_OWNERSHIP_RISERS_DOCUMENT) {
				return {
					...envelope,
					marketOwnershipOverview: {
						period: 'DAILY',
						coverage: { status: 'READY', complete: true, stale: false },
						risers: []
					}
				}
			}
			if (document === MARKET_OWNERSHIP_FALLERS_DOCUMENT) {
				return {
					...envelope,
					marketOwnershipOverview: {
						period: 'DAILY',
						fallers: []
					}
				}
			}
			if (document === MARKET_PULSE_MOVERS_DOCUMENT) {
				return {
					...envelope,
					marketPulse: {
						coverage: { complete: true, stale: false, observedDays: 7 },
						mostSelected: [],
						transferMovers: []
					}
				}
			}
			assert.equal(document, MARKET_PULSE_UPDATES_DOCUMENT)
			return {
				...envelope,
				marketPulse: {
					availabilityHighlights: [],
					newPlayers: [],
					priceChanges: [],
					availabilityUpdateCount: 0
				}
			}
		})
	)
	assert.equal(response.status, 200)
	assert.deepEqual(
		seen,
		new Set([
			MARKET_LINEUP_DOCUMENT,
			MARKET_OWNERSHIP_RISERS_DOCUMENT,
			MARKET_OWNERSHIP_FALLERS_DOCUMENT,
			MARKET_PULSE_MOVERS_DOCUMENT,
			MARKET_PULSE_UPDATES_DOCUMENT
		])
	)
	const body = await response.json()
	assert.deepEqual(body.revisions, {
		season: '2627',
		core: 'core-7',
		market: 'market-4'
	})
	assert.deepEqual(body.data.pulse.priceChanges, [])
})

test('competition cursors expire when the live standings publication changes', async () => {
	const tournament = {
		id: 9,
		adminEntryId: 123,
		updatedAt: '2026-08-20T00:00:00.000Z',
		standingsReadyAt: '2026-08-19T00:00:00.000Z'
	}
	const envelope = (revision: string) => ({
		coreEventContext: contextResult.coreEventContext,
		liveSnapshot: {
			season: '2627',
			eventId: 1,
			revision,
			state: 'LIVE',
			publishedAt: '2026-08-20T00:00:00.000Z',
			checkedAt: '2026-08-20T00:03:00.000Z'
		},
		tournament
	})
	const availability = (revision: string | null) => ({
		coreEventContext: contextResult.coreEventContext,
		liveContext: {
			season: '2627',
			coreRevision: 'core-7',
			currentEventId: 1,
			liveRevision: revision,
			sourceCheckedAt: '2026-08-20T00:03:00.000Z'
		}
	})
	const first = await handleAgentToolRequest(
		request({ competitionId: 9, eventId: 1, limit: 1 }),
		'letletme_competition',
		dependencies(verified, async (document, variables) => {
			if (document === COMPETITION_AVAILABILITY_DOCUMENT) {
				return availability('11')
			}
			if (document === COMPETITION_CONTEXT_DOCUMENT) return envelope('11')
			assert.equal(document, COMPETITION_DOCUMENT)
			assert.equal(variables.includeLive, true)
			return {
				...envelope('11'),
				tournamentEventResults: [{ entryId: 123 }, { entryId: 456 }]
			}
		})
	)
	assert.equal(first.status, 200)
	const firstBody = await first.json()
	assert.equal(firstBody.asOf, '2026-08-20T00:03:00.000Z')
	assert.ok(firstBody.page.nextCursor)

	let calls = 0
	const stale = await handleAgentToolRequest(
		request({
			competitionId: 9,
			eventId: 1,
			limit: 1,
			cursor: firstBody.page.nextCursor
		}),
		'letletme_competition',
		dependencies(verified, async document => {
			if (document === COMPETITION_AVAILABILITY_DOCUMENT) {
				return availability('12')
			}
			calls += 1
			assert.equal(document, COMPETITION_CONTEXT_DOCUMENT)
			return envelope('12')
		})
	)
	assert.equal(stale.status, 400)
	assert.equal((await stale.json()).code, 'INVALID_INPUT')
	assert.equal(calls, 1)
})

test('preseason competitions return authorized metadata without unpublished results', async () => {
	const preseasonCore = {
		...contextResult.coreEventContext,
		currentEventId: null,
		nextEventId: 1,
		latestFinishedEventId: null
	}
	const tournament = {
		id: 9,
		adminEntryId: 123,
		updatedAt: '2026-08-20T00:00:00.000Z',
		standingsReadyAt: null
	}
	const seen: string[] = []
	const response = await handleAgentToolRequest(
		request({ competitionId: 9, limit: 25 }),
		'letletme_competition',
		dependencies(verified, async (document, variables) => {
			seen.push(document)
			if (document === COMPETITION_AVAILABILITY_DOCUMENT) {
				return {
					coreEventContext: preseasonCore,
					liveContext: {
						season: '2627',
						coreRevision: 'core-7',
						currentEventId: null,
						liveRevision: null,
						sourceCheckedAt: null
					}
				}
			}
			assert.equal(document, COMPETITION_CONTEXT_DOCUMENT)
			assert.equal(variables.includeLive, false)
			return {
				coreEventContext: preseasonCore,
				tournament
			}
		})
	)
	assert.equal(response.status, 200)
	const body = await response.json()
	assert.deepEqual(body.data.results, [])
	assert.equal(body.page.nextCursor, null)
	assert.deepEqual(
		body.warnings.map((warning: { code: string }) => warning.code),
		['COMPETITION_RESULTS_NOT_PUBLISHED']
	)
	assert.deepEqual(seen, [
		COMPETITION_AVAILABILITY_DOCUMENT,
		COMPETITION_CONTEXT_DOCUMENT
	])
})

test('current competitions wait for the actual live publication revision', async () => {
	const tournament = {
		id: 9,
		adminEntryId: 123,
		updatedAt: '2026-08-20T00:00:00.000Z',
		standingsReadyAt: null
	}
	const liveContexts = [
		null,
		{
			season: '2627',
			coreRevision: 'core-7',
			currentEventId: 1,
			liveRevision: null,
			sourceCheckedAt: null
		}
	]
	for (const liveContext of liveContexts) {
		const seen: string[] = []
		const response = await handleAgentToolRequest(
			request({ competitionId: 9, limit: 25 }),
			'letletme_competition',
			dependencies(verified, async (document, variables) => {
				seen.push(document)
				if (document === COMPETITION_AVAILABILITY_DOCUMENT) {
					return {
						coreEventContext: contextResult.coreEventContext,
						liveContext
					}
				}
				assert.equal(document, COMPETITION_CONTEXT_DOCUMENT)
				assert.equal(variables.includeLive, false)
				return {
					coreEventContext: contextResult.coreEventContext,
					tournament
				}
			})
		)
		assert.equal(response.status, 200)
		const body = await response.json()
		assert.deepEqual(body.data.results, [])
		assert.equal(body.warnings[0]?.code, 'COMPETITION_RESULTS_NOT_PUBLISHED')
		assert.deepEqual(seen, [
			COMPETITION_AVAILABILITY_DOCUMENT,
			COMPETITION_CONTEXT_DOCUMENT
		])
	}
})

test('unverified accounts cannot request self or competition extensions', async () => {
	const own = await handleAgentToolRequest(
		request({}),
		'letletme_entry',
		dependencies(authenticated)
	)
	assert.equal(own.status, 403)
	assert.equal((await own.json()).code, 'FPL_VERIFICATION_REQUIRED')

	const competition = await handleAgentToolRequest(
		request({ competitionId: 9, eventId: 1 }),
		'letletme_competition',
		dependencies(authenticated)
	)
	assert.equal(competition.status, 403)
	assert.equal((await competition.json()).code, 'FPL_VERIFICATION_REQUIRED')
})

test('an explicit entry ID is always a public snapshot and cannot select an event', async () => {
	let capturedDocument = ''
	const publicSnapshot = await handleAgentToolRequest(
		request({ entryId: 123 }),
		'letletme_entry',
		dependencies(verified, async document => {
			capturedDocument = document
			return {
				coreEventContext: contextResult.coreEventContext,
				entrySnapshot: { id: 123, entryName: 'Persisted entry' }
			}
		})
	)
	assert.equal(publicSnapshot.status, 200)
	assert.equal(capturedDocument, ENTRY_SNAPSHOT_DOCUMENT)
	assert.equal((await publicSnapshot.json()).data.accessScope, 'public')

	const invalid = await handleAgentToolRequest(
		request({ entryId: 123, eventId: 1 }),
		'letletme_entry',
		dependencies(verified)
	)
	assert.equal(invalid.status, 400)
	assert.equal((await invalid.json()).code, 'INVALID_INPUT')
})

test('missing competition membership is denied without revealing existence', async () => {
	const response = await handleAgentToolRequest(
		request({ competitionId: 9, eventId: 1 }),
		'letletme_competition',
		dependencies(verified, async document => {
			if (document === COMPETITION_AVAILABILITY_DOCUMENT) {
				return {
					coreEventContext: contextResult.coreEventContext,
					liveContext: {
						season: '2627',
						coreRevision: 'core-7',
						currentEventId: 1,
						liveRevision: '11',
						sourceCheckedAt: '2026-08-20T00:03:00.000Z'
					}
				}
			}
			assert.equal(document, COMPETITION_CONTEXT_DOCUMENT)
			return {
				coreEventContext: contextResult.coreEventContext,
				liveSnapshot: {
					season: '2627',
					eventId: 1,
					revision: '11',
					checkedAt: '2026-08-20T00:03:00.000Z'
				},
				tournament: null
			}
		})
	)
	assert.equal(response.status, 403)
	assert.equal((await response.json()).code, 'FORBIDDEN')
})

test('competition authorization failures, rate limits and timeouts are normalized', async () => {
	for (const [upstream, expectedStatus, expectedCode] of [
		[
			new GraphQLRequestError('Forbidden', { status: 403, code: 'FORBIDDEN' }),
			403,
			'FORBIDDEN'
		],
		[
			new GraphQLRequestError('Slow down', {
				status: 429,
				code: 'RATE_LIMITED',
				retryAfterSeconds: 7
			}),
			429,
			'RATE_LIMITED'
		],
		[
			new GraphQLRequestError('Timed out', { code: 'REQUEST_TIMEOUT' }),
			503,
			'UPSTREAM_TIMEOUT'
		]
	] as const) {
		const response = await handleAgentToolRequest(
			request({ competitionId: 9, eventId: 1 }),
			'letletme_competition',
			dependencies(verified, async () => {
				throw upstream
			})
		)
		assert.equal(response.status, expectedStatus)
		assert.equal((await response.json()).code, expectedCode)
		if (expectedStatus === 429)
			assert.equal(response.headers.get('retry-after'), '7')
	}
})

test('one deadline bounds the complete tool execution and aborts its shared signal', async () => {
	let aborted = false
	const startedAt = performance.now()
	const response = await handleAgentToolRequest(
		request({}),
		'letletme_context',
		dependencies(
			authenticated,
			async (_document, _variables, _requestId, signal) =>
				new Promise((_resolve, reject) => {
					const onAbort = () => {
						aborted = true
						reject(
							new GraphQLRequestError('Cancelled', {
								code: 'REQUEST_CANCELLED'
							})
						)
					}
					if (signal?.aborted) onAbort()
					else signal?.addEventListener('abort', onAbort, { once: true })
				}),
			{ upstreamTimeoutMs: 10 }
		)
	)
	assert.equal(response.status, 503)
	assert.equal((await response.json()).code, 'UPSTREAM_TIMEOUT')
	assert.equal(aborted, true)
	assert.ok(performance.now() - startedAt < 500)
})

test('an aggregate tool failure aborts sibling GraphQL requests', async () => {
	let calls = 0
	let siblingAborts = 0
	const response = await handleAgentToolRequest(
		request({}),
		'letletme_market',
		dependencies(
			authenticated,
			async (document, _variables, _requestId, signal) => {
				if (document === CORE_CONTEXT_DOCUMENT) {
					return { coreEventContext: contextResult.coreEventContext }
				}
				if (document === SELECTION_CONTEXT_DOCUMENT) {
					return { teamSelectionDesk: contextResult.teamSelectionDesk }
				}
				if (document === MARKET_CONTEXT_DOCUMENT) {
					return {
						coreEventContext: contextResult.coreEventContext,
						marketSnapshotContext: contextResult.marketSnapshotContext
					}
				}
				calls += 1
				if (calls === 1) {
					throw new GraphQLRequestError('Upstream failed', { status: 502 })
				}
				return new Promise((_resolve, reject) => {
					const onAbort = () => {
						siblingAborts += 1
						reject(
							new GraphQLRequestError('Cancelled', {
								code: 'REQUEST_CANCELLED'
							})
						)
					}
					if (signal?.aborted) onAbort()
					else signal?.addEventListener('abort', onAbort, { once: true })
				})
			}
		)
	)
	assert.equal(response.status, 503)
	assert.equal(calls, 5)
	assert.equal(siblingAborts, 4)
})

test('encoded results over 64 KiB return an error instead of truncated JSON', async () => {
	const hugeName = 'x'.repeat(2000)
	const response = await handleAgentToolRequest(
		request({ limit: 50 }),
		'letletme_players',
		dependencies(authenticated, async document => {
			if (document === CORE_CONTEXT_DOCUMENT) {
				return { coreEventContext: contextResult.coreEventContext }
			}
			return {
				coreEventContext: contextResult.coreEventContext,
				teamSelectionDesk: contextResult.teamSelectionDesk,
				playersForPicker: {
					totalCount: 50,
					nextCursor: null,
					items: Array.from({ length: 50 }, (_, index) => ({
						id: index + 1,
						webName: hugeName,
						position: 'MIDFIELDER',
						price: 50,
						selectedByPercent: 1,
						totalPoints: 0,
						form: 0,
						team: { id: 1, name: 'Team', shortName: 'T' }
					}))
				}
			}
		})
	)
	assert.equal(response.status, 413)
	assert.equal((await response.json()).code, 'RESULT_TOO_LARGE')
})

test('gateway logs contain only bounded metadata and an anonymous user hash', async () => {
	const logs: AgentGatewayLog[] = []
	const response = await handleAgentToolRequest(
		request({}),
		'letletme_context',
		dependencies(authenticated, undefined, { log: record => logs.push(record) })
	)
	assert.equal(response.status, 200)
	assert.equal(logs.length, 1)
	assert.deepEqual(Object.keys(logs[0]!).sort(), [
		'durationMs',
		'event',
		'inputBytes',
		'outputBytes',
		'requestId',
		'revisions',
		'status',
		'tool',
		'userHash'
	])
	assert.match(logs[0]!.userHash ?? '', /^[a-f0-9]{24}$/)
	assert.doesNotMatch(JSON.stringify(logs[0]), /user-1|test-proxy-secret/)
})
