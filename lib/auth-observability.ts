import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes, randomUUID } from 'node:crypto'

import { after } from 'next/server'
import { sql } from 'drizzle-orm'

import { db, schema } from '@/lib/db'
import { resolveProviderClientIp } from '@/lib/http-security-core'
import { logSafeAuthDiagnostic } from '@/lib/auth-safe-log'
import {
	authDeviceCookieValueFromHeader,
	AUTH_DEVICE_COOKIE_MAX_AGE_SECONDS,
	AUTH_DEVICE_COOKIE_NAME,
	hmacAuthReference,
	httpAuthErrorCode,
	normalizeAuthErrorCode,
	normalizeAuthOperation,
	normalizeAuthRegion,
	normalizeClientEnvironment,
	normalizeIp,
	normalizeMiniProgramLoginContext,
	normalizePhaseTimings,
	normalizeRequestId,
	resolveAuthRelease,
	type AuthChannel,
	type AuthClientEnvironment,
	type AuthEventInput,
	type AuthOutcome,
	type MiniProgramLoginContext
} from '@/lib/auth-observability-core'

export type { AuthEventInput, MiniProgramLoginContext }
export { normalizeMiniProgramLoginContext }

type ObservationContext = {
	requestId: string
	channel: AuthChannel
	operation: string
	startedAt: number
	recordRequestEvent: boolean
	ip?: string
	userAgent?: string
	deviceCookie?: string
	clientEnvironment?: AuthClientEnvironment
	release?: string
	source?: string
	region?: string
	webUserId?: string | null
	miniAccountId?: string | null
	miniDeviceId?: string | null
	sessionId?: string | null
	email?: string | null
	loginContext?: MiniProgramLoginContext
	events: AuthEventInput[]
	flushScheduled: boolean
}

const observationStorage = new AsyncLocalStorage<ObservationContext>()

function requestIdFor(request: Request): string {
	return normalizeRequestId(request.headers.get('x-request-id')) ?? randomUUID()
}

export function createAuthObservationContext(
	request: Request,
	channel: AuthChannel,
	operation: string,
	options: {
		requestId?: string
		source?: string
		loginContext?: MiniProgramLoginContext
		recordRequestEvent?: boolean
	} = {}
): ObservationContext {
	const userAgent = request.headers.get('user-agent') ?? undefined
	return {
		requestId:
			normalizeRequestId(options.requestId) ?? requestIdFor(request),
		channel,
		operation: normalizeAuthOperation(operation),
		startedAt: Date.now(),
		recordRequestEvent: options.recordRequestEvent !== false,
		ip: normalizeIp(resolveProviderClientIp(request.headers)),
		userAgent,
		deviceCookie: authDeviceCookieValueFromHeader(request.headers.get('cookie')),
		clientEnvironment: normalizeClientEnvironment(userAgent),
		release: resolveAuthRelease(),
		source: options.source,
		region: process.env.VERCEL_REGION,
		loginContext: options.loginContext,
		events: [],
		flushScheduled: false
	}
}

export function runWithAuthObservationContext<T>(
	context: ObservationContext,
	task: () => T
): T {
	return observationStorage.run(context, task)
}

export function getAuthObservationContext(): ObservationContext | undefined {
	return observationStorage.getStore()
}

export function updateAuthObservationContext(values: {
	webUserId?: string | null
	miniAccountId?: string | null
	miniDeviceId?: string | null
	sessionId?: string | null
	email?: string | null
	loginContext?: MiniProgramLoginContext
}): void {
	const context = observationStorage.getStore()
	if (!context) return
	Object.assign(context, values)
}

function outcomeForStatus(statusCode: number): AuthOutcome {
	if (statusCode >= 200 && statusCode < 400) return 'succeeded'
	if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
		return 'rejected'
	}
	return 'failed'
}

export function recordAuthEvent(event: AuthEventInput): void {
	const context = observationStorage.getStore()
	if (!context) return
	context.events.push({
		...event,
		requestId: event.requestId ?? context.requestId,
		channel: event.channel ?? context.channel,
		operation: event.operation ?? context.operation,
		release: event.release ?? context.release,
		source: event.source ?? context.source,
		region: event.region ?? context.region,
		webUserId: event.webUserId ?? context.webUserId,
		miniAccountId: event.miniAccountId ?? context.miniAccountId,
		deviceId: event.deviceId ?? context.miniDeviceId,
		sessionId: event.sessionId ?? context.sessionId,
		email: event.email ?? context.email,
		ip: event.ip ?? context.ip,
		clientEnvironment: event.clientEnvironment ?? context.clientEnvironment,
		loginContext: event.loginContext ?? context.loginContext
	})
}

