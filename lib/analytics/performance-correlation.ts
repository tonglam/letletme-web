export const PERFORMANCE_CORRELATION_ID_PATTERN =
	/^(?:nav|interaction|desk|metric)-[A-Za-z0-9_-]{8,52}$/

export const PLAYER_STATS_CACHE_STATUSES = [
	'hit',
	'miss',
	'stale',
	'bypass',
	'unknown'
] as const

export type PlayerStatsCacheStatus =
	(typeof PLAYER_STATS_CACHE_STATUSES)[number]

export type PerformanceCorrelation = {
	navigationId?: string
	interactionId?: string
}

export function parsePerformanceCorrelationId(
	value: unknown
): string | undefined {
	return typeof value === 'string' &&
		PERFORMANCE_CORRELATION_ID_PATTERN.test(value)
		? value
		: undefined
}

export function createPerformanceCorrelationId(prefix = 'metric'): string {
	const safePrefix =
		prefix.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12) || 'metric'
	const uuid =
		typeof globalThis.crypto?.randomUUID === 'function'
			? globalThis.crypto.randomUUID()
			: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
	return `${safePrefix}-${uuid}`.slice(0, 64)
}

export function normalizePlayerStatsCacheStatus(
	value: unknown
): PlayerStatsCacheStatus {
	return typeof value === 'string' &&
		PLAYER_STATS_CACHE_STATUSES.includes(value as PlayerStatsCacheStatus)
		? (value as PlayerStatsCacheStatus)
		: 'unknown'
}

/** Maps provider cache headers to a small privacy-safe enum for RUM. */
export function cacheStatusFromHeaders(
	headers: Pick<Headers, 'get'>
): PlayerStatsCacheStatus {
	const explicit = normalizePlayerStatsCacheStatus(
		headers.get('x-letletme-cache-status')
	)
	if (explicit !== 'unknown') return explicit

	const raw =
		headers.get('x-vercel-cache') ??
		headers.get('cf-cache-status') ??
		headers.get('x-cache')
	if (!raw) return 'unknown'
	const value = raw.trim().toUpperCase()
	if (value === 'HIT' || value === 'TCP_HIT') return 'hit'
	if (value === 'STALE' || value === 'UPDATING') return 'stale'
	if (
		value === 'MISS' ||
		value === 'REVALIDATED' ||
		value === 'EXPIRED' ||
		value === 'TCP_MISS'
	)
		return 'miss'
	if (value === 'BYPASS' || value === 'DYNAMIC' || value === 'PRIVATE')
		return 'bypass'
	return 'unknown'
}
