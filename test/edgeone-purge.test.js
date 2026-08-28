const assert = require('node:assert/strict')
const test = require('node:test')

test('builds a delete purge for only the managed static prefixes', async () => {
	const { STATIC_PURGE_TARGETS, buildPurgePayload } = await import(
		'../ops/release/edgeone-purge.mjs'
	)
	assert.deepEqual(buildPurgePayload('zone-test'), {
		Targets: [...STATIC_PURGE_TARGETS],
		Type: 'purge_prefix',
		Method: 'delete',
		ZoneId: 'zone-test'
	})
})

test('provides a non-existent target for authorization preflight', async () => {
	const { PURGE_AUTHORIZATION_PROBE_TARGET, buildPurgePayload } = await import(
		'../ops/release/edgeone-purge.mjs'
	)
	assert.match(
		PURGE_AUTHORIZATION_PROBE_TARGET,
		/^https:\/\/eo-personal-canary\.letletme\.top\//
	)
	assert.deepEqual(buildPurgePayload('zone-test', [PURGE_AUTHORIZATION_PROBE_TARGET]), {
		Targets: [PURGE_AUTHORIZATION_PROBE_TARGET],
		Type: 'purge_prefix',
		Method: 'delete',
		ZoneId: 'zone-test'
	})
})

test('creates a signed purge task without exposing credential values', async () => {
	const { createPurgeTask } = await import('../ops/release/edgeone-purge.mjs')
	let request
	const result = await createPurgeTask({
		zoneId: 'zone-test',
		secretId: 'secret-id-test',
		secretKey: 'secret-key-test',
		timestamp: 1770000000,
		fetchImpl: async (url, options) => {
			request = { url, options }
			return new Response(
				JSON.stringify({
					Response: {
						JobId: 'job-test',
						FailedList: [],
						RequestId: 'request-test'
					}
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		}
	})

	assert.deepEqual(result, {
		jobId: 'job-test',
		failedList: [],
		requestId: 'request-test'
	})
	assert.equal(request.url, 'https://teo.tencentcloudapi.com/')
	assert.equal(request.options.method, 'POST')
	assert.equal(request.options.headers['X-TC-Action'], 'CreatePurgeTask')
	assert.match(request.options.headers.Authorization, /^TC3-HMAC-SHA256 /)
	const body = JSON.parse(request.options.body)
	assert.equal(body.Type, 'purge_prefix')
	assert.equal(body.Method, 'delete')
	assert.deepEqual(body.Targets, [
		'https://letletme.top/_next/static/',
		'https://eo-personal-canary.letletme.top/_next/static/'
	])
})