export function recordAuthRequestOutcome(
	statusCode: number,
	phaseTimings?: Record<string, number>,
	errorCode?: string
): void {
	const context = observationStorage.getStore()
	if (!context || !context.recordRequestEvent) return
	const safeErrorCode =
		normalizeAuthErrorCode(errorCode) ?? httpAuthErrorCode(statusCode)
	recordAuthEvent({
		eventType: 'auth_request',
		channel: context.channel,
		operation: context.operation,
		outcome: outcomeForStatus(statusCode),
		statusCode,
		errorCode: safeErrorCode,
		phaseTimings: {
			...(phaseTimings ?? {}),
			total: Date.now() - context.startedAt
		}
	})
}

export function recordAuthFailure(
	errorCode: string | undefined,
	statusCode = 500,
	eventType: 'upstream_failure' | 'rate_limited' = 'upstream_failure'
): void {
	const context = observationStorage.getStore()
	if (!context) return
	recordAuthEvent({
		eventType,
		channel: context.channel,
		operation: context.operation,
		outcome: statusCode === 429 ? 'rejected' : 'failed',
		statusCode,
		errorCode: normalizeAuthErrorCode(errorCode) ?? httpAuthErrorCode(statusCode)
	})
}

function buildAuthEventRow(event: AuthEventInput): typeof schema.authEvent.$inferInsert | null {
	const context = observationStorage.getStore()
	const occurredAt = event.occurredAt ?? new Date()
	const secret = process.env.AUTH_OBSERVABILITY_SECRET
	if (!secret || Buffer.byteLength(secret, 'utf8') < 32) return null
	const loginContext = event.loginContext ?? context?.loginContext
	const environment = event.clientEnvironment ?? context?.clientEnvironment
	return {
		id: randomUUID(),
		occurredAt,
		expiresAt: new Date(occurredAt.getTime() + 45 * 24 * 60 * 60 * 1000),
		requestId: normalizeRequestId(event.requestId ?? context?.requestId) ?? randomUUID(),
		eventType: event.eventType,
		channel: event.channel,
		operation: normalizeAuthOperation(event.operation),
		outcome: event.outcome,
		statusCode:
			event.statusCode !== undefined && Number.isSafeInteger(event.statusCode)
				? event.statusCode
				: null,
		errorCode: normalizeAuthErrorCode(event.errorCode) ?? null,
		phaseTimings: normalizePhaseTimings(event.phaseTimings) ?? null,
		webUserRef: hmacAuthReference(
			event.webUserId ?? context?.webUserId,
			'web-user',
			secret
		) ?? null,
		miniAccountRef: hmacAuthReference(
			event.miniAccountId ?? context?.miniAccountId,
			'mini-account',
			secret
		) ?? null,
		emailRef: hmacAuthReference(event.email ?? context?.email, 'email', secret) ?? null,
		sessionRef: hmacAuthReference(
			event.sessionId ?? context?.sessionId,
			'session',
			secret
		) ?? null,
		deviceRef: hmacAuthReference(
			event.deviceId ?? context?.miniDeviceId ?? context?.deviceCookie,
			'device',
			secret
		) ?? null,
		ipRef: hmacAuthReference(event.ip ?? context?.ip, 'ip', secret) ?? null,
		trigger: loginContext?.trigger ?? event.trigger ?? null,
		revokedSessionCount:
			event.revokedSessionCount !== undefined &&
			Number.isSafeInteger(event.revokedSessionCount) &&
			event.revokedSessionCount >= 0
				? event.revokedSessionCount
				: null,
		clientPlatform: loginContext?.platform ?? null,
		clientDeviceClass:
			loginContext?.deviceClass ?? environment?.deviceClass ?? null,
		clientOsFamily: loginContext?.osFamily ?? environment?.osFamily ?? null,
		clientOsMajor: loginContext?.osMajor ?? environment?.osMajor ?? null,
		clientBrowserFamily: environment?.browserFamily ?? null,
		clientBrowserMajor: environment?.browserMajor ?? null,
		wechatMajor: loginContext?.wechatMajor ?? null,
		sdkVersion: loginContext?.sdkVersion ?? null,
		miniProgramVersion: loginContext?.miniProgramVersion ?? null,
		envVersion: loginContext?.envVersion ?? null,
		pageRoute: loginContext?.pageRoute ?? null,
		encryptedStorageSupported:
			loginContext?.encryptedStorageSupported ?? null,
		credentialState: event.credentialState ?? loginContext?.credentialState ?? null,
		release: normalizeAuthRegion(event.release ?? context?.release) ?? null,
		source: normalizeAuthRegion(event.source ?? context?.source) ?? null,
		region: normalizeAuthRegion(event.region ?? context?.region) ?? null
	}
}

