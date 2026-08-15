const STATE_KEY = 'watchdog-state-v1'
const FAILURE_THRESHOLD = 3
const DEFAULT_TIMEOUT_MS = 8_000

function bool(value) {
	return value === true || value === 'true'
}

function normalized(value) {
	return String(value ?? '').trim().replace(/\.$/, '').toLowerCase()
}

export function parseState(raw) {
	try {
		const parsed = raw ? JSON.parse(raw) : {}
		return {
			failureCount: Number.isInteger(parsed.failureCount)
				? Math.max(0, parsed.failureCount)
				: 0,
			fallbackActive: parsed.fallbackActive === true,
			lastFailureAt: parsed.lastFailureAt ?? null,
			lastAction: parsed.lastAction ?? null,
			lastAlertKey: parsed.lastAlertKey ?? null,
			pendingAlert:
				parsed.pendingAlert &&
				typeof parsed.pendingAlert.key === 'string' &&
				typeof parsed.pendingAlert.message === 'string'
					? parsed.pendingAlert
					: null
		}
	} catch {
		return {
			failureCount: 0,
			fallbackActive: false,
			lastFailureAt: null,
			lastAction: null,
			lastAlertKey: null,
			pendingAlert: null
		}
	}
}

function apiUrl(env, path) {
	const base = (env.DNS_API_BASE || 'https://api.cloudflare.com/client/v4').replace(/\/$/, '')
	return `${base}/zones/${encodeURIComponent(env.ZONE_ID)}/dns_records/${encodeURIComponent(env.DNS_RECORD_ID)}${path || ''}`
}

async function apiRequest(env, fetchImpl, method, path, body) {
	if (!env.ZONE_ID || !env.DNS_RECORD_ID || !env.CLOUDFLARE_API_TOKEN) {
		throw new Error('dns-api-configuration-missing')
	}
	const response = await fetchImpl(apiUrl(env, path), {
		method,
		headers: {
			Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
			Accept: 'application/json',
			...(body ? { 'Content-Type': 'application/json' } : {})
		},
		...(body ? { body: JSON.stringify(body) } : {})
	})
	const payload = await response.json().catch(() => null)
	if (!response.ok || payload?.success !== true) {
		throw new Error(`dns-api-${response.status}`)
	}
	return payload.result
}

export function isEdgeOneRecord(record, env) {
	return (
		record?.type === 'CNAME' &&
		normalized(record.name) === normalized(env.APEX_NAME || 'letletme.top') &&
		normalized(record.content) === normalized(env.EDGEONE_CNAME_TARGET) &&
		record.proxied === false
	)
}

export function isFallbackRecord(record, env) {
	return (
		record?.type === 'A' &&
		normalized(record.name) === normalized(env.APEX_NAME || 'letletme.top') &&
		normalized(record.content) === normalized(env.VERCEL_FALLBACK_A) &&
		record.proxied === true
	)
}

async function probe(url, fetchImpl, timeoutMs, requireEdgeOne) {
	if (!url) return { ok: false, reason: 'url-missing' }
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort('probe-timeout'), timeoutMs)
	try {
		const response = await fetchImpl(url, {
			method: 'GET',
			headers: { Accept: 'application/json', 'Cache-Control': 'no-store' },
			redirect: 'manual',
			signal: controller.signal
		})
		const payload = await response.json().catch(() => null)
		const edgeMarker = response.headers.get('x-letletme-edge')
		const ok =
			response.status === 200 &&
			payload?.status === 'ok' &&
			payload?.origin === 'vercel' &&
			(!requireEdgeOne || edgeMarker === 'edgeone')
		return {
			ok,
			status: response.status,
			reason: ok ? 'ok' : 'health-mismatch',
			edgeMarker
		}
	} catch (error) {
		return {
			ok: false,
			reason: controller.signal.aborted ? 'timeout' : 'network-error',
			error: error instanceof Error ? error.message : String(error)
		}
	} finally {
		clearTimeout(timeout)
	}
}

