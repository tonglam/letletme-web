export type ClientSignalClient = 'web' | 'wechat_miniprogram'
export type ClientSignalSurface =
	| 'home'
	| 'live_matches'
	| 'live_match'
	| 'live_entry'
	| 'price_changes'
	| 'my_fpl'
	| 'player_stats'
	| 'fixtures'
	| 'auth'
	| 'other'
export type ClientSignalMetric =
	| 'route_ready_ms'
	| 'api_duration_ms'
	| 'graphql_proxy_ms'
	| 'lcp_ms'
	| 'inp_ms'
	| 'cls'
	| 'availability'
	| 'auth_result'
	| 'runtime_error'
	| 'update_failure'
	| 'last_good_age_ms'
	| 'live_matches_head_ms'
	| 'live_matches_full_ms'
	| 'live_matches_head_bytes'
	| 'live_matches_full_bytes'
	| 'live_matches_head_result'
	| 'live_matches_full_result'
	| 'live_matches_revision_changed'
export type ClientSignalDeviceGroup =
	| 'mobile'
	| 'tablet'
	| 'desktop'
	| 'wechat_phone'
	| 'wechat_devtools'
	| 'unknown'
export type ClientSignalSampleSource = 'real' | 'synthetic'
export type ClientSignalResult =
	'ok' | 'error' | 'timeout' | 'auth_error' | 'stale' | 'unavailable'

export type ClientSignalBatchV1 = {
	schemaVersion: 1
	batchId: string
	client: ClientSignalClient
	release: string
	sentAt: string
	samples: Array<{
		observedAt: string
		surface: ClientSignalSurface
		metric: ClientSignalMetric
		deviceGroup: ClientSignalDeviceGroup
		sampleSource: ClientSignalSampleSource
		result: ClientSignalResult
		value?: number
	}>
}

/** Replace the client-provided rollout label at a trusted server boundary. */
export function withServerRelease(
	batch: ClientSignalBatchV1,
	release: string
): ClientSignalBatchV1 {
	return { ...batch, release }
}

const CLIENTS = new Set<ClientSignalClient>(['web', 'wechat_miniprogram'])
const SURFACES = new Set<ClientSignalSurface>([
	'home',
	'live_matches',
	'live_match',
	'live_entry',
	'price_changes',
	'my_fpl',
	'player_stats',
	'fixtures',
	'auth',
	'other'
])
const METRICS = new Set<ClientSignalMetric>([
	'route_ready_ms',
	'api_duration_ms',
	'graphql_proxy_ms',
	'lcp_ms',
	'inp_ms',
	'cls',
	'availability',
	'auth_result',
	'runtime_error',
	'update_failure',
	'last_good_age_ms',
	'live_matches_head_ms',
	'live_matches_full_ms',
	'live_matches_head_bytes',
	'live_matches_full_bytes',
	'live_matches_head_result',
	'live_matches_full_result',
	'live_matches_revision_changed'
])
const DEVICE_GROUPS = new Set<ClientSignalDeviceGroup>([
	'mobile',
	'tablet',
	'desktop',
	'wechat_phone',
	'wechat_devtools',
	'unknown'
])
const SAMPLE_SOURCES = new Set<ClientSignalSampleSource>(['real', 'synthetic'])
const RESULTS = new Set<ClientSignalResult>([
	'ok',
	'error',
	'timeout',
	'auth_error',
	'stale',
	'unavailable'
])
const NUMERIC_METRICS = new Set<ClientSignalMetric>([
	'route_ready_ms',
	'api_duration_ms',
	'graphql_proxy_ms',
	'lcp_ms',
	'inp_ms',
	'cls',
	'last_good_age_ms',
	'live_matches_head_ms',
	'live_matches_full_ms',
	'live_matches_head_bytes',
	'live_matches_full_bytes'
])
const MAX_NUMERIC_VALUES: Partial<Record<ClientSignalMetric, number>> = {
	route_ready_ms: 10_000_000,
	api_duration_ms: 10_000_000,
	graphql_proxy_ms: 10_000_000,
	lcp_ms: 10_000_000,
	inp_ms: 10_000_000,
	cls: 10,
	last_good_age_ms: 24 * 60 * 60 * 1_000,
	live_matches_head_ms: 10_000_000,
	live_matches_full_ms: 10_000_000,
	live_matches_head_bytes: 512 * 1024,
	live_matches_full_bytes: 8 * 1024 * 1024
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
	Object.keys(value).every(key => keys.includes(key))

const isUuid = (value: unknown): value is string =>
	typeof value === 'string' &&
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		value
	)

