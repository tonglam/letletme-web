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
	const records = Array.isArray(payload)
		? payload
		: Array.isArray(payload.RecordList)
			? payload.RecordList
			: Array.isArray(payload.recordList)
				? payload.recordList
				: Array.isArray(payload.Response?.RecordList)
					? payload.Response.RecordList
					: null
	if (records) {
		const rawTotal = payload.RecordCountInfo?.TotalCount ?? payload.Response?.RecordCountInfo?.TotalCount
		if (rawTotal !== undefined && rawTotal !== null && rawTotal !== '') {
			const total = Number(rawTotal)
			if (!Number.isSafeInteger(total) || total < 0) {
				throw new Error('input contains an invalid DNSPod RecordCountInfo.TotalCount')
			}
			if (total !== records.length) {
				throw new Error('input contains an incomplete DNSPod RecordList pagination')
			}
		}
		return records
	}
	throw new Error('input does not contain a DNSPod RecordList array')
}

function normalized(value) {
	const trimmed = String(value ?? '').trim()
	return (trimmed === '.' ? '.' : trimmed.replace(/\.$/, '')).toLowerCase()
}

const hostnameValueTypes = new Set(['A', 'AAAA', 'ALIAS', 'CNAME', 'MX', 'NS', 'PTR'])
const structuredHostnameValueTypes = new Set(['HTTPS', 'SVCB'])

function canonicalStructuredValue(value) {
	const parts = String(value ?? '').trim().split(/\s+/).filter(Boolean)
	if (parts.length < 2) return String(value ?? '').trim()
	return [parts[0], normalized(parts[1]), ...parts.slice(2)].join(' ')
}

function canonicalValue(type, value) {
	const normalizedType = String(type ?? '').toUpperCase()
	if (hostnameValueTypes.has(normalizedType)) return normalized(value)
	if (structuredHostnameValueTypes.has(normalizedType)) return canonicalStructuredValue(value)
	return String(value ?? '')
}

function valuesEqual(type, actual, expected) {
	return canonicalValue(type, actual) === canonicalValue(type, expected)
}

const apexRouteTypes = new Set([
	'A',
	'AAAA',
	'ALIAS',
	'CNAME',
	'HTTPS',
	'SVCB',
	'URL',
	'URL2'
])
function isEnabled(record) {
	return String(record.Status ?? '').toUpperCase() === 'ENABLE'
}

function isEnabledApexRoute(record, line) {
	return (
		isEnabled(record) &&
		String(record.Name ?? '').toLowerCase() === '@' &&
		(line === undefined || line === null || String(record.Line ?? '') === line) &&
		apexRouteTypes.has(String(record.Type ?? '').toUpperCase())
	)
}

function enabledApexRoutes(records, line) {
	return records.filter(record => isEnabledApexRoute(record, line))
}

function recordKey(record) {
	return [
		String(record.Type ?? '').toUpperCase(),
		String(record.Line ?? ''),
		String(record.Name ?? '').trim().toLowerCase(),
		canonicalValue(record.Type, record.Value),
		String(record.Type ?? '').toUpperCase() === 'MX' ? String(record.MX ?? '').trim() : ''
	].join('\u0000')
}

function sameRecordMultiset(expectedRecords, actualRecords) {
	if (expectedRecords.length !== actualRecords.length) return false
	const expectedCounts = new Map()
	const actualCounts = new Map()
	for (const record of expectedRecords) {
		const key = recordKey(record)
		expectedCounts.set(key, (expectedCounts.get(key) || 0) + 1)
	}
	for (const record of actualRecords) {
		const key = recordKey(record)
		actualCounts.set(key, (actualCounts.get(key) || 0) + 1)
	}
	const allKeys = new Set([...expectedCounts.keys(), ...actualCounts.keys()])
	return [...allKeys].every(key => expectedCounts.get(key) === actualCounts.get(key))
}

