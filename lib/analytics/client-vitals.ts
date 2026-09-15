import {
	normalizeMetricPage,
	resolveWebVitalSource,
	ROUTE_READY_METRIC_NAMES,
	type PlayerStatsCacheStatus,
	type AudienceHint
} from '@/lib/analytics/web-vitals'
import type { PerformanceCorrelation } from '@/lib/analytics/performance-correlation'
import type {
	ClientSignalBatchV2,
	ClientSignalDeviceGroup,
	ClientSignalMetric,
	ClientSignalSampleSource,
	ClientSignalResult,
	ClientSignalReasonCode,
	ClientSignalMeasurementKind,
	ClientSignalSurface
} from '@/lib/client-signal-contract'
import { normalizeClientSignalSamplingProbability } from '@/lib/client-signal-contract'

const getSampleRate = () => {
	const configured = Number(process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE)
	return normalizeClientSignalSamplingProbability(
		configured,
		process.env.NODE_ENV === 'production' ? 0.25 : 1
	)
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
	measurementKind?: ClientSignalMeasurementKind
	result?: ClientSignalResult
	reasonCode?: ClientSignalReasonCode
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

function clientMetricForBrowserPerformance(
	name: string
): ClientSignalMetric | null {
	if (name === 'CLS') return 'cls'
	if (name === 'LCP') return 'lcp_ms'
	if (name === 'INP') return 'inp_ms'
	if (ROUTE_READY_METRIC_NAMES.has(name)) return 'route_ready_ms'
	return null
}

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

const liveMatchSignalQueue: ClientSignalBatchV2['samples'] = []
let liveMatchSignalFlushTimer: ReturnType<typeof globalThis.setTimeout> | null =
	null
const MAX_RUNTIME_ERROR_FINGERPRINTS = 32
const RUNTIME_ERROR_DEDUPE_WINDOW_MS = 60_000
const MAX_RUNTIME_ERROR_OCCURRENCES_PER_SAMPLE = 1_000
const FIRST_PARTY_BUILD_HOSTS = new Set([
	'letletme.top',
	'www.letletme.top',
	'letletme-web.vercel.app'
])
type RuntimeErrorAggregate = {
	errorClass: string
	fingerprint: string
	page: string
	surface: ClientSignalSurface
	deviceGroup: ClientSignalDeviceGroup
	sampleSource: ClientSignalSampleSource
	firstObservedAt: string | null
	lastObservedAt: string
	occurrenceCount: number
	reportedCount: number
	timer: ReturnType<typeof globalThis.setTimeout> | null
}
const seenRuntimeErrorObjects = new WeakSet<object>()
const runtimeErrorAggregates = new Map<string, RuntimeErrorAggregate>()
const MAX_RUNTIME_ERROR_FINGERPRINT_LENGTH = 128

type RuntimeErrorDimensions = Pick<
	RuntimeErrorAggregate,
	'page' | 'surface' | 'deviceGroup' | 'sampleSource'
>

const runtimeErrorAggregationKey = (
	fingerprint: string,
	dimensions: RuntimeErrorDimensions
): string =>
	[
		fingerprint,
		dimensions.page,
		dimensions.deviceGroup,
		dimensions.sampleSource
	].join('\u0000')

const liveMatchSignalMetric = (
	view: 'HEAD' | 'FULL',
	kind: 'duration' | 'bytes' | 'result'
): ClientSignalMetric => {
	const prefix = view === 'HEAD' ? 'live_matches_head' : 'live_matches_full'
	if (kind === 'duration') return `${prefix}_ms` as ClientSignalMetric
	if (kind === 'bytes') return `${prefix}_bytes` as ClientSignalMetric
	return `${prefix}_result` as ClientSignalMetric
}

function clientRelease(): string {
	const release =
		document.documentElement.dataset.release ??
		process.env.LETLETME_RELEASE_SHA ??
		'unknown'
	return release.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 128) || 'unknown'
}

function reasonCodeForResult(
	result: ClientSignalResult
): ClientSignalReasonCode {
	if (result === 'auth_error') return 'auth'
	if (result === 'timeout') return 'upstream_timeout'
	if (result === 'unavailable') return 'unavailable'
	return result === 'error' ? 'unknown' : 'none'
}

function surfaceForPage(page: string): ClientSignalSurface {
	if (page.includes('/live/matches')) return 'live_matches'
	if (page.includes('/live/points') || page.includes('/live/competitions'))
		return 'live_entry'
	if (page.includes('/live/')) return 'live_match'
	if (page.includes('price')) return 'price_changes'
	if (page.includes('player')) return 'player_stats'
	if (page.includes('fixture')) return 'fixtures'
	if (page.includes('my-fpl') || page.includes('my_fpl')) return 'my_fpl'
	if (page === '/' || page.endsWith('/home')) return 'home'
	return 'other'
}

