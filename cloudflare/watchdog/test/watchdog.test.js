import assert from 'node:assert/strict'
import test from 'node:test'

import {
	isEdgeOneRecord,
	isFallbackRecord,
	isDefaultVercelRecord,
	hasReleaseParity,
	parseState,
	runCheck,
	FailoverCoordinator
} from '../src/index.js'

const baseEnv = {
	WATCHDOG_ENABLED: 'true',
	DNSPOD_SECRET_ID: 'secret-id',
	DNSPOD_SECRET_KEY: 'secret-key',
	DNSPOD_DOMAIN: 'letletme.top',
	DNSPOD_EDGEONE_RECORD_ID: '123',
	DNSPOD_EDGEONE_CNAME: 'edge.example.com',
	DNSPOD_EDGEONE_LINE: '境内',
	DNSPOD_DEFAULT_VERCEL_A: '76.76.21.21',
	DNSPOD_DEFAULT_VERCEL_LINE: '默认',
	EDGEONE_TENCENT_HEALTH_URL: 'https://eo-tencent-canary.letletme.top/healthz',
	EDGEONE_VERCEL_API_URL: 'https://eo-vercel-canary.letletme.top/api/graphql',
	VERCEL_HEALTH_URL: 'https://vercel-origin.letletme.top/healthz',
	FAILOVER_STATE: null
}

const RELEASE_SHA = 'a'.repeat(40)

function makeCoordinator(failureCount = 0) {
	return {
		failureCount,
		claimed: false,
		claimToken: null,
		async recordFailure() {
			if (this.claimed) return { failureCount: this.failureCount, shouldFailover: false, claimHeld: true, claimToken: null }
			this.failureCount = Math.min(3, this.failureCount + 1)
			if (this.failureCount >= 3) {
				this.claimed = true
				this.claimToken = 'test-claim-token'
			}
			return {
				failureCount: this.failureCount,
				shouldFailover: this.failureCount >= 3,
				claimHeld: false,
				claimToken: this.claimToken
			}
		},
		async reset() { this.failureCount = 0; this.claimed = false; this.claimToken = null; return { failureCount: 0 } },
		async release() { this.claimed = false; this.claimToken = null; return { failureCount: this.failureCount } },
		async confirm() { this.failureCount = 0; this.claimed = false; this.claimToken = null; return { failureCount: 0 } },
		async confirmClaim(claimToken) {
			return { claimed: this.claimed && claimToken === this.claimToken, failureCount: this.failureCount }
		}
	}
}

function makeEnv(saved = null, coordinator = makeCoordinator()) {
	const writes = []
	const env = {
		...baseEnv,
		FAILOVER_STATE: {
			async get() { return saved },
			async put(_key, value) { writes.push(JSON.parse(value)) }
		}
	}
	env.writes = writes
	env.coordinator = coordinator
	return env
}

function runCheckWithTestCoordinator(env, options) {
	return runCheck(env, { ...options, coordinator: env.coordinator })
}

function health(edge, release = RELEASE_SHA) {
	return new Response(JSON.stringify({ status: 'ok', origin: edge ? 'tencent' : 'vercel', release }), {
		status: 200,
		headers: {
			'X-Letletme-Release': release,
			...(edge ? { 'X-Letletme-Edge': 'edgeone' } : {})
		}
	})
}

function graphqlHealth() {
	return new Response(JSON.stringify({ data: { __typename: 'Query' } }), {
		status: 200,
		headers: {
			'X-Letletme-Edge': 'edgeone',
			'X-Letletme-Origin': 'vercel',
			'X-Letletme-Release': RELEASE_SHA
		}
	})
}