async function sendAlert(env, message, fetchImpl) {
	if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
		console.error(JSON.stringify({ event: 'edgeone_watchdog_alert_missing_telegram', message }))
		return { sent: false, reason: 'telegram-not-configured' }
	}
	const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`
	const response = await fetchImpl(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message })
	})
	if (!response.ok) throw new Error(`telegram-${response.status}`)
	return { sent: true }
}

async function saveState(env, rawState, state) {
	const serialized = JSON.stringify(state)
	if (serialized !== (rawState ?? '')) {
		await env.FAILOVER_STATE.put(STATE_KEY, serialized)
	}
	return serialized
}

async function applyAlert(env, state, key, message, fetchImpl) {
	if (state.lastAlertKey === key && !state.pendingAlert) return state
	try {
		const result = await sendAlert(env, message, fetchImpl)
		if (result.sent || result.reason === 'telegram-not-configured') {
			return { ...state, lastAlertKey: key, pendingAlert: null }
		}
	} catch (error) {
		console.error(JSON.stringify({
			event: 'edgeone_watchdog_alert_error',
			key,
			error: error instanceof Error ? error.message : String(error)
		}))
	}
	return { ...state, lastAlertKey: null, pendingAlert: { key, message } }
}

async function alreadyFallbackState(env, rawState, state, record, fetchImpl) {
	let next = {
		...state,
		failureCount: 0,
		fallbackActive: true,
		lastAction: 'already-fallback'
	}
	if (next.pendingAlert) {
		next = await applyAlert(
			env,
			next,
			next.pendingAlert.key,
			next.pendingAlert.message,
			fetchImpl
		)
	}
	const persistedState = await saveState(env, rawState, next)
	return { action: 'already-fallback', state: next, record, persistedState }
}

async function manualDnsState(env, rawState, state, record, fetchImpl) {
	const alertKey = `manual:${record?.type || 'unknown'}:${record?.content || 'unknown'}:${record?.proxied}`
	const message = `letletme watchdog 未改 DNS：apex 不是预期 EdgeOne 记录（当前 ${record?.type || 'unknown'} ${record?.content || 'unknown'}）。`
	let next = {
		...state,
		failureCount: 0,
		fallbackActive: false,
		lastAction: 'manual-dns-state'
	}
	if (state.lastAlertKey !== alertKey || state.pendingAlert?.key === alertKey) {
		next = await applyAlert(env, next, alertKey, message, fetchImpl)
	}
	await saveState(env, rawState, next)
	return { action: 'manual-dns-state', state: next, record }
}

async function bothUnhealthyState(env, rawState, state, record, edge, vercel, fetchImpl) {
	const alertKey = `both-unhealthy:${edge.reason}:${vercel.reason}`
	const message = `letletme watchdog 暂不回退：EdgeOne 与 Vercel 同时异常。EdgeOne=${edge.reason} Vercel=${vercel.reason}`
	let next = {
		...state,
		failureCount: 0,
		fallbackActive: false,
		lastAction: 'both-unhealthy'
	}
	if (state.lastAlertKey !== alertKey || state.pendingAlert?.key === alertKey) {
		next = await applyAlert(env, next, alertKey, message, fetchImpl)
	}
	await saveState(env, rawState, next)
	return { action: 'both-unhealthy', state: next, edge, vercel, record }
}

export async function runCheck(env, options = {}) {
	const fetchImpl = options.fetchImpl || fetch
	const now = options.now || new Date().toISOString()
	const timeoutMs = Number(env.PROBE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
	const rawState = await env.FAILOVER_STATE.get(STATE_KEY)
	const state = parseState(rawState)
	if (!bool(env.WATCHDOG_ENABLED)) {
		return { action: 'disabled', state }
	}

	const record = await apiRequest(env, fetchImpl, 'GET')
	if (isFallbackRecord(record, env)) {
		return alreadyFallbackState(env, rawState, state, record, fetchImpl)
	}
	if (!isEdgeOneRecord(record, env)) {
		return manualDnsState(env, rawState, state, record, fetchImpl)
	}

	const [edge, vercel] = await Promise.all([
		probe(env.EDGEONE_HEALTH_URL, fetchImpl, timeoutMs, true),
		probe(env.VERCEL_HEALTH_URL, fetchImpl, timeoutMs, false)
	])
	if (edge.ok) {
		const next = {
			...state,
			failureCount: 0,
			fallbackActive: false,
			lastAction: 'healthy',
			lastAlertKey: null,
			pendingAlert: null
		}
		await saveState(env, rawState, next)
		return { action: 'healthy', state: next, edge, vercel, record }
	}
	if (!vercel.ok) {
		return bothUnhealthyState(env, rawState, state, record, edge, vercel, fetchImpl)
	}

	const failureCount = state.failureCount + 1
	if (failureCount < FAILURE_THRESHOLD) {
		const next = {
			...state,
			failureCount,
			fallbackActive: false,
			lastFailureAt: now,
			lastAction: 'edge-failure-counted',
			lastAlertKey: null,
			pendingAlert: null
		}
		await saveState(env, rawState, next)
		return { action: 'counted-failure', state: next, edge, vercel, record }
	}

	// Health probes can take several seconds. Re-read the record immediately
	// before the mutation so an operator's DNS change wins the race.
	const latestRecord = await apiRequest(env, fetchImpl, 'GET')
	if (isFallbackRecord(latestRecord, env)) {
		return alreadyFallbackState(env, rawState, state, latestRecord, fetchImpl)
	}
	if (!isEdgeOneRecord(latestRecord, env)) {
		return manualDnsState(env, rawState, state, latestRecord, fetchImpl)
	}

	const fallback = {
		name: env.APEX_NAME || 'letletme.top',
		type: 'A',
		content: env.VERCEL_FALLBACK_A,
		ttl: Number(env.VERCEL_FALLBACK_TTL) || 1,
		proxied: true
	}
	const updated = await apiRequest(env, fetchImpl, 'PUT', '', fallback)
	if (!isFallbackRecord(updated, env)) throw new Error('fallback-record-verification-failed')
	const alertKey = `fallback:${env.VERCEL_FALLBACK_A}`
	const message = `letletme watchdog 已回退 Cloudflare → Vercel：EdgeOne 连续 ${failureCount} 次异常，Vercel 健康。`
	let next = {
		...state,
		failureCount,
		fallbackActive: true,
		lastFailureAt: now,
		lastAction: 'fallback-applied',
		lastAlertKey: null,
		pendingAlert: { key: alertKey, message }
	}
	const persistedState = await saveState(env, rawState, next)
	next = await applyAlert(env, next, alertKey, message, fetchImpl)
	await saveState(env, persistedState, next)
	return { action: 'fallback-applied', state: next, edge, vercel, record, updated }
}

const worker = {
	async scheduled(event, env, ctx) {
		const operation = runCheck(env)
		ctx.waitUntil(operation.catch(error => console.error(JSON.stringify({
			event: 'edgeone_watchdog_error',
			error: error instanceof Error ? error.message : String(error)
		}))))
	},
	fetch() {
		return new Response('edgeone-watchdog', { status: 404 })
	}
}

export default worker
