import postgres from 'postgres'

import {
	hmacAuthReference,
	normalizeRequestId
} from '../lib/auth-observability-core'

type QueryOptions = {
	days: number
	limit: number
	webUserId?: string
	miniAccountId?: string
	miniDeviceId?: string
	sessionId?: string
	requestId?: string
}

type AuthEventRow = {
	id: string
	occurred_at: Date
	request_id: string
	event_type: string
	channel: string
	operation: string
	outcome: string
	status_code: number | null
	error_code: string | null
	phase_timings: Record<string, number> | null
	web_user_ref: string | null
	mini_account_ref: string | null
	email_ref: string | null
	session_ref: string | null
	device_ref: string | null
	trigger: string | null
	revoked_session_count: number | null
	client_platform: string | null
	client_device_class: string | null
	client_os_family: string | null
	client_os_major: string | null
	client_browser_family: string | null
	client_browser_major: string | null
	wechat_major: string | null
	sdk_version: string | null
	mini_program_version: string | null
	env_version: string | null
	page_route: string | null
	encrypted_storage_supported: boolean | null
	credential_state: string | null
	release: string | null
	source: string | null
	region: string | null
}

function usage(): never {
	throw new Error(
		'Usage: npm run auth:events -- [--days 7] [--limit 500] [--web-user-id ID] [--mini-account-id ID] [--mini-device-id ID] [--session-id ID] [--request-id ID]'
	)
}

function parsePositiveInteger(value: string | undefined, name: string): number {
	const parsed = Number(value)
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`${name} must be a positive integer`)
	}
	return parsed
}

function parseArgs(args: readonly string[]): QueryOptions {
	const options: QueryOptions = { days: 7, limit: 500 }
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index]
		const value = args[index + 1]
		switch (arg) {
			case '--days':
				options.days = parsePositiveInteger(value, '--days')
				index += 1
				break
			case '--limit':
				options.limit = parsePositiveInteger(value, '--limit')
				index += 1
				break
			case '--web-user-id':
				options.webUserId = value
				index += 1
				break
			case '--mini-account-id':
				options.miniAccountId = value
				index += 1
				break
			case '--mini-device-id':
				options.miniDeviceId = value
				index += 1
				break
			case '--session-id':
				options.sessionId = value
				index += 1
				break
			case '--request-id':
				options.requestId = value
				index += 1
				break
			default:
				usage()
		}
	}
	if (options.days > 45) throw new Error('--days cannot exceed 45')
	if (options.limit > 500) throw new Error('--limit cannot exceed 500')
	return options
}

function requiredSecret(): string {
	const secret = process.env.AUTH_OBSERVABILITY_SECRET
	if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
		throw new Error('AUTH_OBSERVABILITY_SECRET must contain at least 32 bytes')
	}
	return secret
}

function reference(value: string | undefined, purpose: string, secret: string): string {
	const result = hmacAuthReference(value, purpose, secret)
	if (!result) throw new Error(`Unable to build ${purpose} reference`)
	return result
}

function eventView(row: AuthEventRow) {
	return {
		id: row.id,
		occurredAt: row.occurred_at,
		requestId: row.request_id,
		eventType: row.event_type,
		channel: row.channel,
		operation: row.operation,
		outcome: row.outcome,
		statusCode: row.status_code,
		errorCode: row.error_code,
		phaseTimings: row.phase_timings,
		webUserRef: row.web_user_ref,
		miniAccountRef: row.mini_account_ref,
		emailRef: row.email_ref,
		sessionRef: row.session_ref,
		deviceRef: row.device_ref,
		trigger: row.trigger,
		revokedSessionCount: row.revoked_session_count,
		client: {
			platform: row.client_platform,
			deviceClass: row.client_device_class,
			osFamily: row.client_os_family,
			osMajor: row.client_os_major,
			browserFamily: row.client_browser_family,
			browserMajor: row.client_browser_major,
			wechatMajor: row.wechat_major,
			sdkVersion: row.sdk_version,
			miniProgramVersion: row.mini_program_version,
			envVersion: row.env_version,
			pageRoute: row.page_route,
			encryptedStorageSupported: row.encrypted_storage_supported,
			credentialState: row.credential_state
		},
		release: row.release,
		source: row.source,
		region: row.region
	}
}