function fakeFetchFactory({
	record,
	records,
	regionalRecords,
	regionalRecordsAfterDisable,
	regionalRecordsPages,
	defaultRecord,
	defaultRecords,
	defaultRecordsPages,
	defaultRecordsSequence,
	modifyResponses = [],
	edgeResponses = [],
	edgeVercelResponses = [],
	vercelResponse = health(false),
	telegramResponses = []
}) {
	const calls = []
	const dnsRecords = (records ? [...records] : [record]).map(toDnsRecord)
	const regionalRecordList = regionalRecords?.map(toDnsRecord) || null
	const regionalRecordListAfterDisable = regionalRecordsAfterDisable?.map(toDnsRecord) || null
	const regionalRecordPages = regionalRecordsPages?.map(page => page.map(toDnsRecord)) || null
	const defaultRecordPages = defaultRecordsPages?.map(page => page.map(toDnsRecord)) || null
	const defaultRecordSequence = defaultRecordsSequence?.map(records => records.map(toDnsRecord)) || null
	let currentRecord = dnsRecords[0] || null
	let regionalDisabled = false
	let defaultDescribeCount = 0
	const fallbackRecord = toDnsRecord(defaultRecord ?? {
		RecordId: 456,
		Name: '@',
		Type: 'A',
		Value: '76.76.21.21',
		Line: '默认',
		Status: 'ENABLE'
	})
	return {
		calls,
		fetch: async (input, init = {}) => {
			const url = String(input)
			const action = init.headers?.['X-TC-Action'] || init.headers?.['x-tc-action']
			calls.push({ url, init, action })
			if (url === 'https://dnspod.tencentcloudapi.com/') {
				if (action === 'DescribeRecordList') {
					const body = JSON.parse(init.body)
					if (body.RecordLine === '默认') {
						if (defaultRecordPages) {
							const page = defaultRecordPages[Math.floor(Number(body.Offset || 0) / 100)] || []
							const total = defaultRecordPages.reduce((count, records) => count + records.length, 0)
							return Response.json({ Response: { RecordList: page, RecordCountInfo: { TotalCount: total } } })
						}
						const records = defaultRecordSequence
							? (defaultRecordSequence[Math.min(defaultDescribeCount++, defaultRecordSequence.length - 1)] || [])
							: defaultRecords
								? defaultRecords.map(toDnsRecord)
							: fallbackRecord
								? [fallbackRecord]
								: []
						return Response.json({ Response: { RecordList: records } })
					}
					if (regionalRecordPages) {
						const page = regionalRecordPages[Math.floor(Number(body.Offset || 0) / 100)] || []
						const total = regionalRecordPages.reduce((count, records) => count + records.length, 0)
						return Response.json({ Response: { RecordList: page, RecordCountInfo: { TotalCount: total } } })
					}
					if (regionalRecordList || regionalRecordListAfterDisable) {
						const selectedRecords = regionalDisabled && regionalRecordListAfterDisable
							? regionalRecordListAfterDisable
							: regionalRecordList || (currentRecord ? [currentRecord] : [])
						return Response.json({ Response: { RecordList: selectedRecords } })
					}
					const next = dnsRecords.length > 0 ? dnsRecords.shift() : currentRecord
					if (next) currentRecord = next
					return Response.json({ Response: { RecordList: next ? [next] : [] } })
				}
				if (action === 'ModifyRecordStatus') {
					const response = modifyResponses.shift()
					if (response) return response
					const body = JSON.parse(init.body)
					if (currentRecord) currentRecord.Status = body.Status
					regionalDisabled = body.Status === 'DISABLE'
					return Response.json({ Response: { RecordId: body.RecordId } })
				}
			}
			if (url.startsWith('https://api.telegram.org/')) {
				return telegramResponses.shift() || new Response('', { status: 200 })
			}
			if (url === 'https://eo-tencent-canary.letletme.top/healthz') {
				return edgeResponses.shift() || health(false)
			}
			if (url === 'https://eo-vercel-canary.letletme.top/api/graphql') {
				return edgeVercelResponses.shift() || graphqlHealth()
			}
			return vercelResponse
		}
	}
}

