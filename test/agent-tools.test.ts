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
	PLAYER_CATALOG_DOCUMENT,
	PLAYERS_DOCUMENT
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
import { parse } from 'graphql'

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

const request = (body: unknown, headers: Record<string, string> = {}): Request =>
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
		new Request('https://www.letletme.top/api/agent/v1/tools/letletme_context', {
			method: 'POST',
			headers: { 'Content-Type': 'text/plain' },
			body: '{}'
		}),
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

test('player search remains a GraphQL variable and cannot replace the fixed document', async () => {
	let capturedDocument = ''
	let capturedVariables: Record<string, unknown> = {}
	const response = await handleAgentToolRequest(
		request({ query: 'query Evil { __schema { types { name } } }' }),
		'letletme_players',
		dependencies(authenticated, async (document, variables) => {
			capturedDocument = document
			capturedVariables = variables
			return {
				coreEventContext: contextResult.coreEventContext,
				marketSnapshotContext: contextResult.marketSnapshotContext,
				playersForPicker: { totalCount: 0, nextCursor: null, items: [] }
			}
		})
	)
	assert.equal(response.status, 200)
	assert.equal(capturedDocument, PLAYERS_DOCUMENT)
	assert.equal(capturedVariables.search, 'query Evil { __schema { types { name } } }')
	assert.doesNotMatch(capturedDocument, /query Evil/)
})

test('an explicit event selects the revision-bound player catalog', async () => {
	const catalog = (coreRevision: string) => ({
		teamSelectionDesk: {
			season: '2627',
			coreRevision,
			marketRevision: 'market-4',
			checkedAt: '2026-08-20T00:01:00.000Z',
			eventId: 5,
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

test('pagination cursors reject negative offsets', () => {
	const cursor = encodeCursor({ kind: 'players', mode: 'catalog', key: 'filters', value: -1 })
	assert.throws(
		() => decodeCursor(cursor, { kind: 'players', mode: 'catalog', key: 'filters' }),
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
					story: { id: 'story-1', slug: 'corrected-story', storyRevision: 2 }
				}
			}
		})
	)
	assert.equal(response.status, 200)
	const body = await response.json()
	assert.equal(body.data.story.state, 'CORRECTED')
	assert.deepEqual(body.warnings, [])
})

test('all saved GraphQL operations are queries and never use the side-effectful entry field', () => {
	for (const [name, document] of Object.entries(AGENT_GRAPHQL_DOCUMENTS)) {
		const parsed = parse(document)
		for (const definition of parsed.definitions) {
			if (definition.kind === 'OperationDefinition') {
				assert.equal(definition.operation, 'query', name)
			}
		}
		assert.doesNotMatch(document, /\bmutation\b/i, name)
		assert.doesNotMatch(document, /\bentry\s*\(/, name)
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

test('competition authorization failures, rate limits and timeouts are normalized', async () => {
	for (const [upstream, expectedStatus, expectedCode] of [
		[new GraphQLRequestError('Forbidden', { status: 403, code: 'FORBIDDEN' }), 403, 'FORBIDDEN'],
		[
			new GraphQLRequestError('Slow down', {
				status: 429,
				code: 'RATE_LIMITED',
				retryAfterSeconds: 7
			}),
			429,
			'RATE_LIMITED'
		],
		[new GraphQLRequestError('Timed out', { code: 'REQUEST_TIMEOUT' }), 504, 'UPSTREAM_TIMEOUT']
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
		if (expectedStatus === 429) assert.equal(response.headers.get('retry-after'), '7')
	}
})

test('encoded results over 64 KiB return an error instead of truncated JSON', async () => {
	const hugeName = 'x'.repeat(2000)
	const response = await handleAgentToolRequest(
		request({ limit: 50 }),
		'letletme_players',
		dependencies(authenticated, async () => ({
			coreEventContext: contextResult.coreEventContext,
			marketSnapshotContext: contextResult.marketSnapshotContext,
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
		}))
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
