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

const hostnameValueTypes = new Set(['A', 'AAAA', 'ALIAS', 'CNAME', 'MX', 'NS', 'PTR'])

function canonicalValue(type, value) {
	return hostnameValueTypes.has(String(type ?? '').toUpperCase())
		? normalized(value)
		: String(value ?? '')
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
		String(record.Line ?? '') === line &&
		apexRouteTypes.has(String(record.Type ?? '').toUpperCase())
	)
}

function enabledApexRoutes(records, line) {
	return records.filter(record => isEnabledApexRoute(record, line))
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
	'www,api,static,hermes,pop,cdn,vercel-origin,eo-personal-canary,eo-tencent-canary,eo-vercel-canary').split(',').map(value => value.trim()).filter(Boolean)

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
		const apexEdgeOne = find(records, line, 'CNAME', edgeoneCname)
		const apexOverseas = find(records, '境外', 'A', vercelA)
		const apexDefault = find(records, '默认', 'A', vercelA)
		const edgeOneRoutes = enabledApexRoutes(records, line)
		const overseasRoutes = enabledApexRoutes(records, '境外')
		const defaultRoutes = enabledApexRoutes(records, '默认')
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
		const routeHosts = new Set(requiredSpecs
			.filter(spec => apexRouteTypes.has(String(spec.Type).toUpperCase()))
			.map(spec => String(spec.Name).trim().toLowerCase()))
		const ambiguousRequiredRoutes = [...routeHosts].flatMap(host => {
			const expectedRoutes = requiredSpecs.filter(spec =>
				String(spec.Name).toLowerCase() === host &&
				apexRouteTypes.has(String(spec.Type).toUpperCase())
			)
			const actualRoutes = records.filter(record =>
				isEnabled(record) &&
				String(record.Name ?? '').toLowerCase() === host &&
				apexRouteTypes.has(String(record.Type ?? '').toUpperCase())
			)
			const keyFor = record => [
				String(record.Type ?? '').toUpperCase(),
				String(record.Line ?? ''),
				String(record.Name ?? '').trim().toLowerCase(),
				canonicalValue(record.Type, record.Value)
			].join('\u0000')
			const expectedCounts = new Map()
			for (const route of expectedRoutes) {
				const key = keyFor(route)
				expectedCounts.set(key, (expectedCounts.get(key) || 0) + 1)
			}
			const actualCounts = new Map()
			for (const route of actualRoutes) {
				const key = keyFor(route)
				actualCounts.set(key, (actualCounts.get(key) || 0) + 1)
			}
			const allKeys = new Set([...expectedCounts.keys(), ...actualCounts.keys()])
			return [...allKeys].some(key => expectedCounts.get(key) !== actualCounts.get(key))
				? [`${host}: expected ${expectedRoutes.length} route(s), found ${actualRoutes.length}`]
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
					edgeone: edgeOneRoutes.length,
					overseas: overseasRoutes.length,
					default: defaultRoutes.length
				}
			},
			missingHosts,
			missingRequiredRecords,
			ambiguousRequiredRoutes,
			disabledRegionalRecords: disabled.map(record => Number(record.RecordId)),
			ok: Boolean(
				edgeOneRoutes.length === 1 && apexEdgeOne && isEnabled(apexEdgeOne) &&
				overseasRoutes.length === 1 && apexOverseas && isEnabled(apexOverseas) &&
				defaultRoutes.length === 1 && apexDefault && isEnabled(apexDefault) &&
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
