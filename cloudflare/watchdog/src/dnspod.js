const ENDPOINT = 'https://dnspod.tencentcloudapi.com/'
const SERVICE = 'dnspod'
const VERSION = '2021-03-23'
const APEX_ROUTE_TYPES = new Set([
	'A',
	'AAAA',
	'ALIAS',
	'CNAME',
	'HTTPS',
	'SVCB',
	'URL',
	'URL2'
])
const RECORD_PAGE_SIZE = 100
const MAX_RECORD_PAGES = 100

function bytes(value) {
	return new TextEncoder().encode(value)
}

function hex(value) {
	return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256(value) {
	return crypto.subtle.digest('SHA-256', bytes(value))
}

async function hmac(key, value) {
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		typeof key === 'string' ? bytes(key) : key,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	)
	return crypto.subtle.sign('HMAC', cryptoKey, bytes(value))
}

async function signingHeaders(payload, action, env) {
	const secretId = env.DNSPOD_SECRET_ID
	const secretKey = env.DNSPOD_SECRET_KEY
	if (!secretId || !secretKey || !env.DNSPOD_DOMAIN) {
		throw new Error('dnspod-api-configuration-missing')
	}
	const host = new URL(ENDPOINT).host
	const contentType = 'application/json; charset=utf-8'
	const canonicalHeaders =
		`content-type:${contentType.toLowerCase()}\nhost:${host}\n`
	const signedHeaders = 'content-type;host'
	const timestamp = Math.floor(Date.now() / 1000)
	const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
	const canonicalRequest = [
		'POST',
		'/',
		'',
		canonicalHeaders,
		signedHeaders,
		hex(await sha256(payload))
	].join('\n')
	const credentialScope = `${date}/${SERVICE}/tc3_request`
	const stringToSign = [
		'TC3-HMAC-SHA256',
		String(timestamp),
		credentialScope,
		hex(await sha256(canonicalRequest))
	].join('\n')
	const secretDate = await hmac(`TC3${secretKey}`, date)
	const secretService = await hmac(secretDate, SERVICE)
	const secretSigning = await hmac(secretService, 'tc3_request')
	const signature = hex(await hmac(secretSigning, stringToSign))
	return {
		'Content-Type': contentType,
		Host: host,
		'X-TC-Action': action,
		'X-TC-Version': VERSION,
		'X-TC-Timestamp': String(timestamp),
		...(env.DNSPOD_REGION ? { 'X-TC-Region': env.DNSPOD_REGION } : {}),
		Authorization:
			`TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
	}
}

export async function dnsPodRequest(env, fetchImpl, action, body) {
	const payload = JSON.stringify(body)
	const response = await fetchImpl(ENDPOINT, {
		method: 'POST',
		headers: await signingHeaders(payload, action, env),
		body: payload
	})
	const result = await response.json().catch(() => null)
	if (!response.ok || result?.Response?.Error) {
		const error = result?.Response?.Error
		throw new Error(
			`dnspod-${action.toLowerCase()}-${response.status}${error?.Code ? `-${error.Code}` : ''}`
		)
	}
	return result.Response
}

function recordId(env) {
	const value = Number(env.DNSPOD_EDGEONE_RECORD_ID)
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new Error('dnspod-edgeone-record-id-invalid')
	}
	return value
}

export function isConfiguredRecord(record, env) {
	return (
		record &&
		Number(record.RecordId) === recordId(env) &&
		String(record.Name || '').toLowerCase() === '@' &&
		String(record.Type || '').toUpperCase() === 'CNAME' &&
		normalize(record.Value) === normalize(env.DNSPOD_EDGEONE_CNAME) &&
		String(record.Line || '') === (env.DNSPOD_EDGEONE_LINE || '境内')
	)
}

export function isEnabledRecord(record, env) {
	return isConfiguredRecord(record, env) && String(record.Status).toUpperCase() === 'ENABLE'
}

export function isDisabledRecord(record, env) {
	return isConfiguredRecord(record, env) && String(record.Status).toUpperCase() === 'DISABLE'
}

function normalize(value) {
	return String(value ?? '').trim().replace(/\.$/, '').toLowerCase()
}

function defaultVercelLine(env) {
	return env.DNSPOD_DEFAULT_VERCEL_LINE || '默认'
}

export function isDefaultVercelRecord(record, env) {
	return (
		record &&
		String(record.Name || '').toLowerCase() === '@' &&
		String(record.Type || '').toUpperCase() === 'A' &&
		normalize(record.Value) === normalize(env.DNSPOD_DEFAULT_VERCEL_A) &&
		String(record.Line || '') === defaultVercelLine(env) &&
		String(record.Status || '').toUpperCase() === 'ENABLE'
	)
}

function isRegionalApexRecord(record, env) {
	return (
		String(record.Name || '').toLowerCase() === '@' &&
		String(record.Line || '') === (env.DNSPOD_EDGEONE_LINE || '境内')
	)
}

function isEnabledRegionalApexRecord(record, env) {
	return (
		isRegionalApexRecord(record, env) &&
		APEX_ROUTE_TYPES.has(String(record.Type || '').toUpperCase()) &&
		String(record.Status || '').toUpperCase() === 'ENABLE'
	)
}

function isEnabledApexRouteRecord(record, line) {
	return (
		String(record.Name || '').toLowerCase() === '@' &&
		String(record.Line || '') === line &&
		APEX_ROUTE_TYPES.has(String(record.Type || '').toUpperCase()) &&
		String(record.Status || '').toUpperCase() === 'ENABLE'
	)
}

async function describeRecordList(env, fetchImpl, line) {
	const records = []
	let offset = 0
	let expectedTotal = null
	for (let pageNumber = 0; pageNumber < MAX_RECORD_PAGES; pageNumber += 1) {
		const response = await dnsPodRequest(env, fetchImpl, 'DescribeRecordList', {
			Domain: env.DNSPOD_DOMAIN,
			...(env.DNSPOD_DOMAIN_ID
				? { DomainId: Number(env.DNSPOD_DOMAIN_ID) }
				: {}),
			SubDomain: '@',
			RecordLine: line,
			Offset: offset,
			Limit: RECORD_PAGE_SIZE,
			ErrorOnEmpty: 'no'
		})
		const page = Array.isArray(response.RecordList) ? response.RecordList : []
		const reportedTotal = Number(response.RecordCountInfo?.TotalCount)
		if (Number.isSafeInteger(reportedTotal) && reportedTotal >= 0) {
			if (expectedTotal !== null && expectedTotal !== reportedTotal) {
				throw new Error('dnspod-record-list-total-changed')
			}
			expectedTotal = reportedTotal
		}
		records.push(...page)
		if (expectedTotal !== null && records.length >= expectedTotal) {
			if (records.length !== expectedTotal) throw new Error('dnspod-record-list-overflow')
			return records
		}
		if (page.length === 0) {
			if (expectedTotal !== null && records.length < expectedTotal) {
				throw new Error('dnspod-record-list-pagination-incomplete')
			}
			return records
		}
		if (page.length < RECORD_PAGE_SIZE) {
			if (expectedTotal !== null && records.length < expectedTotal) {
				offset += RECORD_PAGE_SIZE
				continue
			}
			return records
		}
		offset += RECORD_PAGE_SIZE
	}
	throw new Error('dnspod-record-list-pagination-limit')
}

export async function getRegionalApexRecords(env, fetchImpl) {
	const records = await describeRecordList(env, fetchImpl, env.DNSPOD_EDGEONE_LINE || '境内')
	return records.filter(record => isRegionalApexRecord(record, env))
}

export async function getEnabledRegionalApexRecords(env, fetchImpl) {
	const records = await getRegionalApexRecords(env, fetchImpl)
	return records.filter(record => isEnabledRegionalApexRecord(record, env))
}

export async function getConfiguredRecord(env, fetchImpl) {
	const records = await getRegionalApexRecords(env, fetchImpl)
	const regionalApex = records.filter(record => isEnabledRegionalApexRecord(record, env))
	if (regionalApex.length > 1) return null
	return records.find(record => Number(record.RecordId) === recordId(env)) || null
}

export async function getDefaultVercelRecord(env, fetchImpl) {
	const records = await describeRecordList(env, fetchImpl, defaultVercelLine(env))
	const enabledDefaultApexRecords = records.filter(record =>
		isEnabledApexRouteRecord(record, defaultVercelLine(env))
	)
	if (enabledDefaultApexRecords.length !== 1) return null
	return isDefaultVercelRecord(enabledDefaultApexRecords[0], env)
		? enabledDefaultApexRecords[0]
		: null
}

export async function disableConfiguredRecord(env, fetchImpl) {
	const response = await dnsPodRequest(env, fetchImpl, 'ModifyRecordStatus', {
		Domain: env.DNSPOD_DOMAIN,
		...(env.DNSPOD_DOMAIN_ID
			? { DomainId: Number(env.DNSPOD_DOMAIN_ID) }
			: {}),
		RecordId: recordId(env),
		Status: 'DISABLE'
	})
	if (Number(response.RecordId) !== recordId(env)) {
		throw new Error('dnspod-disable-record-verification-failed')
	}
	return response
}

export async function enableConfiguredRecord(env, fetchImpl) {
	const response = await dnsPodRequest(env, fetchImpl, 'ModifyRecordStatus', {
		Domain: env.DNSPOD_DOMAIN,
		...(env.DNSPOD_DOMAIN_ID
			? { DomainId: Number(env.DNSPOD_DOMAIN_ID) }
			: {}),
		RecordId: recordId(env),
		Status: 'ENABLE'
	})
	if (Number(response.RecordId) !== recordId(env)) {
		throw new Error('dnspod-enable-record-verification-failed')
	}
	return response
}
