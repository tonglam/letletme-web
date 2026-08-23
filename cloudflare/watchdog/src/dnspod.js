const ENDPOINT = 'https://dnspod.tencentcloudapi.com/'
const SERVICE = 'dnspod'
const VERSION = '2021-03-23'

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

export async function getConfiguredRecord(env, fetchImpl) {
	const response = await dnsPodRequest(env, fetchImpl, 'DescribeRecordList', {
		Domain: env.DNSPOD_DOMAIN,
		...(env.DNSPOD_DOMAIN_ID
			? { DomainId: Number(env.DNSPOD_DOMAIN_ID) }
			: {}),
		SubDomain: '@',
		RecordType: 'CNAME',
		RecordLine: env.DNSPOD_EDGEONE_LINE || '境内',
		Offset: 0,
		Limit: 100,
		ErrorOnEmpty: 'no'
	})
	const records = Array.isArray(response.RecordList) ? response.RecordList : []
	return records.find(record => Number(record.RecordId) === recordId(env)) || null
}

export async function getDefaultVercelRecord(env, fetchImpl) {
	const response = await dnsPodRequest(env, fetchImpl, 'DescribeRecordList', {
		Domain: env.DNSPOD_DOMAIN,
		...(env.DNSPOD_DOMAIN_ID
			? { DomainId: Number(env.DNSPOD_DOMAIN_ID) }
			: {}),
		SubDomain: '@',
		RecordType: 'A',
		RecordLine: defaultVercelLine(env),
		Offset: 0,
		Limit: 100,
		ErrorOnEmpty: 'no'
	})
	const records = Array.isArray(response.RecordList) ? response.RecordList : []
	return records.find(record => isDefaultVercelRecord(record, env)) || null
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
