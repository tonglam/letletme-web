#!/usr/bin/env node
import { createHash, createHmac } from 'node:crypto'

const ENDPOINT = 'https://teo.tencentcloudapi.com/'
const SERVICE = 'teo'
const VERSION = '2022-09-01'

// These are the only public hosts whose immutable static objects are managed
// by the release route. Keep the purge scoped to the Next static namespace;
// runtime HTML, API, and user data are never purged by this helper.
export const STATIC_PURGE_TARGETS = Object.freeze([
	'https://letletme.top/_next/static/',
	'https://eo-personal-canary.letletme.top/_next/static/'
])

function sha256(value) {
	return createHash('sha256').update(value).digest('hex')
}

function hmac(key, value) {
	return createHmac('sha256', key).update(value).digest()
}

export function signRequest(
	payload,
	timestamp,
	secretId,
	secretKey,
	region = ''
) {
	const host = new URL(ENDPOINT).host
	const contentType = 'application/json; charset=utf-8'
	const canonicalHeaders = `content-type:${contentType.toLowerCase()}\nhost:${host}\n`
	const signedHeaders = 'content-type;host'
	const canonicalRequest = [
		'POST',
		'/',
		'',
		canonicalHeaders,
		signedHeaders,
		sha256(payload)
	].join('\n')
	const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
	const credentialScope = `${date}/${SERVICE}/tc3_request`
	const stringToSign = [
		'TC3-HMAC-SHA256',
		String(timestamp),
		credentialScope,
		sha256(canonicalRequest)
	].join('\n')
	const secretDate = hmac(`TC3${secretKey}`, date)
	const secretService = hmac(secretDate, SERVICE)
	const secretSigning = hmac(secretService, 'tc3_request')
	const signature = createHmac('sha256', secretSigning)
		.update(stringToSign)
		.digest('hex')
	return {
		'Content-Type': contentType,
		Host: host,
		'X-TC-Action': 'CreatePurgeTask',
		'X-TC-Version': VERSION,
		'X-TC-Timestamp': String(timestamp),
		...(region ? { 'X-TC-Region': region } : {}),
		Authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
	}
}

export function buildPurgePayload(zoneId, targets = STATIC_PURGE_TARGETS) {
	if (typeof zoneId !== 'string' || zoneId.length === 0) {
		throw new Error('EDGEONE_ZONE_ID is missing')
	}
	if (
		!Array.isArray(targets) ||
		targets.length === 0 ||
		!targets.every(target => {
			try {
				const url = new URL(target)
				return ['http:', 'https:'].includes(url.protocol)
			} catch {
				return false
			}
		})
	) {
		throw new Error('EdgeOne purge targets are invalid')
	}
	return {
		Targets: [...targets],
		Type: 'purge_prefix',
		Method: 'delete',
		ZoneId: zoneId
	}
}

export async function createPurgeTask({
	zoneId = process.env.EDGEONE_ZONE_ID,
	secretId = process.env.TENCENTCLOUD_SECRET_ID,
	secretKey = process.env.TENCENTCLOUD_SECRET_KEY,
	region = process.env.TENCENTCLOUD_REGION || '',
	targets = STATIC_PURGE_TARGETS,
	fetchImpl = fetch,
	timestamp = Math.floor(Date.now() / 1000)
} = {}) {
	if (!secretId || !secretKey) {
		throw new Error('EdgeOne API credentials are missing')
	}
	const body = buildPurgePayload(zoneId, targets)
	const payload = JSON.stringify(body)
	const response = await fetchImpl(ENDPOINT, {
		method: 'POST',
		headers: signRequest(payload, timestamp, secretId, secretKey, region),
		body: payload
	})
	const result = await response.json().catch(() => null)
	const error = result?.Response?.Error
	if (!response.ok || error) {
		throw new Error(
			`EdgeOne CreatePurgeTask failed: HTTP ${response.status}${error?.Code ? ` ${error.Code}` : ''}`
		)
	}
	const task = result?.Response
	const failedList = Array.isArray(task?.FailedList) ? task.FailedList : []
	if (!task?.JobId || failedList.length > 0) {
		throw new Error('EdgeOne CreatePurgeTask did not accept every target')
	}
	return {
		jobId: task.JobId,
		failedList,
		requestId: task?.RequestId ?? null
	}
}

function parseTargets(argv) {
	const targets = []
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] !== '--target' || typeof argv[index + 1] !== 'string') {
			throw new Error(
				'usage: edgeone-purge.mjs [--target https://host/_next/static/]...'
			)
		}
		targets.push(argv[index + 1])
		index += 1
	}
	return targets.length > 0 ? targets : STATIC_PURGE_TARGETS
}

export async function main(argv = process.argv.slice(2)) {
	return createPurgeTask({ targets: parseTargets(argv) })
}

if (import.meta.url === `file://${process.argv[1]}`) {
	try {
		console.log(JSON.stringify(await main()))
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	}
}
