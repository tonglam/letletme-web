/**
 * Shared public cache policy for RSC GraphQL reads and (optionally) the
 * browser GraphQL proxy allowlist.
 *
 * Private / session data must always use no-store (executeServerQuery default).
 * Never put user-scoped operation names in PUBLIC_GRAPHQL_OPERATION_NAMES.
 */

export const CacheTag = {
	events: 'events',
	gameweekStats: 'gameweek-stats',
	fixtures: 'fixtures',
	market: 'market',
	priceChanges: 'price-changes',
	liveScores: 'live-scores',
	transfers: 'transfers'
} as const

export type CacheTagName = (typeof CacheTag)[keyof typeof CacheTag]

/** Seconds — aligned with FPL data cadence */
export const RevalidateSeconds = {
	/** Market desk updates ~daily; short SWR for home teaser */
	market: 60,
	priceChanges: 60,
	/** Events / GW identity and public bootstrap */
	events: 5,
	/** Aggregated public stats, fixtures, TOTW */
	publicStats: 300,
	/** Rarely changing overall season summary on home */
	homeInsights: 3600
} as const

export function publicFetchOptions(opts: {
	revalidate: number
	tags: CacheTagName[]
}): {
	cache: 'force-cache'
	next: { revalidate: number; tags: string[] }
	timeoutMs: number
} {
	return {
		cache: 'force-cache',
		next: { revalidate: opts.revalidate, tags: [...opts.tags] },
		timeoutMs: 5_000
	}
}

/**
 * Operation names safe to CDN-cache on the GraphQL proxy when there is
 * no session and no Authorization header. Keep tightly curated.
 */
export const PUBLIC_GRAPHQL_OPERATION_NAMES = new Set([
	'GetCurrentAndNextEvents',
	'GetEventStatsById',
	'GetEventOverallResult',
	'GetEventFixtures',
	'GetMarketPulse',
	'GetPriceChangeBoard',
	'GetTopTransfersIn',
	'GetTopTransfersOut',
	'GetLiveScores',
	// Player directory / public lookups (no user context)
	'GetTeamsForPicker',
	'GetPlayersForPicker',
	'SearchPlayersForPicker',
	'SearchEntries',
	'GetPlayerDetail',
	'GetPlayerValueHistory',
	'PublicLeagueTrends',
	'PublicLeagueSelectionStats',
	'TrendCohorts',
	'TrendCohortSnapshot'
])

/** CDN edge cache for allowlisted public proxy responses */
export const PUBLIC_PROXY_CACHE_CONTROL =
	'public, s-maxage=60, stale-while-revalidate=300, no-transform'

export const PRICE_CHANGE_PROXY_CACHE_CONTROL =
	'public, s-maxage=60, stale-while-revalidate=60, no-transform'

export function extractGraphQLOperationName(body: unknown): string | null {
	if (body == null || typeof body !== 'object') return null
	const record = body as { operationName?: unknown; query?: unknown }
	if (typeof record.operationName === 'string' && record.operationName.trim()) {
		return record.operationName.trim()
	}
	if (typeof record.query !== 'string') return null
	const match = record.query.match(
		/\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/
	)
	return match?.[1] ?? null
}

export function publicGraphQLProxyCacheControl(
	operationName: string | null
): string {
	return operationName === 'GetPriceChangeBoard'
		? PRICE_CHANGE_PROXY_CACHE_CONTROL
		: PUBLIC_PROXY_CACHE_CONTROL
}

export function isPublicCacheableGraphQLRequest(input: {
	body: unknown
	hasSessionUser: boolean
	hasAuthorization: boolean
}): boolean {
	if (input.hasSessionUser || input.hasAuthorization) return false
	const name = extractGraphQLOperationName(input.body)
	if (!name) return false
	return PUBLIC_GRAPHQL_OPERATION_NAMES.has(name)
}
