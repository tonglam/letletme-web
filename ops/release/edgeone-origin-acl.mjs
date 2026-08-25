#!/usr/bin/env node

import { createHash, createHmac } from 'node:crypto'
import { isIP } from 'node:net'

const ENDPOINT = 'https://teo.tencentcloudapi.com/'
const SERVICE = 'teo'
const VERSION = '2022-09-01'

function sha256(value) {
	return createHash('sha256').update(value).digest('hex')
}

function hmac(key, value) {
	return createHmac('sha256', key).update(value).digest()
}

export function validateCidr(value, family, label = 'CIDR') {
	if (typeof value !== 'string') {
		throw new Error(`${label} must be a string`)
	}
	const separator = value.lastIndexOf('/')
	if (separator <= 0 || separator === value.length - 1) {
		throw new Error(`${label} is not a CIDR: ${value}`)
	}
	const address = value.slice(0, separator)
	const prefix = Number(value.slice(separator + 1))
	const maxPrefix = family === 4 ? 32 : 128
	if (isIP(address) !== family || !Number.isInteger(prefix) || prefix < 1 || prefix > maxPrefix) {
		throw new Error(`${label} is not a valid IPv${family} CIDR: ${value}`)
	}
	return value
}

function validateAddressList(value, family, label) {
	if (!Array.isArray(value) || value.length === 0) {
		throw new Error(`${label} must contain at least one address`)
	}
	if (value.length > 512) {
		throw new Error(`${label} contains too many addresses`)
	}
	return [...new Set(value.map((item, index) => validateCidr(item, family, `${label}[${index}]`)))].sort()
}

function normalizeAclVersion(value, label, required) {
	if (value == null && !required) return null
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`${label} version is missing`)
	}
	return value
}

function normalizeAclBlock(value, label, required) {
	if (value == null && !required) return null
	if (!value || typeof value !== 'object' || !value.EntireAddresses) {
		throw new Error(`${label} is missing EntireAddresses`)
	}
	return {
		version: normalizeAclVersion(value.Version, label, required),
		activeTime: value.ActiveTime ?? null,
		plannedActiveTime: value.PlannedActiveTime ?? null,
		isPlanned: value.IsPlaned ?? null,
		ipv4: validateAddressList(value.EntireAddresses.IPv4, 4, `${label}.IPv4`),
		ipv6: validateAddressList(value.EntireAddresses.IPv6, 6, `${label}.IPv6`)
	}
}

export function normalizeOriginAcl(info) {
	if (!info || typeof info !== 'object') {
		throw new Error('OriginACLInfo is missing')
	}
	return {
		status: info.Status ?? null,
		l7Hosts: Array.isArray(info.L7Hosts) ? [...info.L7Hosts].sort() : [],
		l4ProxyIds: Array.isArray(info.L4ProxyIds) ? [...info.L4ProxyIds].sort() : [],
		current: normalizeAclBlock(info.CurrentOriginACL, 'CurrentOriginACL', true),
		next: normalizeAclBlock(info.NextOriginACL, 'NextOriginACL', false)
	}
}

function signRequest(payload, timestamp, secretId, secretKey) {
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
	const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex')
	return {
		'Content-Type': contentType,
		Host: host,
		'X-TC-Action': 'DescribeOriginACL',
		'X-TC-Version': VERSION,
		'X-TC-Timestamp': String(timestamp),
		Authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
	}
}

export async function describeOriginAcl({ secretId, secretKey, zoneId } = {}) {
	if (!secretId || !secretKey || !zoneId) {
		throw new Error('EdgeOne API credentials or EDGEONE_ZONE_ID are missing')
	}
	const payload = JSON.stringify({ ZoneId: zoneId })
	const timestamp = Math.floor(Date.now() / 1000)
	const response = await fetch(ENDPOINT, {
		method: 'POST',
		headers: signRequest(payload, timestamp, secretId, secretKey),
		body: payload
	})
	const result = await response.json().catch(() => null)
	if (!response.ok || result?.Response?.Error) {
		const error = result?.Response?.Error
		throw new Error(`EdgeOne DescribeOriginACL failed: HTTP ${response.status}${error?.Code ? ` ${error.Code}` : ''}`)
	}
	return normalizeOriginAcl(result.Response?.OriginACLInfo)
}

if (import.meta.url === `file://${process.argv[1]}`) {
	try {
		const value = await describeOriginAcl({
			secretId: process.env.TENCENTCLOUD_SECRET_ID,
			secretKey: process.env.TENCENTCLOUD_SECRET_KEY,
			zoneId: process.env.EDGEONE_ZONE_ID
		})
		console.log(JSON.stringify(value, null, 2))
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	}
}
