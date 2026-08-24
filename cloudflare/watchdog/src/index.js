import {
	disableConfiguredRecord,
	getDefaultVercelRecord,
	getConfiguredRecord,
	getEnabledRegionalApexRecords,
	isDisabledRecord,
	isDefaultVercelRecord,
	isEnabledRecord
} from './dnspod.js'

export { isDefaultVercelRecord } from './dnspod.js'

const STATE_KEY = 'watchdog-state-v1'
const FAILURE_THRESHOLD = 3
const DEFAULT_TIMEOUT_MS = 8_000
const CLAIM_TTL_MS = 2 * 60 * 1_000
const COORDINATOR_NAME = 'letletme-top'

function bool(value) {
	return value === true || value === 'true'
}

const FULL_RELEASE_SHA = /^[0-9a-f]{40}$/i

function releaseFrom(response, payload) {
	const header = response.headers.get('x-letletme-release')
	if (header) return header.trim()
	return typeof payload?.release === 'string' ? payload.release.trim() : null
}

export function hasReleaseParity(...probes) {
	const releases = probes.map(probe => probe?.release?.toLowerCase())
	return (
		releases.length > 0 &&
		releases.every(release => FULL_RELEASE_SHA.test(release || '')) &&
		new Set(releases).size === 1
	)
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
			coordinatorResetPending: parsed.coordinatorResetPending === true,
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
			coordinatorResetPending: false,
			pendingAlert: null
		}
	}
}

export function isEdgeOneRecord(record, env) {
	return isEnabledRecord(record, env)
}

export function isFallbackRecord(record, env) {
	return isDisabledRecord(record, env)
}

