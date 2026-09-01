import {
	normalizeMetricPage,
	resolveWebVitalSource,
	type PlayerStatsCacheStatus,
	type AudienceHint
} from '@/lib/analytics/web-vitals'
import type { PerformanceCorrelation } from '@/lib/analytics/performance-correlation'
import type {
	ClientSignalBatchV1,
	ClientSignalDeviceGroup,
	ClientSignalMetric,
	ClientSignalResult
} from '@/lib/client-signal-contract'

const getSampleRate = () => {
	const configured = Number(process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE)
	if (!Number.isFinite(configured))
		return process.env.NODE_ENV === 'production' ? 0.25 : 1
	return Math.min(1, Math.max(0, configured))
}

const getDeviceGroup = (): ClientSignalDeviceGroup => {
	if (window.innerWidth < 640) return 'mobile'
	if (window.innerWidth < 1024) return 'tablet'
	return 'desktop'
}

const shouldSample = (metricId: string, page: string) => {
	const sampleRate = getSampleRate()
	if (sampleRate <= 0) return false
	if (sampleRate >= 1) return true

	let hash = 2166136261
	for (const character of `${metricId}:${page}`) {
		hash ^= character.charCodeAt(0)
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0) / 2 ** 32 < sampleRate
}

export function resolveAudienceHint(
	root: Pick<Document, 'querySelector'> = document
): AudienceHint {
	const value = root
		.querySelector('[data-home-audience-hint]')
		?.getAttribute('data-home-audience-hint')
	return value === 'public' || value === 'session-hint' ? value : 'unknown'
}

export type BrowserPerformanceMetric = {
	name: string
	value: number
	delta: number
	rating: string
	metricId: string
	page: string
	audienceHint: AudienceHint
	navigationId?: string
	interactionId?: string
	cacheStatus?: PlayerStatsCacheStatus
}

export function resolveNavigationId(
	root: Pick<Document, 'querySelector'> = document
): string | undefined {
	return (
		root
			.querySelector('[data-player-stats-navigation-id]')
			?.getAttribute('data-player-stats-navigation-id') ?? undefined
	)
}

export type BrowserPerformanceContext = PerformanceCorrelation

function sendBrowserPayload(payload: string): void {
	if (navigator.sendBeacon) {
		const accepted = navigator.sendBeacon(
			'/api/vitals',
			new Blob([payload], { type: 'application/json' })
		)
		if (accepted) return
	}

	void fetch('/api/vitals', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload,
		keepalive: true
	}).catch(() => undefined)
}

type LiveMatchClientSignalInput = {
	view?: 'HEAD' | 'FULL'
	durationMs?: number
	decodedBytes?: number
	result?: ClientSignalResult
	revisionChanged?: boolean
}

const liveMatchSignalQueue: ClientSignalBatchV1['samples'] = []
let liveMatchSignalFlushTimer: ReturnType<typeof globalThis.setTimeout> | null =
	null

const liveMatchSignalMetric = (
	view: 'HEAD' | 'FULL',
	kind: 'duration' | 'bytes' | 'result'
): ClientSignalMetric => {
	const prefix = view === 'HEAD' ? 'live_matches_head' : 'live_matches_full'
	if (kind === 'duration') return `${prefix}_ms` as ClientSignalMetric
	if (kind === 'bytes') return `${prefix}_bytes` as ClientSignalMetric
	return `${prefix}_result` as ClientSignalMetric
}

function flushLiveMatchSignalQueue(): void {
	liveMatchSignalFlushTimer = null
	if (liveMatchSignalQueue.length === 0) return
	const samples = liveMatchSignalQueue.splice(0, 50)
	const release =
		(document.documentElement.dataset.release ?? 'browser')
			.replace(/[^A-Za-z0-9._-]/g, '-')
			.slice(0, 64) || 'browser'
	const batch: ClientSignalBatchV1 = {
		schemaVersion: 1,
		batchId: crypto.randomUUID(),
		client: 'web',
		release,
		sentAt: new Date().toISOString(),
		samples: samples.map(sample => ({
			...sample,
			observedAt: sample.observedAt
		}))
	}
	sendBrowserPayload(JSON.stringify(batch))
	if (liveMatchSignalQueue.length > 0) flushLiveMatchSignalQueue()
}

function scheduleLiveMatchSignalFlush(): void {
	if (liveMatchSignalFlushTimer !== null) return
	liveMatchSignalFlushTimer = globalThis.setTimeout(
		flushLiveMatchSignalQueue,
		250
	)
}

/**
 * Best-effort, fixed-dimension client telemetry for the V3 two-stage read.
 * It is batched off the match request path so a telemetry outage cannot delay
 * or change the authoritative page response.
 */
export function reportLiveMatchClientSignal(
	input: LiveMatchClientSignalInput
): void {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') return
	const observedAt = new Date().toISOString()
	const source = resolveWebVitalSource({
		search: window.location.search,
		webdriver: navigator.webdriver === true
	})
	const sampleSource = source === 'synthetic' ? 'synthetic' : 'real'
	const deviceGroup = getDeviceGroup()
	const addSample = (
		metric: ClientSignalMetric,
		result: ClientSignalResult,
		value?: number
	) => {
		liveMatchSignalQueue.push({
			observedAt,
			surface: 'live_matches',
			metric,
			deviceGroup,
			sampleSource,
			result,
			...(value === undefined ? {} : { value })
		})
	}

	if (input.view) {
		const result = input.result ?? 'error'
		if (input.durationMs !== undefined && Number.isFinite(input.durationMs)) {
			addSample(
				liveMatchSignalMetric(input.view, 'duration'),
				result,
				Math.min(10_000_000, Math.max(0, input.durationMs))
			)
		}
		if (
			input.decodedBytes !== undefined &&
			Number.isFinite(input.decodedBytes)
		) {
			addSample(
				liveMatchSignalMetric(input.view, 'bytes'),
				result,
				Math.min(8 * 1024 * 1024, Math.max(0, input.decodedBytes))
			)
		}
		addSample(liveMatchSignalMetric(input.view, 'result'), result)
	}
	if (input.revisionChanged) {
		addSample('live_matches_revision_changed', 'ok')
	}
	if (liveMatchSignalQueue.length === 0) return
	if (liveMatchSignalQueue.length >= 10) {
		flushLiveMatchSignalQueue()
		return
	}
	scheduleLiveMatchSignalFlush()
}

export function reportBrowserPerformanceMetric(
	metric: BrowserPerformanceMetric,
	options: { always?: boolean } = {}
): void {
	if (!options.always && !shouldSample(metric.metricId, metric.page)) return

	const payload = JSON.stringify({
		...metric,
		device: getDeviceGroup(),
		source: resolveWebVitalSource({
			search: window.location.search,
			webdriver: navigator.webdriver === true
		})
	})
	sendBrowserPayload(payload)
}

/** Report only a fixed runtime-error code; never serialize the thrown value. */
export function reportBrowserRuntimeError(): void {
	const payload = JSON.stringify({
		kind: 'runtime_error',
		page: normalizeMetricPage(window.location.pathname),
		device: getDeviceGroup(),
		source: resolveWebVitalSource({
			search: window.location.search,
			webdriver: navigator.webdriver === true
		})
	})
	sendBrowserPayload(payload)
}