const AUTH_EVENT_CLEANUP_BATCH_SIZE = 500
const AUTH_EVENT_CLEANUP_MAX_BATCHES = 20
const AUTH_EVENT_CLEANUP_BUDGET_MS = 15_000
const AUTH_EVENT_CLEANUP_LOCK_KEY = 'letletme-auth-event-cleanup'

export type AuthEventCleanupResult = {
	deleted: number
	batches: number
	stoppedByLimit: boolean
	lockSkipped: boolean
	remainingExpired: number
	oldestExpiredAt: string | null
}

async function flushAuthEvents(events: readonly AuthEventInput[]): Promise<void> {
	if (events.length === 0) return
	const rows = events
		.map(buildAuthEventRow)
		.filter((row): row is typeof schema.authEvent.$inferInsert => Boolean(row))
	if (rows.length === 0) {
		logSafeAuthDiagnostic('warn', 'telemetry_write_failed', {
			code: 'observability_secret_unavailable',
			status: 503
		})
		return
	}
	try {
		await db.insert(schema.authEvent).values(rows)
	} catch {
		logSafeAuthDiagnostic('warn', 'telemetry_write_failed', {
			code: 'auth_event_insert_failed',
			status: 503
		})
	}
}

async function purgeExpiredAuthEventBatch(): Promise<{
	deleted: number
	lockSkipped: boolean
}> {
	return db.transaction(async tx => {
		const [lock] = await tx.execute<{ locked: boolean }>(sql`
			SELECT pg_try_advisory_xact_lock(hashtextextended(${AUTH_EVENT_CLEANUP_LOCK_KEY}, 0)) AS locked
		`)
		if (!lock?.locked) return { deleted: 0, lockSkipped: true }
		await tx.execute(sql`SELECT set_config('statement_timeout', '3s', true)`)
		await tx.execute(sql`SELECT set_config('lock_timeout', '1s', true)`)
		const deleted = await tx.execute(sql`
			DELETE FROM bauth.auth_event
			WHERE id IN (
				SELECT id
				FROM bauth.auth_event
				WHERE expires_at <= CURRENT_TIMESTAMP
				ORDER BY expires_at
				LIMIT ${AUTH_EVENT_CLEANUP_BATCH_SIZE}
			)
			RETURNING id
		`)
		return { deleted: deleted.length, lockSkipped: false }
	})
}

export async function purgeExpiredAuthEventsBounded(options: {
	drain?: boolean
	maxBatches?: number
	maxDurationMs?: number
} = {}): Promise<AuthEventCleanupResult> {
	const startedAt = Date.now()
	const maxBatches = Math.max(
		1,
		Math.min(
			options.maxBatches ??
				(options.drain ? AUTH_EVENT_CLEANUP_MAX_BATCHES : 1),
			AUTH_EVENT_CLEANUP_MAX_BATCHES
		)
	)
	const maxDurationMs = Math.max(
		1,
		Math.min(options.maxDurationMs ?? AUTH_EVENT_CLEANUP_BUDGET_MS, AUTH_EVENT_CLEANUP_BUDGET_MS)
	)
	let deleted = 0
	let batches = 0
	let lockSkipped = false
	let stoppedByLimit = false
	let lastBatchFilled = false
	while (batches < maxBatches) {
		if (Date.now() - startedAt >= maxDurationMs) {
			stoppedByLimit = true
			break
		}
		const batch = await purgeExpiredAuthEventBatch()
		batches += 1
		if (batch.lockSkipped) {
			lockSkipped = true
			break
		}
		deleted += batch.deleted
		lastBatchFilled = batch.deleted >= AUTH_EVENT_CLEANUP_BATCH_SIZE
		if (batch.deleted < AUTH_EVENT_CLEANUP_BATCH_SIZE) break
	}
	if (batches >= maxBatches && lastBatchFilled) stoppedByLimit = true
	const [remaining] = await db.transaction(async tx => {
		await tx.execute(sql`SELECT set_config('statement_timeout', '3s', true)`)
		await tx.execute(sql`SELECT set_config('lock_timeout', '1s', true)`)
		return tx.execute<{
			remaining_expired: number
			oldest_expired_at: string | null
		}>(sql`
			SELECT
				count(*)::integer AS remaining_expired,
				min(expires_at)::text AS oldest_expired_at
			FROM bauth.auth_event
			WHERE expires_at <= CURRENT_TIMESTAMP
		`)
	})
	return {
		deleted,
		batches,
		stoppedByLimit,
		lockSkipped,
		remainingExpired: Number(remaining?.remaining_expired ?? 0),
		oldestExpiredAt: remaining?.oldest_expired_at ?? null
	}
}