function summarize(rows: readonly AuthEventRow[]) {
	const countBy = (selector: (row: AuthEventRow) => string | null) =>
		Object.fromEntries(
				Array.from(rows.reduce((counts, row) => {
					const key = selector(row)
					if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
					return counts
				}, new Map<string, number>()).entries()).sort(([left], [right]) => left.localeCompare(right))
		)
	const sessionCounts = new Map<string, number>()
	for (const row of rows) {
		if (row.event_type === 'session_issued' && row.session_ref) {
			sessionCounts.set(row.session_ref, (sessionCounts.get(row.session_ref) ?? 0) + 1)
		}
	}
	return {
		eventCount: rows.length,
		eventTypes: countBy(row => row.event_type),
		outcomes: countBy(row => row.outcome),
		triggers: countBy(row => row.trigger),
		operations: countBy(row => row.operation),
		persistence: countBy(row => row.credential_state),
		revokedSessionCount: rows.reduce(
			(total, row) => total + (row.revoked_session_count ?? 0),
			0
		),
			repeatedSessionReferences: Array.from(sessionCounts.entries())
			.filter(([, count]) => count > 1)
			.map(([sessionRef, count]) => ({ sessionRef, count }))
	}
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2))
	const secret = requiredSecret()
	const connectionString = process.env.DATABASE_URL
	if (!connectionString) throw new Error('DATABASE_URL is not configured')
	const client = postgres(connectionString, { max: 1, prepare: false })
	try {
		const conditions = [
			client`occurred_at >= ${new Date(Date.now() - options.days * 24 * 60 * 60 * 1000)}`
		]
		if (options.webUserId) conditions.push(client`web_user_ref = ${reference(options.webUserId, 'web-user', secret)}`)
		if (options.miniAccountId) conditions.push(client`mini_account_ref = ${reference(options.miniAccountId, 'mini-account', secret)}`)
		if (options.miniDeviceId) conditions.push(client`device_ref = ${reference(options.miniDeviceId, 'device', secret)}`)
		if (options.sessionId) conditions.push(client`session_ref = ${reference(options.sessionId, 'session', secret)}`)
		if (options.requestId) {
			const requestId = normalizeRequestId(options.requestId)
			if (!requestId) throw new Error('--request-id is invalid')
			conditions.push(client`request_id = ${requestId}`)
		}
		const where = conditions.slice(1).reduce(
			(query, condition) => client`${query} AND ${condition}`,
			conditions[0]
		)
		const rows = await client<AuthEventRow[]>`
			SELECT
				id, occurred_at, request_id, event_type, channel, operation, outcome,
				status_code, error_code, phase_timings, web_user_ref, mini_account_ref,
				email_ref, session_ref, device_ref, trigger, revoked_session_count,
				client_platform, client_device_class, client_os_family, client_os_major,
				client_browser_family, client_browser_major, wechat_major, sdk_version,
				mini_program_version, env_version, page_route,
				encrypted_storage_supported, credential_state, release, source, region
			FROM bauth.auth_event
			WHERE ${where}
			ORDER BY occurred_at DESC
			LIMIT ${options.limit}
		`
		console.log(
			JSON.stringify(
				{
					query: {
						days: options.days,
						limit: options.limit,
						filters: {
							webUser: Boolean(options.webUserId),
							miniAccount: Boolean(options.miniAccountId),
							miniDevice: Boolean(options.miniDeviceId),
							session: Boolean(options.sessionId),
							request: Boolean(options.requestId)
						}
					},
					summary: summarize(rows),
					events: rows.map(eventView)
				},
				null,
				2
			)
		)
	} finally {
		await client.end()
	}
}

void main().catch(() => {
	console.error('auth event query failed')
	process.exitCode = 1
})
