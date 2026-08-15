import assert from 'node:assert/strict'
import test from 'node:test'

import {
	isEdgeOneRecord,
	isFallbackRecord,
	parseState,
	runCheck
} from '../src/index.js'

const baseEnv = {
	WATCHDOG_ENABLED: 'true',
	ZONE_ID: 'zone',
	DNS_RECORD_ID: 'record',
	CLOUDFLARE_API_TOKEN: 'token',
	APEX_NAME: 'letletme.top',
	EDGEONE_CNAME_TARGET: 'edge.example.com',
	VERCEL_FALLBACK_A: '76.76.21.21',
	EDGEONE_HEALTH_URL: 'https://letletme.top/healthz',
	VERCEL_HEALTH_URL: 'https://letletme-web.vercel.app/healthz',
	FAILOVER_STATE: null
}

function makeEnv(saved = null) {
	const writes = []
	const env = {
		...baseEnv,
		FAILOVER_STATE: {
			async get() { return saved },
			async put(_key, value) { writes.push(JSON.parse(value)) }
		}
	}
	env.writes = writes
	return env
}

function health(edge) {
	return new Response(JSON.stringify({ status: 'ok', origin: 'vercel' }), {
		status: 200,
		headers: edge ? { 'X-Letletme-Edge': 'edgeone' } : undefined
	})
}

function fakeFetchFactory({ record, edgeResponses = [], vercelResponse = health(false) }) {
	const calls = []
	return {
		calls,
		fetch: async (input, init = {}) => {
			const url = String(input)
			calls.push({ url, init })
			if (url.includes('/dns_records/')) {
				if (init.method === 'PUT') {
					const body = JSON.parse(init.body)
					return Response.json({ success: true, result: { ...body, id: 'record' } })
				}
				return Response.json({ success: true, result: record })
			}
			if (url === 'https://letletme.top/healthz') {
				return edgeResponses.shift() || health(false)
			}
			return vercelResponse
		}
	}
}

test('recognizes only the exact EdgeOne and fallback records', () => {
	const env = baseEnv
	assert.equal(isEdgeOneRecord({ type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false }, env), true)
	assert.equal(isEdgeOneRecord({ type: 'CNAME', name: 'letletme.top', content: 'attacker.example.com', proxied: false }, env), false)
	assert.equal(isFallbackRecord({ type: 'A', name: 'letletme.top', content: '76.76.21.21', proxied: true }, env), true)
	assert.equal(isFallbackRecord({ type: 'A', name: 'letletme.top', content: '76.76.21.21', proxied: false }, env), false)
})

test('requires three consecutive EdgeOne failures before one DNS update', async () => {
	const env = makeEnv()
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false }
	const { fetch, calls } = fakeFetchFactory({ record: edgeRecord, edgeResponses: [new Response('', { status: 503 })] })
	const first = await runCheck(env, { fetchImpl: fetch })
	assert.equal(first.action, 'counted-failure')
	assert.equal(calls.filter(call => call.init.method === 'PUT').length, 0)
	assert.equal(env.writes.at(-1).failureCount, 1)

	const saved = JSON.stringify(env.writes.at(-1))
	const secondEnv = makeEnv(saved)
	const secondFetch = fakeFetchFactory({ record: edgeRecord, edgeResponses: [new Response('', { status: 503 })] })
	const second = await runCheck(secondEnv, { fetchImpl: secondFetch.fetch })
	assert.equal(second.action, 'counted-failure')
	assert.equal(secondEnv.writes.at(-1).failureCount, 2)

	const thirdEnv = makeEnv(JSON.stringify(secondEnv.writes.at(-1)))
	const thirdFetch = fakeFetchFactory({ record: edgeRecord, edgeResponses: [new Response('', { status: 503 })] })
	const third = await runCheck(thirdEnv, { fetchImpl: thirdFetch.fetch })
	assert.equal(third.action, 'fallback-applied')
	assert.equal(thirdFetch.calls.filter(call => call.init.method === 'PUT').length, 1)
})

test('does not change DNS when Vercel is also unhealthy', async () => {
	const env = makeEnv()
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false },
		edgeResponses: [new Response('', { status: 503 })],
		vercelResponse: new Response('', { status: 503 })
	})
	const result = await runCheck(env, { fetchImpl: fetch })
	assert.equal(result.action, 'both-unhealthy')
	assert.equal(calls.some(call => call.init.method === 'PUT'), false)
})

test('does not overwrite a manually changed DNS record', async () => {
	const env = makeEnv()
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'manual.example.com', proxied: false }
	})
	const result = await runCheck(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.some(call => call.init.method === 'PUT'), false)
})

test('is idempotent once fallback is active', async () => {
	const env = makeEnv(JSON.stringify({ failureCount: 3, fallbackActive: true }))
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'A', name: 'letletme.top', content: '76.76.21.21', proxied: true }
	})
	const result = await runCheck(env, { fetchImpl: fetch })
	assert.equal(result.action, 'already-fallback')
	assert.equal(calls.some(call => call.init.method === 'PUT'), false)
})

test('invalid persisted state is safely reset', () => {
	assert.deepEqual(parseState('{not-json'), {
		failureCount: 0,
		fallbackActive: false,
		lastFailureAt: null,
		lastAction: null,
		lastAlertKey: null
	})
})
