const assert = require('node:assert/strict')
const test = require('node:test')

let helpers
test.before(async () => {
	helpers = await import('../scripts/load-agent-gateway.mjs')
})

test('agent load settings require explicit safe targets and private cookie input', () => {
	const { resolveEndpoint, resolveLoadCookies } = helpers
	assert.equal(
		resolveEndpoint('https://letletme.top').href,
		'https://letletme.top/api/agent/v1/tools/letletme_context'
	)
	assert.equal(
		resolveEndpoint('http://127.0.0.1:3000').href,
		'http://127.0.0.1:3000/api/agent/v1/tools/letletme_context'
	)
	assert.throws(() => resolveEndpoint('http://example.com'), /must use HTTPS/)
	assert.throws(() => resolveLoadCookies({}), /Set AGENT_LOAD_COOKIE/)
	assert.deepEqual(
		resolveLoadCookies({ AGENT_LOAD_COOKIE: ' session=value ' }),
		['session=value']
	)
	assert.deepEqual(
		resolveLoadCookies({ AGENT_LOAD_COOKIES_JSON: '["a=1","b=2"]' }),
		['a=1', 'b=2']
	)
})

test('agent load helpers validate numbers and report expected 429s separately', () => {
	const { nextRequestDelayMs, parsePositiveInteger, percentile, summarize } =
		helpers
	assert.equal(parsePositiveInteger(undefined, 20, 'clients'), 20)
	assert.equal(parsePositiveInteger('3', 20, 'clients'), 3)
	assert.throws(
		() => parsePositiveInteger('0', 20, 'clients'),
		/positive integer/
	)
	assert.equal(percentile([30, 10, 20], 0.5), 20)
	assert.equal(nextRequestDelayMs(5_000, 7_001), 1_000)
	assert.equal(nextRequestDelayMs(6_001, 7_001), null)

	const summary = summarize(
		[
			{ status: 200, bodyValid: true, durationMs: 10 },
			{ status: 429, bodyValid: true, durationMs: 20 },
			{ status: 503, bodyValid: false, durationMs: 30 },
			{ status: null, bodyValid: true, durationMs: 40 }
		],
		10,
		20,
		2
	)
	assert.deepEqual(summary.statusCounts, { 200: 1, 429: 1, 503: 1 })
	assert.equal(summary.networkErrors, 1)
	assert.equal(summary.invalidBodies, 1)
	assert.equal(summary.unexpectedStatuses, 1)
	assert.equal(summary.unexpectedErrorRate, 0.5)
	assert.deepEqual(summary.latencyMs, { p50: 20, p95: 40, max: 40 })
})

test('agent load runner spreads clients across opaque sessions without exposing cookies', async () => {
	const { runLoadTest } = helpers
	const seenCookies = []
	const summary = await runLoadTest({
		endpoint: new URL(
			'https://letletme.top/api/agent/v1/tools/letletme_context'
		),
		cookies: ['session=one', 'session=two'],
		clients: 2,
		durationSeconds: 1,
		fetcher: async (_url, options) => {
			seenCookies.push(options.headers.Cookie)
			return Response.json({ schemaVersion: '1', tool: 'letletme_context' })
		}
	})
	assert.deepEqual(seenCookies.sort(), ['session=one', 'session=two'])
	assert.equal(summary.requests, 2)
	assert.equal(summary.unexpectedErrorRate, 0)
	assert.doesNotMatch(JSON.stringify(summary), /session=/)
})

test('agent load runner aborts and records a stalled request', async () => {
	const { runLoadTest } = helpers
	const startedAt = performance.now()
	const summary = await runLoadTest({
		endpoint: new URL(
			'https://letletme.top/api/agent/v1/tools/letletme_context'
		),
		cookies: ['session=opaque'],
		clients: 1,
		durationSeconds: 0.02,
		requestTimeoutMs: 5,
		fetcher: async (_url, options) =>
			new Promise((_resolve, reject) => {
				const onAbort = () => reject(new Error('aborted'))
				if (options.signal.aborted) onAbort()
				else options.signal.addEventListener('abort', onAbort, { once: true })
			})
	})
	assert.equal(summary.requests, 1)
	assert.equal(summary.networkErrors, 1)
	assert.equal(summary.unexpectedErrorRate, 1)
	assert.ok(performance.now() - startedAt < 500)
})
