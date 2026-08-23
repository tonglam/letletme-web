const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const script = path.resolve('ops/dnspod/scripts/validate-shadow-zone.mjs')

function runValidator(records) {
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
			DNSPOD_REQUIRED_HOSTS: 'www',
			DNSPOD_REQUIRED_RECORDS_JSON: JSON.stringify([
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
	assert.deepEqual(result.apex, { edgeone: true, overseas: true, default: true })
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
