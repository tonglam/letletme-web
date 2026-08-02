// NOTE: deliberately no 'server-only' import — test/entry-sync.test.ts and
// scripts/backfill-entry-sync.ts import this module under plain node/tsx,
// where the server-only marker throws. Server-side by usage: imported from
// lib/fpl-entry-binding.ts (server-only) and operator scripts.

const ENTRY_SYNC_TIMEOUT_MS = 10_000 // sync does 2 FPL fetches + DB + Redis writes

export type EntrySyncResult =
	| { ok: true }
	| { ok: false; reason: string; retryable: boolean }

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
		if (res.ok) return { ok: true }
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
	if (result.ok) {
		console.info(`[entry-sync] synced entry ${entryId} into entry_infos`)
	} else {
		console.warn(
			`[entry-sync] sync failed for entry ${entryId} after ${attempts} attempt(s): ${result.reason}`,
		)
	}
}