async function probe(url, fetchImpl, timeoutMs, expectedOrigin, requireEdgeOne) {
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
		const normalizedEdgeMarker = edgeMarker?.trim().toLowerCase() || null
		const release = releaseFrom(response, payload)
		const ok =
			response.status === 200 &&
			payload?.status === 'ok' &&
			payload?.origin === expectedOrigin &&
			(requireEdgeOne
				? normalizedEdgeMarker === 'edgeone'
				: normalizedEdgeMarker === null)
		return {
			ok,
			status: response.status,
			reason: ok ? 'ok' : 'health-mismatch',
			edgeMarker,
			release
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

async function probeEdgeOneVercelApi(url, fetchImpl, timeoutMs) {
	if (!url) return { ok: false, reason: 'url-missing' }
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort('probe-timeout'), timeoutMs)
	try {
		const response = await fetchImpl(url, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Cache-Control': 'no-store',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ query: 'query { __typename }' }),
			redirect: 'manual',
			signal: controller.signal
		})
		const payload = await response.json().catch(() => null)
		const edgeMarker = response.headers.get('x-letletme-edge')
		const originMarker = response.headers.get('x-letletme-origin')
		const release = releaseFrom(response, payload)
		const ok =
			response.status === 200 &&
			payload?.data?.__typename === 'Query' &&
			originMarker === 'vercel' &&
			edgeMarker === 'edgeone'
		return {
			ok,
			status: response.status,
			reason: ok ? 'ok' : 'health-mismatch',
			edgeMarker,
			originMarker,
			release
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

function coordinatorClient(env, options) {
	if (options.coordinator) return options.coordinator
	if (!env.FAILOVER_COORDINATOR) throw new Error('coordinator-binding-missing')
	const id = env.FAILOVER_COORDINATOR.idFromName(COORDINATOR_NAME)
	const stub = env.FAILOVER_COORDINATOR.get(id)
	const command = async operation => {
		const response = await stub.fetch(`https://watchdog-coordinator/${operation}`, { method: 'POST' })
		const payload = await response.json().catch(() => null)
		if (!response.ok || payload?.ok !== true) throw new Error(`coordinator-${response.status}`)
		return payload
	}
	return {
		recordFailure: () => command('record-failure'),
		reset: () => command('reset'),
		release: () => command('release'),
		confirm: () => command('confirm')
	}
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

async function alreadyFallbackState(env, rawState, state, record, fetchImpl, coordinator) {
	// Revalidate both sides of the fallback immediately before declaring the
	// state healthy. The first DNS read can be stale if an operator changes the
	// default record while this cron invocation is running.
	const enabledRegionalApexRecords = await getEnabledRegionalApexRecords(env, fetchImpl)
	if (enabledRegionalApexRecords.length !== 0) {
		return manualDnsState(env, rawState, state, record, fetchImpl, coordinator, 'regional')
	}
	const defaultRecord = await getDefaultVercelRecord(env, fetchImpl)
	if (!isDefaultVercelRecord(defaultRecord, env)) {
		return manualDnsState(env, rawState, state, defaultRecord, fetchImpl, coordinator, 'default')
	}

	let next = {
		...state,
		failureCount: 0,
		fallbackActive: true,
		lastAction: 'already-fallback',
		coordinatorResetPending: false
	}
	const alertKey = `fallback:${env.DNSPOD_EDGEONE_RECORD_ID}`
	const alertMessage = `letletme watchdog 已停用 DNSPod 境内 EdgeOne 记录：EdgeOne 连续失败，Vercel 健康。`
	if (next.pendingAlert) {
		next = await applyAlert(
			env,
			next,
			next.pendingAlert.key,
			next.pendingAlert.message,
			fetchImpl
		)
	} else if (next.lastAlertKey !== alertKey) {
		next = await applyAlert(env, next, alertKey, alertMessage, fetchImpl)
	}
	try {
		const coordination = await coordinator.confirm()
		next = { ...next, failureCount: coordination.failureCount }
	} catch (error) {
		console.error(JSON.stringify({
			event: 'edgeone_watchdog_coordinator_confirm_error',
			error: error instanceof Error ? error.message : String(error)
		}))
	}
	const persistedState = await saveState(env, rawState, next)
	return { action: 'already-fallback', state: next, record, persistedState }
}

async function manualDnsState(env, rawState, state, record, fetchImpl, coordinator, reason = 'regional') {
	const coordination = await coordinator.reset()
	const alertKey = `manual:${reason}:${record?.RecordId || 'unknown'}:${record?.Type || 'unknown'}:${record?.Value || 'unknown'}:${record?.Line || 'unknown'}:${record?.Status || 'unknown'}`
	const message = reason === 'default'
		? 'letletme watchdog 未改 DNSPod：默认线路的 Vercel 回退记录身份或状态不符合预期。'
		: 'letletme watchdog 未改 DNSPod：境内 EdgeOne 记录身份或状态不符合预期。'
	let next = {
		...state,
		failureCount: coordination.failureCount,
		fallbackActive: false,
		lastAction: 'manual-dns-state',
		coordinatorResetPending: false
	}
	if (state.lastAlertKey !== alertKey || state.pendingAlert?.key === alertKey) {
		next = await applyAlert(env, next, alertKey, message, fetchImpl)
	}
	await saveState(env, rawState, next)
	return { action: 'manual-dns-state', state: next, record }
}

async function failoverMutationFailure(
	env,
	rawState,
	state,
	error,
	now,
	fetchImpl,
	coordinator,
	mutationApplied
) {
	const alertKey = `${mutationApplied ? 'post-disable-verification' : 'disable-mutation'}:${env.DNSPOD_EDGEONE_RECORD_ID}`
	const reason = error instanceof Error ? error.message : String(error)
	const message = mutationApplied
		? `letletme watchdog 已修改 DNSPod 境内记录，但回退校验失败；必须人工检查 DNSPod。原因=${reason}`
		: `letletme watchdog 无法停用 DNSPod 境内记录；必须人工检查 DNSPod。原因=${reason}`
	const alertAlreadySent = state.lastAlertKey === alertKey && !state.pendingAlert
	let next = {
		...state,
		failureCount: Math.max(FAILURE_THRESHOLD, state.failureCount),
		fallbackActive: false,
		lastFailureAt: now,
		lastAction: mutationApplied ? 'post-disable-verification-failed' : 'disable-mutation-failed',
		coordinatorResetPending: false,
		lastAlertKey: alertAlreadySent ? alertKey : null,
		pendingAlert: alertAlreadySent
			? null
			: state.pendingAlert?.key === alertKey
				? state.pendingAlert
				: { key: alertKey, message }
	}
	try {
		await saveState(env, rawState, next)
	} catch (writeError) {
		console.error(JSON.stringify({
			event: 'edgeone_watchdog_failover_mutation_state_prewrite_error',
			error: writeError instanceof Error ? writeError.message : String(writeError)
		}))
	}
	next = await applyAlert(env, next, alertKey, message, fetchImpl)
	try {
		await saveState(env, rawState, next)
	} catch (writeError) {
		console.error(JSON.stringify({
			event: 'edgeone_watchdog_failover_mutation_state_write_error',
			error: writeError instanceof Error ? writeError.message : String(writeError)
		}))
	}
	try {
		await coordinator.release()
	} catch (releaseError) {
		console.error(JSON.stringify({
			event: 'edgeone_watchdog_failover_mutation_coordinator_release_error',
			error: releaseError instanceof Error ? releaseError.message : String(releaseError)
		}))
	}
	return next
}

async function bothUnhealthyState(
	env,
	rawState,
	state,
	record,
	edge,
	edgeVercel,
	vercel,
	fetchImpl,
	coordinator
) {
	const coordination = await coordinator.reset()
	const alertKey = `both-unhealthy:${edge.reason}:${edgeVercel.reason}:${vercel.reason}`
	const message = `letletme watchdog 暂不改 DNSPod：EdgeOne 与 Vercel 同时异常。EdgeOne Tencent=${edge.reason} EdgeOne Vercel=${edgeVercel.reason} Vercel=${vercel.reason}`
	let next = {
		...state,
		failureCount: coordination.failureCount,
		fallbackActive: false,
		lastAction: 'both-unhealthy',
		coordinatorResetPending: false
	}
	if (state.lastAlertKey !== alertKey || state.pendingAlert?.key === alertKey) {
		next = await applyAlert(env, next, alertKey, message, fetchImpl)
	}
	await saveState(env, rawState, next)
	return {
		action: 'both-unhealthy',
		state: next,
		edge,
		edgeVercel,
		vercel,
		releaseParity: hasReleaseParity(edge, edgeVercel, vercel),
		record
	}
}

export async function runCheck(env, options = {}) {
	const fetchImpl = options.fetchImpl || fetch
	const now = options.now || new Date().toISOString()
	const timeoutMs = Number(env.PROBE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
	const rawState = await env.FAILOVER_STATE.get(STATE_KEY)
	let state = parseState(rawState)
	if (!bool(env.WATCHDOG_ENABLED)) {
		return { action: 'disabled', state }
	}
	const coordinator = coordinatorClient(env, options)

	const record = await getConfiguredRecord(env, fetchImpl)
	if (isFallbackRecord(record, env)) {
		const enabledRegionalApexRecords = await getEnabledRegionalApexRecords(env, fetchImpl)
		if (enabledRegionalApexRecords.length !== 0) {
			return manualDnsState(env, rawState, state, record, fetchImpl, coordinator, 'regional')
		}
		const defaultRecord = await getDefaultVercelRecord(env, fetchImpl)
		if (!isDefaultVercelRecord(defaultRecord, env)) {
			return manualDnsState(env, rawState, state, defaultRecord, fetchImpl, coordinator, 'default')
		}
		return alreadyFallbackState(env, rawState, state, record, fetchImpl, coordinator)
	}
	if (!isEdgeOneRecord(record, env)) {
		return manualDnsState(env, rawState, state, record, fetchImpl, coordinator)
	}
	const defaultRecord = await getDefaultVercelRecord(env, fetchImpl)
	if (!isDefaultVercelRecord(defaultRecord, env)) {
		return manualDnsState(env, rawState, state, defaultRecord, fetchImpl, coordinator, 'default')
	}

	const [edge, edgeVercel, vercel] = await Promise.all([
		probe(env.EDGEONE_TENCENT_HEALTH_URL, fetchImpl, timeoutMs, 'tencent', true),
		probeEdgeOneVercelApi(env.EDGEONE_VERCEL_API_URL, fetchImpl, timeoutMs),
		probe(env.VERCEL_HEALTH_URL, fetchImpl, timeoutMs, 'vercel', false)
	])
	const releaseParity = hasReleaseParity(edge, edgeVercel, vercel)
	if (edge.ok && edgeVercel.ok && vercel.ok && releaseParity) {
		let coordination
		try {
			coordination = await coordinator.reset()
		} catch (error) {
			const next = {
				...state,
				failureCount: 0,
				coordinatorResetPending: true,
				lastAction: 'healthy-coordinator-reset-pending'
			}
			await saveState(env, rawState, next)
			return {
				action: 'healthy-coordinator-reset-pending',
				state: next,
				edge,
				edgeVercel,
				vercel,
				releaseParity,
				record
			}
		}
		const next = {
			...state,
			failureCount: coordination.failureCount,
			coordinatorResetPending: false,
			fallbackActive: false,
			lastAction: 'healthy',
			lastAlertKey: null,
			pendingAlert: null
		}
		await saveState(env, rawState, next)
		return { action: 'healthy', state: next, edge, edgeVercel, vercel, releaseParity, record }
	}
	if (!vercel.ok) {
		return bothUnhealthyState(env, rawState, state, record, edge, edgeVercel, vercel, fetchImpl, coordinator)
	}

	if (state.coordinatorResetPending) {
		try {
			const reset = await coordinator.reset()
			state = { ...state, failureCount: reset.failureCount, coordinatorResetPending: false }
			await saveState(env, rawState, state)
		} catch (error) {
			const next = { ...state, failureCount: 0, lastAction: 'coordinator-reset-pending' }
			await saveState(env, rawState, next)
			return {
				action: 'coordinator-reset-pending',
				state: next,
				edge,
				edgeVercel,
				vercel,
				releaseParity,
				record
			}
		}
	}

	const coordination = await coordinator.recordFailure()
	const failureCount = coordination.failureCount
	if (!coordination.shouldFailover) {
		const next = {
			...state,
			failureCount,
			fallbackActive: false,
			coordinatorResetPending: false,
			lastFailureAt: now,
			lastAction: coordination.claimHeld ? 'fallback-claim-held' : 'edge-failure-counted',
			lastAlertKey: null,
			pendingAlert: null
		}
		await saveState(env, rawState, next)
		return {
			action: coordination.claimHeld ? 'fallback-claim-held' : 'counted-failure',
			state: next,
			edge,
			edgeVercel,
			vercel,
			releaseParity,
			record
		}
	}

	// Health probes can take several seconds. Re-read the record immediately
	// before the mutation so an operator's DNS change wins the race.
	const latestRecord = await getConfiguredRecord(env, fetchImpl)
	if (isFallbackRecord(latestRecord, env)) {
		const enabledRegionalApexRecords = await getEnabledRegionalApexRecords(env, fetchImpl)
		if (enabledRegionalApexRecords.length !== 0) {
			return manualDnsState(env, rawState, state, latestRecord, fetchImpl, coordinator, 'regional')
		}
		const latestDefaultRecord = await getDefaultVercelRecord(env, fetchImpl)
		if (!isDefaultVercelRecord(latestDefaultRecord, env)) {
			return manualDnsState(env, rawState, state, latestDefaultRecord, fetchImpl, coordinator, 'default')
		}
		return alreadyFallbackState(env, rawState, state, latestRecord, fetchImpl, coordinator)
	}
	if (!isEdgeOneRecord(latestRecord, env)) {
		return manualDnsState(env, rawState, state, latestRecord, fetchImpl, coordinator)
	}
	const latestDefaultRecord = await getDefaultVercelRecord(env, fetchImpl)
	if (!isDefaultVercelRecord(latestDefaultRecord, env)) {
		return manualDnsState(env, rawState, state, latestDefaultRecord, fetchImpl, coordinator, 'default')
	}

	let updated
	let mutationApplied = false
	try {
		updated = await disableConfiguredRecord(env, fetchImpl)
		mutationApplied = true
		const disabledRecord = await getConfiguredRecord(env, fetchImpl)
		const enabledRegionalApexRecords = await getEnabledRegionalApexRecords(env, fetchImpl)
		const postDisableDefaultRecord = await getDefaultVercelRecord(env, fetchImpl)
		if (
			!isFallbackRecord(disabledRecord, env) ||
			enabledRegionalApexRecords.length !== 0 ||
			!isDefaultVercelRecord(postDisableDefaultRecord, env)
		) {
			throw new Error('dnspod-disabled-record-verification-failed')
		}
	} catch (error) {
		await failoverMutationFailure(
			env,
			rawState,
			state,
			error,
			now,
			fetchImpl,
			coordinator,
			mutationApplied
		)
		throw error
	}
	const alertKey = `fallback:${env.DNSPOD_EDGEONE_RECORD_ID}`
	const message = `letletme watchdog 已停用 DNSPod 境内 EdgeOne 记录：连续 ${failureCount} 次异常，Vercel 健康。`
	let next = {
		...state,
		failureCount,
		fallbackActive: true,
		lastFailureAt: now,
		lastAction: 'fallback-applied',
		coordinatorResetPending: false,
		lastAlertKey: null,
		pendingAlert: { key: alertKey, message }
	}
	try {
		await saveState(env, rawState, next)
	} catch (error) {
		console.error(JSON.stringify({
			event: 'edgeone_watchdog_state_prewrite_error',
			error: error instanceof Error ? error.message : String(error)
		}))
	}
	next = await applyAlert(env, next, alertKey, message, fetchImpl)
	try {
		await saveState(env, rawState, next)
	} catch (error) {
		console.error(JSON.stringify({
			event: 'edgeone_watchdog_state_write_error',
			error: error instanceof Error ? error.message : String(error)
		}))
	}
	try {
		await coordinator.confirm()
	} catch (error) {
		console.error(JSON.stringify({
			event: 'edgeone_watchdog_coordinator_confirm_error',
			error: error instanceof Error ? error.message : String(error)
		}))
	}
	return { action: 'fallback-applied', state: next, edge, edgeVercel, vercel, releaseParity, record, updated }
}

export class FailoverCoordinator {
	constructor(ctx) {
		this.ctx = ctx
	}

	async readState() {
		return (await this.ctx.storage.get('state')) || { failureCount: 0, claimAt: 0 }
	}

	async writeState(state) {
		await this.ctx.storage.put('state', state)
		return state
	}

	async fetch(request) {
		const operation = new URL(request.url).pathname.replace(/^\/+/, '')
		const state = await this.readState()
		const now = Date.now()
		if (operation === 'record-failure') {
			const claimFresh = state.claimAt > 0 && now - state.claimAt < CLAIM_TTL_MS
			if (claimFresh) {
				return Response.json({ ok: true, failureCount: state.failureCount, shouldFailover: false, claimHeld: true })
			}
			const failureCount = Math.min(FAILURE_THRESHOLD, state.failureCount + 1)
			const shouldFailover = failureCount >= FAILURE_THRESHOLD
			await this.writeState({ failureCount, claimAt: shouldFailover ? now : 0 })
			return Response.json({ ok: true, failureCount, shouldFailover, claimHeld: false })
		}
		if (operation === 'reset' || operation === 'confirm') {
			await this.writeState({ failureCount: 0, claimAt: 0 })
			return Response.json({ ok: true, failureCount: 0 })
		}
		if (operation === 'release') {
			await this.writeState({ ...state, claimAt: 0 })
			return Response.json({ ok: true, failureCount: state.failureCount })
		}
		return new Response('not-found', { status: 404 })
	}
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
