#!/usr/bin/env node
import fs from 'node:fs'

function fail(message) {
	console.error(message)
	process.exitCode = 1
}

function valueAfter(flag, argv) {
	const index = argv.indexOf(flag)
	return index >= 0 ? argv[index + 1] : undefined
}

function readRecords(file) {
	const payload = JSON.parse(fs.readFileSync(file, 'utf8'))
	if (Array.isArray(payload)) return payload
	if (Array.isArray(payload.RecordList)) return payload.RecordList
	if (Array.isArray(payload.recordList)) return payload.recordList
	if (Array.isArray(payload.Response?.RecordList)) return payload.Response.RecordList
	throw new Error('input does not contain a DNSPod RecordList array')
}

function normalized(value) {
	return String(value ?? '').trim().replace(/\.$/, '').toLowerCase()
}

function find(records, line, type, value) {
	return records.find(record =>
		String(record.Name ?? '').toLowerCase() === '@' &&
		String(record.Line ?? '') === line &&
		String(record.Type ?? '').toUpperCase() === type &&
		(!value || normalized(record.Value) === normalized(value))
	)
}

const argv = process.argv.slice(2)
const file = argv[0]
const edgeoneCname = valueAfter('--edgeone-cname', argv) || process.env.DNSPOD_EDGEONE_CNAME
const vercelA = valueAfter('--vercel-a', argv) || process.env.VERCEL_RECOMMENDED_A
const line = process.env.DNSPOD_EDGEONE_LINE || '境内'
const requiredHosts = (process.env.DNSPOD_REQUIRED_HOSTS ||
	'www,api,static,hermes,pop,cdn,vercel-origin,eo-personal-canary').split(',').map(value => value.trim()).filter(Boolean)

function readRequiredSpecs() {
	const raw = process.env.DNSPOD_REQUIRED_RECORDS_JSON
	if (!raw) throw new Error('DNSPOD_REQUIRED_RECORDS_JSON is required')
	const specs = JSON.parse(raw)
	if (!Array.isArray(specs)) throw new Error('DNSPOD_REQUIRED_RECORDS_JSON must be an array')
	for (const spec of specs) {
		if (!spec || typeof spec !== 'object' ||
			typeof spec.Name !== 'string' ||
			typeof spec.Type !== 'string' ||
			typeof spec.Value !== 'string' ||
			typeof spec.Line !== 'string') {
			throw new Error('each required DNS record spec needs Name, Type, Value, and Line')
		}
	}
	return specs
}

if (!file || !edgeoneCname || !vercelA) {
	fail('usage: validate-shadow-zone.mjs <record-json> --edgeone-cname <cname> --vercel-a <ipv4>')
} else {
	try {
		const records = readRecords(file)
		const requiredSpecs = readRequiredSpecs()
		const enabled = record => String(record.Status ?? '').toUpperCase() === 'ENABLE'
		const apexEdgeOne = find(records, line, 'CNAME', edgeoneCname)
		const apexOverseas = find(records, '境外', 'A', vercelA)
		const apexDefault = find(records, '默认', 'A', vercelA)
		const missingHosts = requiredHosts.filter(host => !requiredSpecs.some(required =>
			String(required.Name).toLowerCase() === host.toLowerCase()
		))
		const missingRequiredRecords = requiredSpecs
			.filter(spec => !records.some(record =>
				enabled(record) &&
				String(record.Name ?? '').toLowerCase() === spec.Name.toLowerCase() &&
				String(record.Type ?? '').toUpperCase() === spec.Type.toUpperCase() &&
				normalized(record.Value) === normalized(spec.Value) &&
				String(record.Line ?? '') === spec.Line
			))
			.map(spec => `${spec.Name}/${spec.Type}/${spec.Line}`)
		const disabled = records.filter(record =>
			String(record.Name ?? '').toLowerCase() === '@' &&
			String(record.Line ?? '') === line &&
			String(record.Status ?? '').toUpperCase() === 'DISABLE'
		)
		const result = {
			recordCount: records.length,
			apex: {
				edgeone: Boolean(apexEdgeOne && enabled(apexEdgeOne)),
				overseas: Boolean(apexOverseas && enabled(apexOverseas)),
				default: Boolean(apexDefault && enabled(apexDefault))
			},
			missingHosts,
			missingRequiredRecords,
			disabledRegionalRecords: disabled.map(record => Number(record.RecordId)),
			ok: Boolean(
				apexEdgeOne && enabled(apexEdgeOne) &&
				apexOverseas && enabled(apexOverseas) &&
				apexDefault && enabled(apexDefault) &&
				missingHosts.length === 0 &&
				missingRequiredRecords.length === 0
			)
		}
		console.log(JSON.stringify(result, null, 2))
		if (!result.ok) process.exitCode = 1
	} catch (error) {
		fail(error instanceof Error ? error.message : String(error))
	}
}
