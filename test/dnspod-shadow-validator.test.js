const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const script = path.resolve('ops/dnspod/scripts/validate-shadow-zone.mjs')

function runValidator(records, options = {}) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'letletme-dnspod-'))
	const file = path.join(directory, 'records.json')
	fs.writeFileSync(file, JSON.stringify(records))
	try {
		const stdout = execFileSync(process.execPath, [
			script,
			file,
			'--edgeone-cname',
			'edge.example.com',
			'--vercel-a',
			'76.76.21.21'
		], {
		encoding: 'utf8',
		env: {
			...process.env,
			DNSPOD_REQUIRED_HOSTS: options.requiredHosts || 'www',
			DNSPOD_REQUIRED_RECORDS_JSON: JSON.stringify(options.requiredSpecs || [
				{ Name: 'www', Type: 'CNAME', Value: 'letletme.top', Line: '默认' }
			])
		}
		})
		return JSON.parse(stdout)
	} finally {
		fs.rmSync(directory, { recursive: true, force: true })
	}
}

const validRecords = [
	{ Name: '@', Type: 'CNAME', Value: 'edge.example.com', Line: '境内', Status: 'ENABLE', RecordId: 1 },
	{ Name: '@', Type: 'A', Value: '76.76.21.21', Line: '境外', Status: 'ENABLE', RecordId: 2 },
	{ Name: '@', Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE', RecordId: 3 },
	{ Name: 'www', Type: 'CNAME', Value: 'letletme.top', Line: '默认', Status: 'ENABLE', RecordId: 4 }
]

test('validator accepts exact CLI values and enabled apex records', () => {
	const result = runValidator(validRecords)
	assert.deepEqual(result.apex, {
		edgeone: true,
		overseas: true,
		default: true,
		routeCounts: { edgeone: 1, overseas: 1, default: 1 }
	})
	assert.deepEqual(result.missingHosts, [])
	assert.equal(result.ok, true)
})

test('validator rejects disabled apex records', () => {
	const records = validRecords.map(record =>
		record.Name === '@' && record.Line === '境内'
			? { ...record, Status: 'DISABLE' }
			: record
	)
	assert.throws(() => runValidator(records), error => {
		assert.equal(error.status, 1)
		return true
	})
})

test('validator rejects disabled required hosts', () => {
	const records = validRecords.map(record =>
		record.Name === 'www' ? { ...record, Status: 'DISABLE' } : record
	)
	assert.throws(() => runValidator(records), error => {
		assert.equal(error.status, 1)
		return true
	})
})

test('validator rejects a required host with the wrong route target', () => {
	const records = validRecords.map(record =>
		record.Name === 'www'
			? { ...record, Type: 'A', Value: '203.0.113.10' }
			: record
	)
	assert.throws(() => runValidator(records), error => {
		assert.equal(error.status, 1)
		return true
	})
})

test('validator rejects an extra required record specification that is absent', () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'letletme-dnspod-'))
	const file = path.join(directory, 'records.json')
	fs.writeFileSync(file, JSON.stringify(validRecords))
	try {
		assert.throws(() => execFileSync(process.execPath, [
			script,
			file,
			'--edgeone-cname',
			'edge.example.com',
			'--vercel-a',
			'76.76.21.21'
		], {
			encoding: 'utf8',
			env: {
				...process.env,
				DNSPOD_REQUIRED_HOSTS: 'www,api',
				DNSPOD_REQUIRED_RECORDS_JSON: JSON.stringify([
					{ Name: 'www', Type: 'CNAME', Value: 'letletme.top', Line: '默认' },
					{ Name: 'api', Type: 'CNAME', Value: 'api.example.com', Line: '默认' }
				])
			}
		}), error => {
			assert.equal(error.status, 1)
			return true
		})
	} finally {
		fs.rmSync(directory, { recursive: true, force: true })
	}
})

test('validator rejects competing enabled apex routes', () => {
	for (const competingRecord of [
		{ Name: '@', Type: 'AAAA', Value: '2001:db8::1', Line: '默认', Status: 'ENABLE', RecordId: 5 },
		{ Name: '@', Type: 'HTTPS', Value: '1 . alpn=h3', Line: '默认', Status: 'ENABLE', RecordId: 8 },
		{ Name: '@', Type: 'A', Value: '203.0.113.10', Line: '境外', Status: 'ENABLE', RecordId: 6 },
		{ Name: '@', Type: 'A', Value: '203.0.113.11', Line: '境内', Status: 'ENABLE', RecordId: 7 }
	]) {
		assert.throws(() => runValidator([...validRecords, competingRecord]), error => {
			assert.equal(error.status, 1)
			return true
		})
	}
})

