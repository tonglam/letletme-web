// NOTE: deliberately no 'server-only' import — test/entry-sync.test.ts and
// scripts/backfill-entry-sync.ts import this module under plain node/tsx,
// where the server-only marker throws. Server-side by usage: imported from
// lib/fpl-entry-binding.ts (server-only) and operator scripts.

const ENTRY_SYNC_TIMEOUT_MS = 10_000

export type EntrySyncResult =
	| { ok: true; status: 'queued'; jobId: string }
	| { ok: true; status: 'completed'; jobId: null }
	| { ok: false; reason: string; retryable: boolean }

export type EntrySyncBatchCounts = {
	completed: number
	queued: number
	failed: number
}

export const countEntrySyncResults = (
	results: readonly EntrySyncResult[]
): EntrySyncBatchCounts =>
	results.reduce<EntrySyncBatchCounts>(
		(counts, result) => {
			if (!result.ok) counts.failed += 1
			else if (result.status === 'queued') counts.queued += 1
			else counts.completed += 1
			return counts
		},
		{ completed: 0, queued: 0, failed: 0 }
	)

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const getEntrySyncBaseUrl = (): string =>
	(
		process.env.LETLETME_DATA_URL ||
		process.env.TOURNAMENT_API_BASE_URL ||
		'http://127.0.0.1:4001'
	).replace(/\/+$/, '')

const getEntrySyncApiKey = (): string =>
	(process.env.LETLETME_DATA_API_KEY || process.env.TOURNAMENT_API_KEY || '').trim()

/**
 * Ask letletme_data to pull an entry from the FPL API into entry_infos and the
 * EntryInfo:{season} Redis hash. Never throws — binding must not fail because
 * the sync service is down; the daily cron repairs the gap once it lands.
 */
export async function requestEntryInfoSync(
	entryId: number,
	options?: { timeoutMs?: number },
): Promise<EntrySyncResult> {
	const timeoutMs = options?.timeoutMs ?? ENTRY_SYNC_TIMEOUT_MS
	const baseUrl = getEntrySyncBaseUrl()
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

	const headers = new Headers({ 'Content-Type': 'application/json' })
	const apiKey = getEntrySyncApiKey()
	if (apiKey) headers.set('x-api-key', apiKey)

	try {
		const res = await fetch(`${baseUrl}/entry-info/${entryId}/sync`, {
			method: 'POST',
			headers,
			signal: controller.signal,
			cache: 'no-store',
		})
		if (res.ok) {
			if (res.status !== 202) {
				// Backward-compatible during rolling deploys against the former synchronous endpoint.
				return { ok: true, status: 'completed', jobId: null }
			}

			const body: unknown = await res.json().catch(() => null)
			if (
				isRecord(body) &&
				body.status === 'queued' &&
				typeof body.jobId === 'string' &&
				body.jobId.length > 0
			) {
				return { ok: true, status: 'queued', jobId: body.jobId }
			}

			return {
				ok: false,
				retryable: true,
				reason: 'invalid queued response from entry sync service',
			}
		}
		if (res.status === 401 || res.status === 403) {
			return {
				ok: false,
				retryable: false,
				reason: `auth rejected (${res.status}) — check LETLETME_DATA_API_KEY against Data's DATA_API_KEY_HASHES`,
			}
		}
		const snippet = (await res.text().catch(() => '')).slice(0, 120)
		// 5xx is a transient service problem worth retrying; 4xx is not.
		return {
			ok: false,
			retryable: res.status >= 500,
			reason: `status ${res.status}${snippet ? `: ${snippet}` : ''}`,
		}
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return { ok: false, retryable: true, reason: `timed out after ${timeoutMs / 1000}s: ${baseUrl}` }
		}
		return { ok: false, retryable: true, reason: `unavailable: ${baseUrl}` }
	} finally {
		clearTimeout(timeoutId)
	}
}

const DEFAULT_RETRY_DELAYS_MS = [2_000, 5_000]

/**
 * Sync with a small bounded retry: the common failure is the data service
 * cold-starting or restarting at bind time, which a couple of retries inside
 * the post-response window absorbs. Deliberately NOT a durable queue — if
 * all attempts fail, the operator backfill script (or a rebind) repairs the
 * gap; the entry row missing only affects live-tournament display until then.
 */
export async function syncEntryAfterBind(
	entryId: number,
	options?: { retryDelaysMs?: number[] },
): Promise<void> {
	const delays = options?.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS
	let attempts = 1
	let result = await requestEntryInfoSync(entryId)
	while (!result.ok && result.retryable && attempts <= delays.length) {
		await new Promise(resolve => setTimeout(resolve, delays[attempts - 1]))
		result = await requestEntryInfoSync(entryId)
		attempts += 1
	}
	if (result.ok && result.status === 'queued') {
		console.info(`[entry-sync] queued entry ${entryId} as job ${result.jobId}`)
	} else if (result.ok) {
		console.info(`[entry-sync] synchronously completed entry ${entryId}`)
	} else {
		console.warn(
			`[entry-sync] sync failed for entry ${entryId} after ${attempts} attempt(s): ${result.reason}`,
		)
	}
}