/** Backwards-compatible count-only helper for opportunistic cleanup callers. */
export async function purgeExpiredAuthEvents(options: {
	drain?: boolean
} = {}): Promise<number> {
	const result = await purgeExpiredAuthEventsBounded(options)
	return result.deleted
}

async function runAuthEventCleanup(): Promise<void> {
	try {
		await purgeExpiredAuthEvents()
	} catch {
		logSafeAuthDiagnostic('warn', 'telemetry_write_failed', {
			code: 'auth_event_cleanup_failed',
			status: 503
		})
	}
}

export function scheduleAuthEventsAfterResponse(): void {
	const context = observationStorage.getStore()
	if (!context || context.flushScheduled) return
	context.flushScheduled = true
	const events = context.events.splice(0)
	const shouldRunOpportunisticCleanup =
		events.length > 0 && context.operation !== 'get-session'
	const task = async () => {
		await flushAuthEvents(events)
		if (shouldRunOpportunisticCleanup) await runAuthEventCleanup()
	}
	try {
		after(task)
	} catch {
		// Unit tests and local utility callers may not have a Next request scope.
		// Production route handlers always take the after() path.
		void task()
	}
}

export function withRequestId(response: Response, requestId: string): Response {
	const headers = new Headers(response.headers)
	headers.set('X-Request-Id', requestId)
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	})
}

function newAuthDeviceCookieValue(): string {
	return randomBytes(16).toString('base64url')
}

export function withAuthDeviceCookie(
	request: Request,
	response: Response
): Response {
	if (authDeviceCookieValueFromHeader(request.headers.get('cookie'))) return response
	const value = newAuthDeviceCookieValue()
	const context = observationStorage.getStore()
	if (context) context.deviceCookie = value
	const headers = new Headers(response.headers)
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
	headers.append(
		'set-cookie',
		`${AUTH_DEVICE_COOKIE_NAME}=${value}; Max-Age=${AUTH_DEVICE_COOKIE_MAX_AGE_SECONDS}; Path=/api; HttpOnly; SameSite=Lax${secure}`
	)
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	})
}

export async function withObservedAuthRequest(
	request: Request,
	channel: AuthChannel,
	operation: string,
	handler: () => Promise<Response>,
	options: { requestId?: string; source?: string; recordRequestEvent?: boolean } = {}
): Promise<Response> {
	const context = createAuthObservationContext(request, channel, operation, options)
	return runWithAuthObservationContext(context, async () => {
		try {
			const response = await handler()
			recordAuthRequestOutcome(response.status)
			return withRequestId(response, context.requestId)
		} catch (error) {
			logSafeAuthDiagnostic('error', 'better-auth diagnostic', error)
			recordAuthRequestOutcome(
				503,
				undefined,
				normalizeAuthErrorCode(
					typeof error === 'object' && error !== null && 'code' in error
						? (error as { code?: unknown }).code
						: undefined
				)
			)
			return withRequestId(
				Response.json(
					{
						code: 'SERVICE_UNAVAILABLE',
						message: 'Authentication is temporarily unavailable'
					},
					{ status: 503, headers: { 'Cache-Control': 'no-store' } }
				),
				context.requestId
			)
		} finally {
			scheduleAuthEventsAfterResponse()
		}
	})
}