function flushLiveMatchSignalQueue(): void {
	liveMatchSignalFlushTimer = null
	if (liveMatchSignalQueue.length === 0) return
	const samples = liveMatchSignalQueue.splice(0, 50)
	const batch: Omit<ClientSignalBatchV2, 'ingestRelease'> = {
		schemaVersion: 2,
		batchId: crypto.randomUUID(),
		client: 'web',
		clientRelease: clientRelease(),
		sentAt: new Date().toISOString(),
		samples: samples.map(sample => ({
			...sample
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
			reasonCode: reasonCodeForResult(result),
			measurementKind: 'request',
			samplingProbability: 1,
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
	const clientMetric = clientMetricForBrowserPerformance(metric.name)
	if (!clientMetric) return

	const payload = JSON.stringify({
		schemaVersion: 2,
		batchId: crypto.randomUUID(),
		client: 'web',
		clientRelease: clientRelease(),
		sentAt: new Date().toISOString(),
		samples: [
			{
				observedAt: new Date().toISOString(),
				surface: surfaceForPage(metric.page),
				metric: clientMetric,
				metricName: metric.name,
				deviceGroup: getDeviceGroup(),
				sampleSource:
					resolveWebVitalSource({
						search: window.location.search,
						webdriver: navigator.webdriver === true
					}) === 'synthetic'
						? 'synthetic'
						: 'real',
				result: metric.result ?? 'ok',
				reasonCode:
					metric.reasonCode ??
					(metric.result ? reasonCodeForResult(metric.result) : 'none'),
				measurementKind:
					metric.measurementKind ??
					(metric.interactionId || metric.name === 'INP'
						? 'interaction'
						: 'initial_navigation'),
				samplingProbability: options.always ? 1 : getSampleRate(),
				...(metric.navigationId === undefined
					? {}
					: { navigationId: metric.navigationId }),
				...(metric.interactionId === undefined
					? {}
					: { interactionId: metric.interactionId }),
				...(metric.cacheStatus === undefined
					? {}
					: { cacheStatus: metric.cacheStatus }),
				value: metric.value
			}
		]
	})
	sendBrowserPayload(payload)
}

function flushRuntimeErrorAggregate(aggregationKey: string): void {
	const aggregate = runtimeErrorAggregates.get(aggregationKey)
	if (!aggregate) return
	aggregate.timer = null
	const occurrenceCount = aggregate.occurrenceCount - aggregate.reportedCount
	if (occurrenceCount <= 0) return
	const firstObservedAt = aggregate.firstObservedAt ?? aggregate.lastObservedAt
	aggregate.reportedCount = aggregate.occurrenceCount
	for (
		let remaining = occurrenceCount;
		remaining > 0;
		remaining -= MAX_RUNTIME_ERROR_OCCURRENCES_PER_SAMPLE
	) {
		const payload = JSON.stringify({
			schemaVersion: 2,
			batchId: crypto.randomUUID(),
			client: 'web',
			clientRelease: clientRelease(),
			sentAt: new Date().toISOString(),
			samples: [
				{
					observedAt: aggregate.lastObservedAt,
					surface: aggregate.surface,
					metric: 'runtime_error',
					deviceGroup: aggregate.deviceGroup,
					sampleSource: aggregate.sampleSource,
					result: 'error',
					reasonCode: 'unknown',
					measurementKind: 'request',
					samplingProbability: 1,
					errorClass: aggregate.errorClass,
					fingerprint: aggregate.fingerprint,
					occurrenceCount: Math.min(
						remaining,
						MAX_RUNTIME_ERROR_OCCURRENCES_PER_SAMPLE
					),
					firstObservedAt,
					lastObservedAt: aggregate.lastObservedAt
				}
			]
		})
		sendBrowserPayload(payload)
	}
	aggregate.firstObservedAt = null
}

function runtimeErrorBuildLocation(error: unknown): string {
	if (!error || typeof error !== 'object' || !('stack' in error))
		return 'unknown'
	let stack: unknown
	try {
		stack = error.stack
	} catch {
		return 'unknown'
	}
	if (typeof stack !== 'string') return 'unknown'
	// Read only a bounded prefix and accept known first-party URL/source roots.
	// The raw stack, message, host, query and user paths never leave the page.
	for (const line of stack.slice(0, 8_192).split(/\r?\n/)) {
		const match = line.match(
			/(?:^|[\s([{\"'])(?:https?:\/\/([^/\s]+))?\/((?:_next\/static|app|components|lib|src)\/[A-Za-z0-9._/\[\]-]+)/
		)
		if (!match) continue
		const host = match[1]?.toLowerCase().replace(/:\d+$/, '')
		if (host && !FIRST_PARTY_BUILD_HOSTS.has(host)) continue
		const location = match[2]
			.replace(/[^A-Za-z0-9._-]+/g, '.')
			.replace(/^\.+|\.+$/g, '')
			.slice(0, 80)
		return location || 'unknown'
	}
	return 'unknown'
}

function scheduleRuntimeErrorFlush(aggregationKey: string): void {
	const aggregate = runtimeErrorAggregates.get(aggregationKey)
	if (!aggregate || aggregate.timer) return
	aggregate.timer = globalThis.setTimeout(
		() => flushRuntimeErrorAggregate(aggregationKey),
		1_000
	)
}

function mergeRuntimeErrorCounts(
	aggregate: RuntimeErrorAggregate,
	occurrenceCount: number,
	firstObservedAt: string,
	lastObservedAt: string
): void {
	const hadPendingOccurrences =
		aggregate.occurrenceCount > aggregate.reportedCount
	const incomingFirst = Date.parse(firstObservedAt)
	const existingFirst = aggregate.firstObservedAt
	if (!hadPendingOccurrences || existingFirst === null) {
		aggregate.firstObservedAt = firstObservedAt
	} else if (Number.isFinite(incomingFirst)) {
		const currentFirst = Date.parse(existingFirst)
		if (!Number.isFinite(currentFirst) || incomingFirst < currentFirst) {
			aggregate.firstObservedAt = firstObservedAt
		}
	}

	const incomingLast = Date.parse(lastObservedAt)
	const currentLast = Date.parse(aggregate.lastObservedAt)
	if (Number.isFinite(incomingLast) && Number.isFinite(currentLast)) {
		aggregate.lastObservedAt = new Date(
			Math.max(incomingLast, currentLast)
		).toISOString()
	} else {
		aggregate.lastObservedAt = lastObservedAt
	}
	aggregate.occurrenceCount += occurrenceCount
}

function runtimeErrorHasPendingOccurrences(
	aggregate: RuntimeErrorAggregate
): boolean {
	return aggregate.occurrenceCount > aggregate.reportedCount
}

function runtimeErrorIsFlushed(aggregate: RuntimeErrorAggregate): boolean {
	return (
		aggregate.reportedCount > 0 && !runtimeErrorHasPendingOccurrences(aggregate)
	)
}

function mergePendingRuntimeErrorIntoIncoming(
	aggregate: RuntimeErrorAggregate,
	occurrenceCount: number,
	firstObservedAt: string,
	lastObservedAt: string
): {
	occurrenceCount: number
	firstObservedAt: string
	lastObservedAt: string
} {
	if (!runtimeErrorHasPendingOccurrences(aggregate)) {
		return { occurrenceCount, firstObservedAt, lastObservedAt }
	}
	const pendingCount = aggregate.occurrenceCount - aggregate.reportedCount
	const aggregateFirst = aggregate.firstObservedAt
	const incomingFirst = Date.parse(firstObservedAt)
	const pendingFirst =
		aggregateFirst === null ? Number.NaN : Date.parse(aggregateFirst)
	const aggregateLast = Date.parse(aggregate.lastObservedAt)
	const incomingLast = Date.parse(lastObservedAt)
	return {
		occurrenceCount: occurrenceCount + pendingCount,
		firstObservedAt:
			Number.isFinite(pendingFirst) &&
			(!Number.isFinite(incomingFirst) || pendingFirst < incomingFirst)
				? (aggregateFirst ?? firstObservedAt)
				: firstObservedAt,
		lastObservedAt:
			Number.isFinite(aggregateLast) &&
			(!Number.isFinite(incomingLast) || aggregateLast > incomingLast)
				? aggregate.lastObservedAt
				: lastObservedAt
	}
}

function mergeRuntimeErrorIntoOther(
	dimensions: RuntimeErrorDimensions,
	occurrenceCount: number,
	firstObservedAt: string,
	lastObservedAt: string
): string {
	const aggregationKey = runtimeErrorAggregationKey('runtime.other', dimensions)
	const existing = runtimeErrorAggregates.get(aggregationKey)
	if (existing && !runtimeErrorIsFlushed(existing)) {
		mergeRuntimeErrorCounts(
			existing,
			occurrenceCount,
			firstObservedAt,
			lastObservedAt
		)
		scheduleRuntimeErrorFlush(aggregationKey)
		return aggregationKey
	}
	if (existing && runtimeErrorIsFlushed(existing)) {
		if (existing.timer) globalThis.clearTimeout(existing.timer)
		runtimeErrorAggregates.delete(aggregationKey)
	}
	if (runtimeErrorAggregates.size < MAX_RUNTIME_ERROR_FINGERPRINTS) {
		runtimeErrorAggregates.set(aggregationKey, {
			errorClass: 'other',
			fingerprint: 'runtime.other',
			...dimensions,
			firstObservedAt,
			lastObservedAt,
			occurrenceCount,
			reportedCount: 0,
			timer: null
		})
		scheduleRuntimeErrorFlush(aggregationKey)
		return aggregationKey
	}

	const existingOverflow = Array.from(runtimeErrorAggregates.entries()).find(
		([, candidate]) =>
			candidate.fingerprint === 'runtime.other' &&
			!runtimeErrorIsFlushed(candidate)
	)
	if (existingOverflow) {
		mergeRuntimeErrorCounts(
			existingOverflow[1],
			occurrenceCount,
			firstObservedAt,
			lastObservedAt
		)
		scheduleRuntimeErrorFlush(existingOverflow[0])
		return existingOverflow[0]
	}

	const oldest =
		Array.from(runtimeErrorAggregates.entries()).find(
			([, candidate]) => candidate.fingerprint !== 'runtime.other'
		) ?? runtimeErrorAggregates.entries().next().value
	if (oldest) {
		const [oldestKey, evicted] = oldest
		const merged = mergePendingRuntimeErrorIntoIncoming(
			evicted,
			occurrenceCount,
			firstObservedAt,
			lastObservedAt
		)
		if (evicted.timer) globalThis.clearTimeout(evicted.timer)
		runtimeErrorAggregates.delete(oldestKey)
		occurrenceCount = merged.occurrenceCount
		firstObservedAt = merged.firstObservedAt
		lastObservedAt = merged.lastObservedAt
	}
	runtimeErrorAggregates.set(aggregationKey, {
		errorClass: 'other',
		fingerprint: 'runtime.other',
		...dimensions,
		firstObservedAt,
		lastObservedAt,
		occurrenceCount,
		reportedCount: 0,
		timer: null
	})
	scheduleRuntimeErrorFlush(aggregationKey)
	return aggregationKey
}

/** Report controlled runtime-error dimensions; never serialize the thrown value. */
export function reportBrowserRuntimeError(error?: unknown): void {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') return
	if (error && typeof error === 'object') {
		if (seenRuntimeErrorObjects.has(error)) return
		seenRuntimeErrorObjects.add(error)
	}
	let errorName: unknown
	if (error && typeof error === 'object') {
		try {
			errorName = 'name' in error ? error.name : undefined
		} catch {
			errorName = undefined
		}
	}
	const errorClass =
		typeof errorName === 'string'
			? errorName.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 64) || 'unknown'
			: 'unknown'
	const now = new Date().toISOString()
	const page = normalizeMetricPage(window.location.pathname)
	const dimensions: RuntimeErrorDimensions = {
		page,
		surface: surfaceForPage(page),
		deviceGroup: getDeviceGroup(),
		sampleSource:
			resolveWebVitalSource({
				search: window.location.search,
				webdriver: navigator.webdriver === true
			}) === 'synthetic'
				? 'synthetic'
				: 'real'
	}
	let fingerprint =
		`runtime.${errorClass}.${runtimeErrorBuildLocation(error)}`.slice(
			0,
			MAX_RUNTIME_ERROR_FINGERPRINT_LENGTH
		)
	let aggregationKey = runtimeErrorAggregationKey(fingerprint, dimensions)
	if (
		!runtimeErrorAggregates.has(aggregationKey) &&
		runtimeErrorAggregates.size >= MAX_RUNTIME_ERROR_FINGERPRINTS
	) {
		mergeRuntimeErrorIntoOther(dimensions, 1, now, now)
		return
	}
	const aggregate = runtimeErrorAggregates.get(aggregationKey)
	if (
		aggregate &&
		Date.parse(now) - Date.parse(aggregate.lastObservedAt) <
			RUNTIME_ERROR_DEDUPE_WINDOW_MS
	) {
		if (aggregate.occurrenceCount === aggregate.reportedCount) {
			aggregate.firstObservedAt = now
		}
		aggregate.occurrenceCount += 1
		aggregate.lastObservedAt = now
	} else {
		if (aggregate?.timer) globalThis.clearTimeout(aggregate.timer)
		runtimeErrorAggregates.set(aggregationKey, {
			errorClass: errorClass,
			fingerprint,
			...dimensions,
			firstObservedAt: now,
			lastObservedAt: now,
			occurrenceCount: 1,
			reportedCount: 0,
			timer: null
		})
	}
	scheduleRuntimeErrorFlush(aggregationKey)
}
