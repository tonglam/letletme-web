// NOTE: deliberately no 'server-only' import because the plain Node test suite
// imports this module. It is server-side by usage through fpl-entry-binding.

import { createHmac } from 'node:crypto'

import {
	PayloadTooLargeError,
	readBoundedResponseBytes,
	ResponseReadAbortedError
} from './http-response-body'

export const ENTRY_SYNC_TIMEOUT_MS = 3_000
// A Retry-After header is upstream input. Keep honoring long but operationally
// meaningful delays while preventing an unbounded value from creating an
// invalid JavaScript/PostgreSQL timestamp during outbox settlement.
export const ENTRY_SYNC_MAX_RETRY_AFTER_SECONDS = 365 * 24 * 60 * 60
const MAX_ENTRY_SYNC_RESPONSE_BYTES = 64 * 1024

export type EntrySyncResult =
	| { ok: true; status: 'queued'; jobId: string }
	| {
			ok: false
			reason: string
			retryable: boolean
			errorCode?: string
			retryAfterSeconds?: number
		}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const getEntrySyncBaseUrl = (): string =>
	(process.env.LETLETME_DATA_URL || 'http://127.0.0.1:4001').replace(/\/+$/, '')

const getEntrySyncApiKey = (): string =>
	(process.env.LETLETME_DATA_API_KEY || '').trim()

const entrySyncLogReference = (entryId: number): string | undefined => {
	const secret =
		process.env.AUTH_OBSERVABILITY_SECRET?.trim() ||
		process.env.BACKEND_PROXY_SECRET?.trim() ||
		''
	if (Buffer.byteLength(secret, 'utf8') < 32) return undefined
	return createHmac('sha256', secret)
		.update(`entry-sync:${entryId}`)
		.digest('hex')
		.slice(0, 24)
}

const safeEntrySyncErrorCode = (errorCode: string | undefined): string =>
	typeof errorCode === 'string' && /^[A-Z0-9_]{1,64}$/.test(errorCode)
		? errorCode
		: 'UPSTREAM_FAILURE'

const isAbortError = (error: unknown): boolean =>
	error instanceof ResponseReadAbortedError ||
	(error instanceof Error && error.name === 'AbortError')

const parseRetryAfterSeconds = (value: string | null): number | undefined => {
	if (!value) return undefined
	const seconds = Number(value)
	if (Number.isFinite(seconds) && seconds >= 0)
		return Math.min(
			ENTRY_SYNC_MAX_RETRY_AFTER_SECONDS,
			Math.ceil(seconds)
		)
	const retryAt = Date.parse(value)
	if (!Number.isFinite(retryAt)) return undefined
	return Math.min(
		ENTRY_SYNC_MAX_RETRY_AFTER_SECONDS,
		Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000))
	)
}

/**
 * Ask letletme_data to pull an entry from the FPL API into entry_infos and the
 * EntryInfo:{season} Redis hash. The caller owns durable retry state; this
 * function performs exactly one bounded hand-off attempt.
 */