test('validator rejects competing enabled watchdog host routes', () => {
	const records = [
		...validRecords,
		{ Name: 'vercel-origin', Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE', RecordId: 5 },
		{ Name: 'vercel-origin', Type: 'A', Value: '203.0.113.10', Line: '默认', Status: 'ENABLE', RecordId: 6 }
	]
	assert.throws(() => runValidator(records, {
		requiredHosts: 'www,vercel-origin',
		requiredSpecs: [
			{ Name: 'www', Type: 'CNAME', Value: 'letletme.top', Line: '默认' },
			{ Name: 'vercel-origin', Type: 'A', Value: '76.76.21.21', Line: '默认' }
		]
	}), error => {
		assert.equal(error.status, 1)
		return true
	})
})

test('validator rejects competing enabled watchdog host routes on another DNS line', () => {
	const records = [
		...validRecords,
		{ Name: 'vercel-origin', Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE', RecordId: 5 },
		{ Name: 'vercel-origin', Type: 'A', Value: '203.0.113.10', Line: '境外', Status: 'ENABLE', RecordId: 6 }
	]
	assert.throws(() => runValidator(records, {
		requiredHosts: 'www,vercel-origin',
		requiredSpecs: [
			{ Name: 'www', Type: 'CNAME', Value: 'letletme.top', Line: '默认' },
			{ Name: 'vercel-origin', Type: 'A', Value: '76.76.21.21', Line: '默认' }
		]
	}), error => {
		assert.equal(error.status, 1)
		return true
	})
})

test('validator rejects competing enabled routes for any required hostname', () => {
	const records = [
		...validRecords,
		{ Name: 'api', Type: 'CNAME', Value: 'api.example.com', Line: '默认', Status: 'ENABLE', RecordId: 5 },
		{ Name: 'api', Type: 'A', Value: '203.0.113.10', Line: '默认', Status: 'ENABLE', RecordId: 6 }
	]
	assert.throws(() => runValidator(records, {
		requiredHosts: 'www,api',
		requiredSpecs: [
			{ Name: 'www', Type: 'CNAME', Value: 'letletme.top', Line: '默认' },
			{ Name: 'api', Type: 'CNAME', Value: 'api.example.com', Line: '默认' }
		]
	}), error => {
		assert.equal(error.status, 1)
		return true
	})
})

test('validator rejects an unlisted route on a non-route-only required hostname', () => {
	const records = [
		...validRecords,
		{ Name: '_verify', Type: 'TXT', Value: 'TokenABC', Line: '默认', Status: 'ENABLE', RecordId: 5 },
		{ Name: '_verify', Type: 'A', Value: '203.0.113.10', Line: '默认', Status: 'ENABLE', RecordId: 6 }
	]
	assert.throws(() => runValidator(records, {
		requiredHosts: 'www,_verify',
		requiredSpecs: [
			{ Name: 'www', Type: 'CNAME', Value: 'letletme.top', Line: '默认' },
			{ Name: '_verify', Type: 'TXT', Value: 'TokenABC', Line: '默认' }
		]
	}), error => {
		assert.equal(error.status, 1)
		return true
	})
})

test('validator accepts the complete required route set for a hostname', () => {
	const records = [
		...validRecords,
		{ Name: 'api', Type: 'A', Value: '76.76.21.21', Line: '默认', Status: 'ENABLE', RecordId: 5 },
		{ Name: 'api', Type: 'AAAA', Value: '2001:db8::1', Line: '默认', Status: 'ENABLE', RecordId: 6 }
	]
	const result = runValidator(records, {
		requiredHosts: 'www,api',
		requiredSpecs: [
			{ Name: 'www', Type: 'CNAME', Value: 'letletme.top', Line: '默认' },
			{ Name: 'api', Type: 'A', Value: '76.76.21.21', Line: '默认' },
			{ Name: 'api', Type: 'AAAA', Value: '2001:db8::1', Line: '默认' }
		]
	})
	assert.deepEqual(result.ambiguousRequiredRoutes, [])
	assert.equal(result.ok, true)
})

test('validator preserves case-sensitive opaque DNS values', () => {
	const records = [
		...validRecords,
		{ Name: '_edgeone', Type: 'TXT', Value: 'tokenabc', Line: '默认', Status: 'ENABLE', RecordId: 5 }
	]
	assert.throws(() => runValidator(records, {
		requiredHosts: 'www,_edgeone',
		requiredSpecs: [
			{ Name: 'www', Type: 'CNAME', Value: 'letletme.top', Line: '默认' },
			{ Name: '_edgeone', Type: 'TXT', Value: 'TokenABC', Line: '默认' }
		]
	}), error => {
		assert.equal(error.status, 1)
		return true
	})
})

test('validator preserves case-sensitive HTTPS and SVCB values', () => {
	for (const type of ['HTTPS', 'SVCB']) {
		const records = [
			...validRecords,
			{ Name: '_service', Type: type, Value: '1 . alpn=h3 ech=tokenabc', Line: '默认', Status: 'ENABLE', RecordId: 5 }
		]
		assert.throws(() => runValidator(records, {
			requiredHosts: 'www,_service',
			requiredSpecs: [
				{ Name: 'www', Type: 'CNAME', Value: 'letletme.top', Line: '默认' },
				{ Name: '_service', Type: type, Value: '1 . alpn=h3 ech=TokenABC', Line: '默认' }
			]
		}), error => {
			assert.equal(error.status, 1)
			return true
		})
	}
})

test('validator canonicalizes HTTPS and SVCB target hostnames only', () => {
	for (const type of ['HTTPS', 'SVCB']) {
		const records = [
			...validRecords,
			{ Name: '_service', Type: type, Value: '1 SVC.EXAMPLE.COM. ech=TokenABC', Line: '默认', Status: 'ENABLE', RecordId: 5 }
		]
		const result = runValidator(records, {
			requiredHosts: 'www,_service',
			requiredSpecs: [
				{ Name: 'www', Type: 'CNAME', Value: 'letletme.top', Line: '默认' },
				{ Name: '_service', Type: type, Value: '1 svc.example.com ech=TokenABC', Line: '默认' }
			]
		})
		assert.equal(result.ok, true)
	}
})