const isSafeDimension = (value: unknown): value is string =>
	typeof value === 'string' &&
	value.length > 0 &&
	value.length <= 64 &&
	/^[A-Za-z0-9._-]+$/.test(value)

const isFixedValue = <T extends string>(
	value: unknown,
	values: Set<T>
): value is T => typeof value === 'string' && values.has(value as T)

const isValidNumericValue = (
	metric: ClientSignalMetric,
	value: unknown
): value is number =>
	typeof value === 'number' &&
	Number.isFinite(value) &&
	value >= 0 &&
	value <= (MAX_NUMERIC_VALUES[metric] ?? Number.POSITIVE_INFINITY)

function validTimestamp(value: unknown, now: number): value is string {
	if (
		typeof value !== 'string' ||
		!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(
			value
		) ||
		!Number.isFinite(Date.parse(value))
	)
		return false
	const timestamp = Date.parse(value)
	return (
		timestamp >= now - 24 * 60 * 60 * 1000 && timestamp <= now + 5 * 60 * 1000
	)
}

/**
 * Validate and return only the fixed-dimension telemetry contract. This is
 * intentionally independent from the Data service so the public Web route
 * never forwards arbitrary JSON fields or client-controlled text.
 */
export function parseClientSignalBatch(
	input: unknown,
	now = Date.now()
): ClientSignalBatchV1 | null {
	if (
		!isRecord(input) ||
		!hasOnlyKeys(input, [
			'schemaVersion',
			'batchId',
			'client',
			'release',
			'sentAt',
			'samples'
		]) ||
		input.schemaVersion !== 1 ||
		!isUuid(input.batchId) ||
		!isFixedValue(input.client, CLIENTS) ||
		!isSafeDimension(input.release) ||
		!validTimestamp(input.sentAt, now) ||
		!Array.isArray(input.samples) ||
		input.samples.length < 1 ||
		input.samples.length > 50
	)
		return null

	const samples = input.samples.map(sample => {
		if (
			!isRecord(sample) ||
			!hasOnlyKeys(sample, [
				'observedAt',
				'surface',
				'metric',
				'deviceGroup',
				'sampleSource',
				'result',
				'value'
			]) ||
			!validTimestamp(sample.observedAt, now) ||
			!isFixedValue(sample.surface, SURFACES) ||
			!isFixedValue(sample.metric, METRICS) ||
			!isFixedValue(sample.deviceGroup, DEVICE_GROUPS) ||
			!isFixedValue(sample.sampleSource, SAMPLE_SOURCES) ||
			!isFixedValue(sample.result, RESULTS) ||
			(sample.value !== undefined && !NUMERIC_METRICS.has(sample.metric)) ||
			(sample.value !== undefined &&
				!isValidNumericValue(sample.metric, sample.value)) ||
			(NUMERIC_METRICS.has(sample.metric) &&
				!isValidNumericValue(sample.metric, sample.value))
		)
			return null
		return {
			observedAt: sample.observedAt,
			surface: sample.surface,
			metric: sample.metric,
			deviceGroup: sample.deviceGroup,
			sampleSource: sample.sampleSource,
			result: sample.result,
			...(sample.value === undefined ? {} : { value: sample.value })
		}
	})
	if (samples.some(sample => sample === null)) return null

	return {
		schemaVersion: 1,
		batchId: input.batchId,
		client: input.client,
		release: input.release,
		sentAt: input.sentAt,
		samples: samples as ClientSignalBatchV1['samples']
	}
}
