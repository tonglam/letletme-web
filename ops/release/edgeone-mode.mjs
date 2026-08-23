#!/usr/bin/env node
import { createHash, createHmac } from 'node:crypto'

const ENDPOINT = 'https://teo.tencentcloudapi.com/'
const SERVICE = 'teo'
const VERSION = '2022-09-01'

function sha256(value) {
	return createHash('sha256').update(value).digest('hex')
}

function hmac(key, value) {
	return createHmac('sha256', key).update(value).digest()
}

function parseArguments(argv) {
	const modeIndex = argv.indexOf('--mode')
	const dryRun = argv.includes('--dry-run')
	const mode = modeIndex >= 0 ? argv[modeIndex + 1] : null
	if (!['all-vercel', 'split', 'describe'].includes(mode)) {
		throw new Error(
			'usage: edgeone-mode.mjs --mode all-vercel|split|describe [--dry-run]'
		)
	}
	return { mode, dryRun }
}

function ruleEnvironmentName(mode) {
	return mode === 'all-vercel'
		? 'EDGEONE_RULE_ALL_VERCEL_JSON'
		: 'EDGEONE_RULE_SPLIT_JSON'
}

function readRule(mode) {
	const raw = process.env[ruleEnvironmentName(mode)]
	if (!raw) throw new Error(`missing ${ruleEnvironmentName(mode)}`)
	let rule
	try {
		rule = JSON.parse(raw)
	} catch {
		throw new Error(`${ruleEnvironmentName(mode)} is not valid JSON`)
	}
	if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
		throw new Error(`${ruleEnvironmentName(mode)} must contain a Rule object`)
	}
	const expectedId = process.env.EDGEONE_RULE_ID
	if (expectedId && rule.RuleId !== expectedId) {
		throw new Error(
			'EdgeOne rule snapshot RuleId does not match EDGEONE_RULE_ID'
		)
	}
	return rule
}

function signRequest(
	payload,
	timestamp,
	secretId,
	secretKey,
	action,
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
		'X-TC-Action': action,
		'X-TC-Version': VERSION,
		'X-TC-Timestamp': String(timestamp),
		...(region ? { 'X-TC-Region': region } : {}),
		Authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
	}
}

async function requestTencent(action, body) {
	const secretId = process.env.TENCENTCLOUD_SECRET_ID
	const secretKey = process.env.TENCENTCLOUD_SECRET_KEY
	const zoneId = process.env.EDGEONE_ZONE_ID
	if (!secretId || !secretKey || !zoneId) {
		throw new Error('EdgeOne API credentials or EDGEONE_ZONE_ID are missing')
	}
	const payload = JSON.stringify(body)
	const timestamp = Math.floor(Date.now() / 1000)
	const response = await fetch(ENDPOINT, {
		method: 'POST',
		headers: signRequest(
			payload,
			timestamp,
			secretId,
			secretKey,
			action,
			process.env.TENCENTCLOUD_REGION || ''
		),
		body: payload
	})
	const result = await response.json().catch(() => null)
	if (!response.ok || result?.Response?.Error) {
		const error = result?.Response?.Error
		throw new Error(
			`EdgeOne ${action} failed: HTTP ${response.status}${error?.Code ? ` ${error.Code}` : ''}`
		)
	}
	return result.Response
}

async function describeRule() {
	const zoneId = process.env.EDGEONE_ZONE_ID
	const ruleId = process.env.EDGEONE_RULE_ID
	if (!ruleId) throw new Error('missing EDGEONE_RULE_ID')
	const response = await requestTencent('DescribeL7AccRules', {
		ZoneId: zoneId,
		Filters: [{ Name: 'rule-id', Values: [ruleId] }],
		Limit: 1,
		Offset: 0
	})
	const rules = Array.isArray(response.Rules) ? response.Rules : []
	const rule = rules.find(candidate => candidate?.RuleId === ruleId)
	if (!rule) throw new Error('expected EdgeOne rule was not found')
	return rule
}

async function apply(mode) {
	const desired = readRule(mode)
	const current = await describeRule()
	if (current.RuleId !== desired.RuleId) {
		throw new Error(
			'EdgeOne current rule identity changed; refusing to overwrite'
		)
	}
	const response = await requestTencent('ModifyL7AccRule', {
		ZoneId: process.env.EDGEONE_ZONE_ID,
		Rule: desired
	})
	return {
		mode,
		ruleId: desired.RuleId,
		ruleSha256: sha256(JSON.stringify(desired)),
		requestId: response.RequestId ?? null
	}
}

export async function main(argv = process.argv.slice(2)) {
	const { mode, dryRun } = parseArguments(argv)
	if (mode === 'describe') {
		if (dryRun) return { mode, dryRun: true }
		const rule = await describeRule()
		return {
			mode,
			ruleId: rule.RuleId,
			ruleSha256: sha256(JSON.stringify(rule))
		}
	}
	const desired = readRule(mode)
	const summary = {
		mode,
		ruleId: desired.RuleId ?? null,
		ruleSha256: sha256(JSON.stringify(desired)),
		dryRun
	}
	if (dryRun) return summary
	return apply(mode)
}

if (import.meta.url === `file://${process.argv[1]}`) {
	try {
		console.log(JSON.stringify(await main()))
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	}
}