function toDnsRecord(record) {
	if (!record) return null
	return {
		RecordId: Number(record.RecordId ?? record.id ?? 123),
		Name: record.Name ?? (record.name === 'letletme.top' ? '@' : record.name ?? '@'),
		Type: record.Type ?? record.type ?? 'CNAME',
		Value: record.Value ?? record.content ?? 'edge.example.com',
		Line: record.Line ?? '境内',
		Status: record.Status ?? (record.proxied === false ? 'ENABLE' : 'DISABLE')
	}
}

test('requires all watchdog probes to report the same full release SHA', () => {
	assert.equal(
		hasReleaseParity(
			{ release: RELEASE_SHA },
			{ release: RELEASE_SHA },
			{ release: RELEASE_SHA }
		),
		true
	)
	assert.equal(
		hasReleaseParity(
			{ release: RELEASE_SHA },
			{ release: 'b'.repeat(40) },
			{ release: RELEASE_SHA }
		),
		false
	)
	assert.equal(hasReleaseParity({ release: 'short' }, { release: 'short' }), false)
})

test('recognizes only the exact EdgeOne and fallback records', () => {
	const env = baseEnv
	assert.equal(isEdgeOneRecord(toDnsRecord({ content: 'edge.example.com', proxied: false }), env), true)
	assert.equal(isEdgeOneRecord(toDnsRecord({ content: 'attacker.example.com', proxied: false }), env), false)
	assert.equal(isFallbackRecord(toDnsRecord({ content: 'edge.example.com', Status: 'DISABLE' }), env), true)
	assert.equal(isFallbackRecord(toDnsRecord({ content: 'edge.example.com', Status: 'ENABLE' }), env), false)
	assert.equal(isDefaultVercelRecord(toDnsRecord({ Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE' }), env), true)
	assert.equal(isDefaultVercelRecord(toDnsRecord({ Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'DISABLE' }), env), false)
})

test('requires three consecutive EdgeOne failures before one DNS update', async () => {
	const coordinator = makeCoordinator()
	const env = makeEnv(null, coordinator)
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false }
	const { fetch, calls } = fakeFetchFactory({ record: edgeRecord, edgeResponses: [new Response('', { status: 503 })] })
	const first = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(first.action, 'counted-failure')
	assert.equal(calls.filter(call => call.action === 'ModifyRecordStatus').length, 0)
	assert.equal(env.writes.at(-1).failureCount, 1)

	const saved = JSON.stringify(env.writes.at(-1))
	const secondEnv = makeEnv(saved, coordinator)
	const secondFetch = fakeFetchFactory({ record: edgeRecord, edgeResponses: [new Response('', { status: 503 })] })
	const second = await runCheckWithTestCoordinator(secondEnv, { fetchImpl: secondFetch.fetch })
	assert.equal(second.action, 'counted-failure')
	assert.equal(secondEnv.writes.at(-1).failureCount, 2)

	const thirdEnv = makeEnv(JSON.stringify(secondEnv.writes.at(-1)), coordinator)
	const thirdFetch = fakeFetchFactory({ record: edgeRecord, edgeResponses: [new Response('', { status: 503 })] })
	const third = await runCheckWithTestCoordinator(thirdEnv, { fetchImpl: thirdFetch.fetch })
	assert.equal(third.action, 'fallback-applied')
	assert.equal(thirdFetch.calls.filter(call => call.action === 'ModifyRecordStatus').length, 1)
})

test('does not change DNS when Vercel is also unhealthy', async () => {
	const env = makeEnv()
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false },
		edgeResponses: [new Response('', { status: 503 })],
		vercelResponse: new Response('', { status: 503 })
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'both-unhealthy')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
})

test('does not overwrite a manually changed DNS record', async () => {
	const env = makeEnv()
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'manual.example.com', proxied: false }
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
})