export async function requestEntryInfoSync(
	entryId: number,
	options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<EntrySyncResult> {
	const timeoutMs = options?.timeoutMs ?? ENTRY_SYNC_TIMEOUT_MS
	const baseUrl = getEntrySyncBaseUrl()
	const controller = new AbortController()
	let timedOut = false
	let cancelledByCaller = false
	const timeoutId = setTimeout(() => {
		timedOut = true
		controller.abort()
	}, timeoutMs)
	const abortFromCaller = () => {
		cancelledByCaller = true
		controller.abort()
	}
	if (options?.signal?.aborted) abortFromCaller()
	else options?.signal?.addEventListener('abort', abortFromCaller, { once: true })

	const headers = new Headers({ 'Content-Type': 'application/json' })
	const apiKey = getEntrySyncApiKey()
	if (apiKey) headers.set('x-api-key', apiKey)

	try {
		const res = await fetch(`${baseUrl}/entry-info/${entryId}/sync`, {
			method: 'POST',
			headers,
			signal: controller.signal,
			cache: 'no-store'
		})
		const responseText = new TextDecoder().decode(
			await readBoundedResponseBytes(
				res,
				MAX_ENTRY_SYNC_RESPONSE_BYTES,
				controller.signal
			)
		)
		if (res.ok) {
			if (res.status !== 202) {
				return {
					ok: false,
					retryable: false,
					errorCode: 'INVALID_RESPONSE',
					reason: `entry sync contract requires HTTP 202, received ${res.status}`
				}
			}

			let body: unknown = null
			try {
				body = JSON.parse(responseText)
			} catch (error) {
				if (isAbortError(error)) {
					return {
						ok: false,
						retryable: true,
						errorCode: 'REQUEST_TIMEOUT',
						reason: `timed out after ${timeoutMs / 1000}s: ${baseUrl}`
					}
				}
			}
			if (
				res.status === 202 &&
				isRecord(body) &&
				body.status === 'queued' &&
				typeof body.jobId === 'string' &&
				body.jobId.trim().length > 0
			) {
				return { ok: true, status: 'queued', jobId: body.jobId.trim() }
			}

			return {
				ok: false,
				retryable: true,
				errorCode: 'INVALID_RESPONSE',
				reason: 'invalid queued response from entry sync service'
			}
		}
		if (res.status === 401 || res.status === 403) {
			return {
				ok: false,
				retryable: false,
				errorCode: `HTTP_${res.status}`,
				reason: `auth rejected (${res.status}) — check LETLETME_DATA_API_KEY against Data's DATA_API_KEY_HASHES`
			}
		}
		const snippet = responseText.slice(0, 120)
		// 429/408 and 5xx are transient service problems worth retrying; other
		// 4xx responses are configuration or contract failures.
		return {
			ok: false,
			retryable: res.status === 408 || res.status === 429 || res.status >= 500,
			errorCode: `HTTP_${res.status}`,
			retryAfterSeconds: parseRetryAfterSeconds(res.headers.get('retry-after')),
			reason: `status ${res.status}${snippet ? `: ${snippet}` : ''}`
		}
	} catch (error) {
		if (isAbortError(error)) {
			if (cancelledByCaller && !timedOut) {
				return {
					ok: false,
					retryable: true,
					errorCode: 'REQUEST_CANCELLED',
					reason: `cancelled while syncing: ${baseUrl}`
				}
			}
			return {
				ok: false,
				retryable: true,
				errorCode: 'REQUEST_TIMEOUT',
				reason: `timed out after ${timeoutMs / 1000}s: ${baseUrl}`
			}
		}
		if (error instanceof PayloadTooLargeError) {
			return {
				ok: false,
				retryable: false,
				errorCode: 'INVALID_RESPONSE',
				reason: 'entry sync response exceeded the bounded response size'
			}
		}
		return {
			ok: false,
			retryable: true,
			errorCode: 'UPSTREAM_UNAVAILABLE',
			reason: `unavailable: ${baseUrl}`
		}
	} finally {
		clearTimeout(timeoutId)
		options?.signal?.removeEventListener('abort', abortFromCaller)
	}
}

/**
 * Perform the one immediate post-commit hand-off. Durable callers set
 * `durable: true`, which claims and conditionally updates the outbox row; the
 * default remains a small dependency-free helper for callers/tests that only
 * need the direct Data request.
 */
export async function syncEntryAfterBind(
	entryId: number,
	options?: {
		durable?: boolean
		timeoutMs?: number
		/** @deprecated retries are intentionally no longer performed in-request. */
		retryDelaysMs?: number[]
	}
): Promise<void> {
	const entryRef = entrySyncLogReference(entryId)
	if (options?.durable) {
		try {
			const { deliverEntrySyncOutboxNow } = await import(
				'@/lib/entry-sync-outbox'
			)
			const delivery = await deliverEntrySyncOutboxNow(entryId)
			if (delivery.status === 'delivered') {
				console.info('[entry-sync] durable hand-off delivered', {
					...(entryRef ? { entryRef } : {}),
					status: delivery.status
				})
			} else {
				console.warn('[entry-sync] durable hand-off remains pending', {
					...(entryRef ? { entryRef } : {}),
					status: delivery.status,
					errorCode: safeEntrySyncErrorCode(delivery.errorCode)
				})
			}
		} catch {
			console.warn('[entry-sync] durable hand-off failed', {
				...(entryRef ? { entryRef } : {}),
				errorCode: 'OUTBOX_DELIVERY_FAILED'
			})
		}
		return
	}

	const result = await requestEntryInfoSync(entryId, {
		timeoutMs: options?.timeoutMs ?? ENTRY_SYNC_TIMEOUT_MS
	})
	if (result.ok) {
		console.info('[entry-sync] hand-off delivered', {
			...(entryRef ? { entryRef } : {}),
			status: 'queued'
		})
	} else {
		console.warn('[entry-sync] hand-off failed after 1 attempt(s)', {
			...(entryRef ? { entryRef } : {}),
			errorCode: safeEntrySyncErrorCode(result.errorCode),
			attempts: 1
		})
	}
}