function find(records, line, type, value) {
	return records.find(record =>
		isEnabled(record) &&
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
	'www,api,static,hermes,pop,cdn,vercel-origin,eo-personal-canary,eo-tencent-canary').split(',').map(value => value.trim()).filter(Boolean)

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
		if (spec.Type.toUpperCase() === 'MX' &&
			(spec.MX === undefined || spec.MX === null || String(spec.MX).trim() === '')) {
			throw new Error('MX required DNS record specs need an MX priority')
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
		const apexEdgeOne = find(records, line, 'CNAME', edgeoneCname)
		const apexOverseas = find(records, '境外', 'A', vercelA)
		const apexDefault = find(records, '默认', 'A', vercelA)
		const edgeOneRoutes = enabledApexRoutes(records, line)
		const overseasRoutes = enabledApexRoutes(records, '境外')
		const defaultRoutes = enabledApexRoutes(records, '默认')
		const allApexRoutes = enabledApexRoutes(records)
		const expectedApexRoutes = [
			{ Name: '@', Type: 'CNAME', Value: edgeoneCname, Line: line },
			{ Name: '@', Type: 'A', Value: vercelA, Line: '境外' },
			{ Name: '@', Type: 'A', Value: vercelA, Line: '默认' }
		]
		const apexRouteSetMatches = sameRecordMultiset(expectedApexRoutes, allApexRoutes)
		const missingHosts = requiredHosts.filter(host => !requiredSpecs.some(required =>
			String(required.Name).toLowerCase() === host.toLowerCase() &&
			records.some(record =>
				isEnabled(record) &&
				String(record.Name ?? '').toLowerCase() === String(required.Name).toLowerCase() &&
				String(record.Type ?? '').toUpperCase() === String(required.Type).toUpperCase() &&
				valuesEqual(record.Type, record.Value, required.Value) &&
				String(record.Line ?? '') === String(required.Line)
			)
		))
		const missingRequiredRecords = requiredSpecs
			.filter(spec => !records.some(record =>
				isEnabled(record) &&
				String(record.Name ?? '').toLowerCase() === spec.Name.toLowerCase() &&
				String(record.Type ?? '').toUpperCase() === spec.Type.toUpperCase() &&
				valuesEqual(record.Type, record.Value, spec.Value) &&
				String(record.Line ?? '') === spec.Line
			))
			.map(spec => `${spec.Name}/${spec.Type}/${spec.Line}`)
		const routeHosts = new Set([
			...requiredHosts,
			...requiredSpecs.map(spec => spec.Name)
		].map(value => String(value).trim().toLowerCase()))
		const ambiguousRequiredRoutes = [...routeHosts].flatMap(host => {
			const expectedRoutes = requiredSpecs.filter(spec => String(spec.Name).toLowerCase() === host)
			const actualRoutes = records.filter(record =>
				isEnabled(record) &&
				String(record.Name ?? '').toLowerCase() === host
			)
			return !sameRecordMultiset(expectedRoutes, actualRoutes)
				? [`${host}: expected ${expectedRoutes.length} record(s), found ${actualRoutes.length}`]
				: []
		})
		const disabled = records.filter(record =>
			String(record.Name ?? '').toLowerCase() === '@' &&
			String(record.Line ?? '') === line &&
			String(record.Status ?? '').toUpperCase() === 'DISABLE'
		)
		const result = {
			recordCount: records.length,
			apex: {
				edgeone: Boolean(edgeOneRoutes.length === 1 && apexEdgeOne && isEnabled(apexEdgeOne)),
				overseas: Boolean(overseasRoutes.length === 1 && apexOverseas && isEnabled(apexOverseas)),
				default: Boolean(defaultRoutes.length === 1 && apexDefault && isEnabled(apexDefault)),
				routeCounts: {
				all: allApexRoutes.length,
				edgeone: edgeOneRoutes.length,
					overseas: overseasRoutes.length,
					default: defaultRoutes.length
				}
			},
			missingHosts,
			missingRequiredRecords,
			ambiguousRequiredRoutes,
			apexRouteSetMatches,
			disabledRegionalRecords: disabled.map(record => Number(record.RecordId)),
			ok: Boolean(
				edgeOneRoutes.length === 1 && apexEdgeOne && isEnabled(apexEdgeOne) &&
				overseasRoutes.length === 1 && apexOverseas && isEnabled(apexOverseas) &&
				defaultRoutes.length === 1 && apexDefault && isEnabled(apexDefault) &&
				apexRouteSetMatches &&
				missingHosts.length === 0 &&
				missingRequiredRecords.length === 0 &&
				ambiguousRequiredRoutes.length === 0
			)
		}
		console.log(JSON.stringify(result, null, 2))
		if (!result.ok) process.exitCode = 1
	} catch (error) {
		fail(error instanceof Error ? error.message : String(error))
	}
}