test('does not disable regional EdgeOne when the default Vercel fallback is unsafe', async () => {
	const env = makeEnv()
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false },
		defaultRecord: { Type: 'A', Value: '198.51.100.10', Line: '默认', Status: 'ENABLE' },
		edgeResponses: [new Response('', { status: 503 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
})

test('does not disable regional EdgeOne when a competing default apex record is enabled', async () => {
	const env = makeEnv()
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false },
		defaultRecords: [
			{ RecordId: 456, Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE' },
			{ RecordId: 457, Type: 'A', Value: '203.0.113.12', Line: '默认', Status: 'ENABLE' }
		],
		edgeResponses: [new Response('', { status: 503 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
})

test('does not disable regional EdgeOne when an enabled default AAAA route competes', async () => {
	const env = makeEnv()
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false },
		defaultRecords: [
			{ RecordId: 456, Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE' },
			{ RecordId: 458, Type: 'AAAA', Value: '2001:db8::1', Line: '默认', Status: 'ENABLE' }
		],
		edgeResponses: [new Response('', { status: 503 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
})

test('does not disable regional EdgeOne when an enabled default HTTPS route competes', async () => {
	const env = makeEnv()
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false },
		defaultRecords: [
			{ RecordId: 456, Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE' },
			{ RecordId: 459, Type: 'HTTPS', Value: '1 . alpn=h3', Line: '默认', Status: 'ENABLE' }
		],
		edgeResponses: [new Response('', { status: 503 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
})

test('does not disable regional EdgeOne when a later DNSPod page contains a default route', async () => {
	const env = makeEnv()
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false },
		defaultRecordsPages: [
			[{ RecordId: 456, Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE' }],
			[{ RecordId: 459, Type: 'AAAA', Value: '2001:db8::1', Line: '默认', Status: 'ENABLE' }]
		],
		edgeResponses: [new Response('', { status: 503 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
	assert.deepEqual(
		calls
			.filter(call => call.action === 'DescribeRecordList')
			.filter(call => JSON.parse(call.init.body).RecordLine === '默认')
			.map(call => JSON.parse(call.init.body).Offset),
		[0, 100]
	)
})

test('does not treat an EdgeOne-routed Vercel health response as direct Vercel health', async () => {
	const env = makeEnv()
	const vercelResponse = new Response(JSON.stringify({
		status: 'ok',
		origin: 'vercel',
		release: RELEASE_SHA
	}), {
		status: 200,
		headers: {
			'X-Letletme-Edge': 'edgeone',
			'X-Letletme-Release': RELEASE_SHA
		}
	})
	const { fetch } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'ENABLE' },
		edgeResponses: [health(true)],
		vercelResponse
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'both-unhealthy')
	assert.equal(result.vercel.ok, false)
	assert.equal(result.vercel.edgeMarker, 'edgeone')
})

test('is idempotent once fallback is active', async () => {
	const env = makeEnv(JSON.stringify({ failureCount: 3, fallbackActive: true }))
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'DISABLE' }
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'already-fallback')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
})

test('does not treat fallback as safe when another regional route remains enabled', async () => {
	const env = makeEnv(JSON.stringify({ failureCount: 0, fallbackActive: true }))
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'DISABLE' },
		regionalRecords: [
			{ type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'DISABLE' },
			{ RecordId: 789, Name: '@', Type: 'A', Value: '203.0.113.12', Line: '境内', Status: 'ENABLE' }
		]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
})

test('rejects failover verification when a competing regional route remains after disable', async () => {
	const coordinator = makeCoordinator(2)
	const env = {
		...makeEnv(JSON.stringify({ failureCount: 2, fallbackActive: false }), coordinator),
		TELEGRAM_BOT_TOKEN: 'bot',
		TELEGRAM_CHAT_ID: 'chat'
	}
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'ENABLE' }
	const disabledRecord = { ...edgeRecord, Status: 'DISABLE' }
	const { fetch, calls } = fakeFetchFactory({
		record: edgeRecord,
		regionalRecordsAfterDisable: [
			disabledRecord,
			{ RecordId: 789, Name: '@', Type: 'A', Value: '203.0.113.12', Line: '境内', Status: 'ENABLE' }
		],
		edgeResponses: [new Response('', { status: 503 })],
		telegramResponses: [new Response('', { status: 200 })]
	})
	await assert.rejects(
		runCheckWithTestCoordinator(env, { fetchImpl: fetch }),
		/dnspod-disabled-record-verification-failed/
	)
	assert.equal(calls.filter(call => call.action === 'ModifyRecordStatus').length, 1)
	assert.equal(env.writes.at(-1).lastAction, 'post-disable-verification-failed')
	assert.equal(calls.filter(call => call.url.startsWith('https://api.telegram.org/')).length, 1)
})

test('deduplicates repeated DNS mutation failure alerts', async () => {
	const coordinator = makeCoordinator(2)
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'ENABLE' }
	const firstEnv = {
		...makeEnv(JSON.stringify({ failureCount: 2, fallbackActive: false }), coordinator),
		TELEGRAM_BOT_TOKEN: 'bot',
		TELEGRAM_CHAT_ID: 'chat'
	}
	const firstFetch = fakeFetchFactory({
		record: edgeRecord,
		edgeResponses: [new Response('', { status: 503 })],
		modifyResponses: [new Response('', { status: 500 })],
		telegramResponses: [new Response('', { status: 200 })]
	})
	await assert.rejects(
		runCheckWithTestCoordinator(firstEnv, { fetchImpl: firstFetch.fetch }),
		/dnspod-modifyrecordstatus-500/
	)
	assert.equal(firstEnv.writes.at(-1).lastAction, 'disable-mutation-failed')
	assert.equal(firstFetch.calls.filter(call => call.url.startsWith('https://api.telegram.org/')).length, 1)

	const secondEnv = {
		...makeEnv(JSON.stringify(firstEnv.writes.at(-1)), coordinator),
		TELEGRAM_BOT_TOKEN: 'bot',
		TELEGRAM_CHAT_ID: 'chat'
	}
	const secondFetch = fakeFetchFactory({
		record: edgeRecord,
		edgeResponses: [new Response('', { status: 503 })],
		modifyResponses: [new Response('', { status: 500 })],
		telegramResponses: [new Response('', { status: 200 })]
	})
	await assert.rejects(
		runCheckWithTestCoordinator(secondEnv, { fetchImpl: secondFetch.fetch }),
		/dnspod-modifyrecordstatus-500/
	)
	assert.equal(secondEnv.writes.at(-1).lastAction, 'disable-mutation-failed')
	assert.equal(secondFetch.calls.filter(call => call.url.startsWith('https://api.telegram.org/')).length, 0)
})

test('does not claim fallback is safe when the default Vercel record drifted', async () => {
	const env = makeEnv(JSON.stringify({ failureCount: 0, fallbackActive: true }))
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'DISABLE' },
		defaultRecord: { Type: 'A', Value: '198.51.100.10', Line: '默认', Status: 'ENABLE' }
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
})

test('invalid persisted state is safely reset', () => {
	assert.deepEqual(parseState('{not-json'), {
		failureCount: 0,
		fallbackActive: false,
		lastFailureAt: null,
		lastAction: null,
		lastAlertKey: null,
		coordinatorResetPending: false,
		pendingAlert: null
	})
})

test('does not write unchanged healthy state on every cron tick', async () => {
	const firstEnv = makeEnv()
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false }
	const firstFetch = fakeFetchFactory({ record: edgeRecord, edgeResponses: [health(true)] })
	await runCheckWithTestCoordinator(firstEnv, { fetchImpl: firstFetch.fetch })
	assert.equal(firstEnv.writes.length, 1)

	const secondEnv = makeEnv(JSON.stringify(firstEnv.writes[0]))
	const secondFetch = fakeFetchFactory({ record: edgeRecord, edgeResponses: [health(true)] })
	const second = await runCheckWithTestCoordinator(secondEnv, { fetchImpl: secondFetch.fetch })
	assert.equal(second.action, 'healthy')
	assert.equal(secondEnv.writes.length, 0)
})

test('revalidates the DNS record immediately before failover', async () => {
	const env = makeEnv(JSON.stringify({ failureCount: 2, fallbackActive: false }), makeCoordinator(2))
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false }
	const manualRecord = { type: 'CNAME', name: 'letletme.top', content: 'operator.example.com', proxied: false }
	const { fetch, calls } = fakeFetchFactory({
		records: [edgeRecord, manualRecord],
		edgeResponses: [new Response('', { status: 503 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.filter(call => call.action === 'ModifyRecordStatus').length, 0)
	const regionalDescribes = calls
		.filter(call => call.action === 'DescribeRecordList')
		.filter(call => JSON.parse(call.init.body).RecordLine === '境内')
	assert.equal(regionalDescribes.length, 2)
})

test('revalidates the default route after a concurrent fallback change', async () => {
	const env = makeEnv(
		JSON.stringify({ failureCount: 2, fallbackActive: false }),
		makeCoordinator(2)
	)
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'ENABLE' }
	const disabledRecord = { ...edgeRecord, Status: 'DISABLE' }
	const { fetch, calls } = fakeFetchFactory({
		records: [edgeRecord, disabledRecord],
		defaultRecordsSequence: [
			[{ RecordId: 456, Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE' }],
			[{ RecordId: 456, Type: 'A', Value: '198.51.100.10', Line: '默认', Status: 'ENABLE' }]
		],
		edgeResponses: [new Response('', { status: 503 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
	assert.equal(
		calls.filter(call => {
			if (call.action !== 'DescribeRecordList') return false
			return JSON.parse(call.init.body).RecordLine === '默认'
		}).length,
		2
	)
})

test('does not mutate DNS after a failover claim is cleared during revalidation', async () => {
	const coordinator = makeCoordinator(2)
	coordinator.confirmClaim = async () => ({ claimed: false, failureCount: 0 })
	const env = makeEnv(JSON.stringify({ failureCount: 2, fallbackActive: false }), coordinator)
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'ENABLE' },
		edgeResponses: [new Response('', { status: 503 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'failover-claim-lost')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
	assert.equal(env.writes.at(-1).lastAction, 'failover-claim-lost')
})

test('revalidates the default route after the disable mutation', async () => {
	const env = makeEnv(JSON.stringify({ failureCount: 2, fallbackActive: false }), makeCoordinator(2))
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'ENABLE' }
	const { fetch, calls } = fakeFetchFactory({
		record: edgeRecord,
		defaultRecordsSequence: [
			[{ RecordId: 456, Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE' }],
			[{ RecordId: 456, Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE' }],
			[{ RecordId: 456, Type: 'A', Value: '198.51.100.10', Line: '默认', Status: 'ENABLE' }]
		],
		edgeResponses: [new Response('', { status: 503 })]
	})
	await assert.rejects(
		runCheckWithTestCoordinator(env, { fetchImpl: fetch }),
		/dnspod-disabled-record-verification-failed/
	)
	assert.equal(calls.filter(call => call.action === 'ModifyRecordStatus').length, 1)
})

test('counts release drift as an EdgeOne failure even when all HTTP probes are healthy', async () => {
	const env = makeEnv()
	const { fetch } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'ENABLE' },
		edgeResponses: [health(true)],
		vercelResponse: health(false, 'b'.repeat(40))
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'counted-failure')
	assert.equal(result.releaseParity, false)
})

test('counts an EdgeOne-to-Vercel API failure even when Tencent is healthy', async () => {
	const env = makeEnv()
	const { fetch } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'ENABLE' },
		edgeResponses: [health(true)],
		edgeVercelResponses: [new Response('', { status: 503 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'counted-failure')
	assert.equal(result.edge.ok, true)
	assert.equal(result.edgeVercel.ok, false)
})

test('does not fail over when another enabled regional apex record competes', async () => {
	const env = makeEnv()
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false }
	const competingRecord = { RecordId: 789, Name: '@', Type: 'A', Value: '203.0.113.12', Line: '境内', Status: 'ENABLE' }
	const { fetch, calls } = fakeFetchFactory({
		regionalRecords: [edgeRecord, competingRecord],
		edgeResponses: [new Response('', { status: 503 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'manual-dns-state')
	assert.equal(calls.some(call => call.action === 'ModifyRecordStatus'), false)
})

test('deduplicates a sustained dual-outage alert', async () => {
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false }
	const firstEnv = { ...makeEnv(), TELEGRAM_BOT_TOKEN: 'bot', TELEGRAM_CHAT_ID: 'chat' }
	const firstFetch = fakeFetchFactory({
		record: edgeRecord,
		edgeResponses: [new Response('', { status: 503 })],
		vercelResponse: new Response('', { status: 503 }),
		telegramResponses: [new Response('', { status: 200 })]
	})
	await runCheckWithTestCoordinator(firstEnv, { fetchImpl: firstFetch.fetch })
	const saved = JSON.stringify(firstEnv.writes.at(-1))

	const secondEnv = { ...makeEnv(saved), TELEGRAM_BOT_TOKEN: 'bot', TELEGRAM_CHAT_ID: 'chat' }
	const secondFetch = fakeFetchFactory({
		record: edgeRecord,
		edgeResponses: [new Response('', { status: 503 })],
		vercelResponse: new Response('', { status: 503 }),
		telegramResponses: [new Response('', { status: 200 })]
	})
	await runCheckWithTestCoordinator(secondEnv, { fetchImpl: secondFetch.fetch })
	assert.equal(secondFetch.calls.filter(call => call.url.startsWith('https://api.telegram.org/')).length, 0)
})

test('retries a failover alert after DNS already changed', async () => {
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false }
	const coordinator = makeCoordinator(2)
	const firstEnv = { ...makeEnv(JSON.stringify({ failureCount: 2, fallbackActive: false }), coordinator), TELEGRAM_BOT_TOKEN: 'bot', TELEGRAM_CHAT_ID: 'chat' }
	const firstFetch = fakeFetchFactory({
		record: edgeRecord,
		edgeResponses: [new Response('', { status: 503 })],
		telegramResponses: [new Response('', { status: 500 })]
	})
	const first = await runCheckWithTestCoordinator(firstEnv, { fetchImpl: firstFetch.fetch })
	assert.equal(first.action, 'fallback-applied')
	assert.equal(first.state.pendingAlert?.key, 'fallback:123')

	const secondEnv = { ...makeEnv(JSON.stringify(firstEnv.writes.at(-1)), coordinator), TELEGRAM_BOT_TOKEN: 'bot', TELEGRAM_CHAT_ID: 'chat' }
	const secondFetch = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'DISABLE' },
		telegramResponses: [new Response('', { status: 200 })]
	})
	const second = await runCheckWithTestCoordinator(secondEnv, { fetchImpl: secondFetch.fetch })
	assert.equal(second.action, 'already-fallback')
	assert.equal(second.state.pendingAlert, null)
	assert.equal(secondFetch.calls.filter(call => call.url.startsWith('https://api.telegram.org/')).length, 1)
})

test('attempts the failover alert even when the state prewrite fails', async () => {
	const writes = []
	let putCount = 0
	const coordinator = makeCoordinator(2)
	const env = {
		...baseEnv,
		TELEGRAM_BOT_TOKEN: 'bot',
		TELEGRAM_CHAT_ID: 'chat',
		FAILOVER_STATE: {
			async get() { return null },
			async put(_key, value) {
				putCount += 1
				if (putCount === 1) throw new Error('kv-write-failed')
				writes.push(JSON.parse(value))
			}
		},
		coordinator
	}
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false },
		edgeResponses: [new Response('', { status: 503 })],
		telegramResponses: [new Response('', { status: 200 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'fallback-applied')
	assert.equal(calls.filter(call => call.url.startsWith('https://api.telegram.org/')).length, 1)
	assert.equal(writes.at(-1).lastAlertKey, 'fallback:123')
})

test('reconstructs a fallback alert when coordinator confirmation fails', async () => {
	const coordinator = makeCoordinator()
	coordinator.confirm = async () => { throw new Error('coordinator-unavailable') }
	const env = {
		...makeEnv(null, coordinator),
		TELEGRAM_BOT_TOKEN: 'bot',
		TELEGRAM_CHAT_ID: 'chat'
	}
	const { fetch, calls } = fakeFetchFactory({
		record: { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', Status: 'DISABLE' },
		telegramResponses: [new Response('', { status: 200 })]
	})
	const result = await runCheckWithTestCoordinator(env, { fetchImpl: fetch })
	assert.equal(result.action, 'already-fallback')
	assert.equal(calls.filter(call => call.url.startsWith('https://api.telegram.org/')).length, 1)
	assert.equal(result.state.lastAlertKey, 'fallback:123')
})

test('does not reuse a broken streak while a healthy reset is pending', async () => {
	const coordinator = makeCoordinator(2)
	coordinator.reset = async () => { throw new Error('coordinator-unavailable') }
	const edgeRecord = { type: 'CNAME', name: 'letletme.top', content: 'edge.example.com', proxied: false }
	const firstEnv = makeEnv(null, coordinator)
	const firstFetch = fakeFetchFactory({ record: edgeRecord, edgeResponses: [health(true)] })
	const first = await runCheckWithTestCoordinator(firstEnv, { fetchImpl: firstFetch.fetch })
	assert.equal(first.action, 'healthy-coordinator-reset-pending')
	assert.equal(first.state.coordinatorResetPending, true)

	const secondEnv = makeEnv(JSON.stringify(first.state), coordinator)
	const secondFetch = fakeFetchFactory({ record: edgeRecord, edgeResponses: [new Response('', { status: 503 })] })
	const second = await runCheckWithTestCoordinator(secondEnv, { fetchImpl: secondFetch.fetch })
	assert.equal(second.action, 'coordinator-reset-pending')
	assert.equal(secondFetch.calls.filter(call => call.action === 'ModifyRecordStatus').length, 0)
})

test('serializes the threshold claim in the Durable Object coordinator', async () => {
	const values = new Map()
	const coordinator = new FailoverCoordinator({
		storage: {
			async get(key) { return values.get(key) },
			async put(key, value) { values.set(key, value) }
		}
	})
	const request = () => coordinator.fetch(new Request('https://watchdog-coordinator/record-failure', { method: 'POST' }))
	assert.equal((await (await request()).json()).shouldFailover, false)
	assert.equal((await (await request()).json()).shouldFailover, false)
	const thresholdPayload = await (await request()).json()
	assert.equal(thresholdPayload.shouldFailover, true)
	assert.equal(typeof thresholdPayload.claimToken, 'string')
	assert.equal((await (await request()).json()).claimHeld, true)
	const claimResponse = await coordinator.fetch(new Request('https://watchdog-coordinator/confirm-claim', {
		method: 'POST',
		body: JSON.stringify({ claimToken: thresholdPayload.claimToken })
	}))
	assert.equal((await claimResponse.json()).claimed, true)
	const confirmResponse = await coordinator.fetch(new Request('https://watchdog-coordinator/confirm', { method: 'POST' }))
	const confirmPayload = await confirmResponse.json()
	assert.equal(confirmPayload.failureCount, 0)
	const staleClaimResponse = await coordinator.fetch(new Request('https://watchdog-coordinator/confirm-claim', {
		method: 'POST',
		body: JSON.stringify({ claimToken: thresholdPayload.claimToken })
	}))
	assert.equal((await staleClaimResponse.json()).claimed, false)
})
