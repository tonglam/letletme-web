import { recordBugReportDiagnostic } from '@/lib/bug-report-diagnostics'
import { resolveServerGraphQLEndpoint } from '@/lib/graphql-endpoint'
import { publicGraphQLRequestMessage } from '@/lib/safe-errors'

const getGraphQLEndpoint = () => {
	if (typeof window === 'undefined') {
		return resolveServerGraphQLEndpoint()
	}
	return `${window.location.origin}/api/graphql`
}

export interface ExecuteQueryOptions {
	cache?: RequestCache
	next?: { revalidate?: number | false; tags?: string[] }
	headers?: Record<string, string>
	/** Explicit consumer contract required by version-gated GraphQL roots. */
	contract?: 'my-tournament-review-v2' | 'live-points-v2'
	timeoutMs?: number
	signal?: AbortSignal
	/** Error codes the immediate caller deliberately catches and recovers from. */
	handledErrorCodes?: readonly string[]
	/** Optional server-side sections may recover without generic console diagnostics. */
	suppressErrorLog?: boolean
}

type GraphQLRequestErrorOptions = {
	status?: number
	code?: string | null
	retryAfterSeconds?: number | null
	rateLimitPolicy?: string | null
	rateLimitScope?: string | null
	rateLimitWorkload?: string | null
}

export class GraphQLRequestError extends Error {
	readonly status: number
	readonly code: string | null
	readonly retryAfterSeconds: number | null
	readonly rateLimitPolicy: string | null
	readonly rateLimitScope: string | null
	readonly rateLimitWorkload: string | null

	constructor(message: string, options: GraphQLRequestErrorOptions = {}) {
		super(message)
		this.name = 'GraphQLRequestError'
		this.status = options.status ?? 0
		this.code = options.code ?? null
		this.retryAfterSeconds = options.retryAfterSeconds ?? null
		this.rateLimitPolicy = options.rateLimitPolicy ?? null
		this.rateLimitScope = options.rateLimitScope ?? null
		this.rateLimitWorkload = options.rateLimitWorkload ?? null
	}
}

export const DEFAULT_GRAPHQL_TIMEOUT_MS = 15_000

export const normalizeGraphQLTimeoutMs = (timeoutMs?: number): number =>
	typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
		? timeoutMs
		: DEFAULT_GRAPHQL_TIMEOUT_MS
const PUBLIC_BROWSER_CACHE_TTL_MS = 60_000
const PUBLIC_BROWSER_CACHE_MAX_ENTRIES = 50
const PUBLIC_BROWSER_OPERATION_ALLOWLIST = new Set([
	'GetPlayerBasic',
	'GetPlayerDetail',
	'GetPlayerOverall',
	'GetPlayerStateContext',
	'GetPlayerStateProfile',
	'GetPlayersForPicker',
	'GetTeamsForPicker',
	'SearchPlayersForPicker',
	'SearchEntries'
])

export const LIVE_POINTS_CONTRACT_HEADER = 'X-LetLetMe-Contract'
export const LIVE_POINTS_CONTRACT_VERSION = 'live-points-v2'
export const LIVE_MATCHES_CONTRACT_VERSION = 'live-matches-v3'

export const LIVE_POINTS_V2_ROOT_FIELDS = [
	'calcLivePointsByEntry',
	'calcLivePointsForEntries',
	'liveScores',
	'playerLive',
	'eventLive',
	'eventLiveExplain',
	'eventLiveExplains',
	'liveSnapshot',
	'liveContext',
	'entryLiveCompetitionBoard',
	'leagueLiveHead',
	'tournamentOfficialH2H',
	'tournamentOfficialH2HHistory',
	'tournamentSelectionIndex',
	'tournamentEntrySquads',
	'tournamentDetailDesk',
	'gameweekDesk',
	'homeGameweek'
] as const

const LIVE_POINTS_V2_ROOT_FIELD_PATTERN = new RegExp(
	`\\b(?:${LIVE_POINTS_V2_ROOT_FIELDS.join('|')})\\s*(?:\\(|\\{)`
)

/**
 * Live Points is a breaking contract. Keep the gate in the shared request
 * path so an individual page, RSC seed, or explain refresh cannot silently
 * omit the required V2 header.
 */
export const requiresLivePointsV2Contract = (query: string): boolean =>
	LIVE_POINTS_V2_ROOT_FIELD_PATTERN.test(query)

export const requiresLiveMatchesV3Contract = (query: string): boolean =>
	/\bliveMatchday\s*(?:\(|\{)/.test(query)

export const liveContractVersionForQuery = (query: string): string | null => {
	const matches = requiresLiveMatchesV3Contract(query)
	const points = requiresLivePointsV2Contract(query)
	if (matches && points) throw new Error('LIVE_CONTRACT_MIXED_OPERATION')
	if (matches) return LIVE_MATCHES_CONTRACT_VERSION
	if (points) return LIVE_POINTS_CONTRACT_VERSION
	return null
}

export const extractOperationName = (query: string): string | undefined =>
	query.match(
		/\b(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/
	)?.[1]

const GRAPHQL_SLOW_REQUEST_THRESHOLD_MS = 750

const syntheticBrowserTelemetryHeaders = (): Record<string, string> => {
	if (typeof window === 'undefined') return {}
	const params = new URLSearchParams(window.location.search)
	if (
		params.get('_perfSource') === 'synthetic' ||
		params.get('cold') !== null ||
		Array.from(params.keys()).some(key =>
			/^_[a-z0-9-]*perf(?:ormance)?$/i.test(key)
		)
	)
		return { 'X-Letletme-Perf-Source': 'synthetic' }
	return {}
}

type GraphQLErrorLike = {
	message?: string
	path?: string[]
	extensions?: unknown
}

const normalizeGraphQLErrors = (errors: unknown): GraphQLErrorLike[] => {
	if (errors == null) return []
	if (Array.isArray(errors)) {
		return errors
			.filter((item): item is NonNullable<typeof item> => item != null)
			.map(item =>
				typeof item === 'object'
					? (item as GraphQLErrorLike)
					: { message: String(item) }
			)
	}
	if (typeof errors === 'object') {
		return Object.keys(errors as Record<string, unknown>).length > 0
			? [errors as GraphQLErrorLike]
			: []
	}
	if (typeof errors === 'string' && errors.trim().length > 0) {
		return [{ message: errors }]
	}
	return []
}

const extensionsHasDetail = (extensions: unknown): boolean => {
	if (extensions == null || typeof extensions !== 'object') return false
	return Object.keys(extensions as Record<string, unknown>).length > 0
}

const isMeaningfulGraphQLError = (error: GraphQLErrorLike): boolean => {
	const message =
		typeof error.message === 'string' && error.message.trim().length > 0
			? error.message.trim()
			: ''
	if (message.length > 0) return true
	if (Array.isArray(error.path) && error.path.length > 0) return true
	if (extensionsHasDetail(error.extensions)) return true
	const keys = Object.keys(error as Record<string, unknown>)
	if (keys.length === 0) return false
	if (keys.length === 1 && keys[0] === 'message') return false
	return keys.some(key => {
		if (key === 'message' || key === 'path' || key === 'extensions')
			return false
		const value = (error as Record<string, unknown>)[key]
		return value != null && value !== ''
	})
}

const graphQLErrorCode = (
	error: GraphQLErrorLike | undefined
): string | null => {
	if (!error?.extensions || typeof error.extensions !== 'object') return null
	const code = (error.extensions as Record<string, unknown>).code
	return typeof code === 'string' && code.length > 0 ? code : null
}

const safeSerializeForLog = (value: unknown): string => {
	try {
		return JSON.stringify(value, null, 2)
	} catch {
		return String(value)
	}
}

const parseRetryAfterSeconds = (value: string | null): number | null => {
	if (!value) return null
	const seconds = Number(value)
	if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)
	const retryAt = Date.parse(value)
	return Number.isFinite(retryAt)
		? Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000))
		: null
}

const rateLimitMetadata = (response: Response) => ({
	rateLimitPolicy: response.headers.get('x-ratelimit-policy'),
	rateLimitScope: response.headers.get('x-ratelimit-scope'),
	rateLimitWorkload: response.headers.get('x-ratelimit-workload')
})

async function doFetch<T>(
	endpoint: string,
	query: string,
	variables: Record<string, unknown> | undefined,
	cache: RequestCache,
	next: ExecuteQueryOptions['next'],
	isClient: boolean,
	extraHeaders?: Record<string, string>,
	timeoutMs = DEFAULT_GRAPHQL_TIMEOUT_MS,
	externalSignal?: AbortSignal,
	handledErrorCodes?: readonly string[],
	suppressErrorLog = false
): Promise<T> {
	const startedAt = Date.now()
	const controller = new AbortController()
	const safeTimeoutMs = normalizeGraphQLTimeoutMs(timeoutMs)
	let timedOut = false
	const timeoutId = globalThis.setTimeout(() => {
		timedOut = true
		controller.abort()
	}, safeTimeoutMs)
	const abortFromCaller = () => controller.abort()
	if (externalSignal?.aborted) controller.abort()
	else
		externalSignal?.addEventListener('abort', abortFromCaller, { once: true })

	let requestId: string | undefined
	try {
		const liveContractVersion = liveContractVersionForQuery(query)
		const fetchOptions: RequestInit & { next?: ExecuteQueryOptions['next'] } = {
			method: 'POST',
			cache,
			headers: {
				'Content-Type': 'application/json',
				...(isClient ? syntheticBrowserTelemetryHeaders() : {}),
				...extraHeaders,
				...(liveContractVersion
					? {
							[LIVE_POINTS_CONTRACT_HEADER]: liveContractVersion
						}
					: {})
			},
			body: JSON.stringify({
				operationName: extractOperationName(query),
				query,
				variables
			}),
			signal: controller.signal
		}

		if (isClient) fetchOptions.credentials = 'include'
		if (next) fetchOptions.next = next

		const response = await fetch(endpoint, fetchOptions)
		requestId = response.headers.get('x-request-id') ?? undefined
		const result = await response.json().catch(() => null)
		const normalizedErrors = normalizeGraphQLErrors(result?.errors)
		const meaningfulErrors = normalizedErrors.filter(isMeaningfulGraphQLError)
		const firstError = meaningfulErrors[0]

		if (!response.ok) {
			const code =
				graphQLErrorCode(firstError) ??
				(isClient ? 'UPSTREAM_GRAPHQL_ERROR' : null)
			throw new GraphQLRequestError(
				isClient
					? publicGraphQLRequestMessage(response.status, code)
					: firstError?.message?.trim() ||
							`Request failed with status ${response.status}`,
				{
					status: response.status,
					code,
					retryAfterSeconds: parseRetryAfterSeconds(
						response.headers.get('retry-after')
					),
					...rateLimitMetadata(response)
				}
			)
		}

		if (!result || typeof result !== 'object') {
			throw new GraphQLRequestError('GraphQL response was not valid JSON.', {
				status: response.status,
				code: 'INVALID_RESPONSE'
			})
		}

		if (meaningfulErrors.length > 0) {
			const code =
				graphQLErrorCode(firstError) ??
				(isClient ? 'UPSTREAM_GRAPHQL_ERROR' : null)
			const isHandledError =
				code != null && handledErrorCodes?.includes(code) === true
			const errorMessages = meaningfulErrors
				.map((error, index) => {
					const fallback = safeSerializeForLog(error)
					const safeFallback =
						fallback && fallback !== '{}' && fallback !== 'null'
							? fallback
							: `Unknown GraphQL error at index ${index}`
					const message = error.message?.trim() || safeFallback
					const path = Array.isArray(error.path)
						? ` at ${error.path.join('.')}`
						: ''
					return `${message}${path}`
				})
				.join('; ')

			if (!isHandledError && !suppressErrorLog && isClient) {
				console.warn('GraphQL request returned an error', {
					operation: extractOperationName(query) || undefined,
					status: response.status,
					code,
					requestId,
					durationMs: Math.max(0, Date.now() - startedAt),
					timeoutMs: safeTimeoutMs
				})
			} else if (!isHandledError && !suppressErrorLog) {
				console.warn('GraphQL request returned upstream errors', {
					operation: extractOperationName(query) || undefined,
					status: response.status,
					code,
					requestId,
					durationMs: Math.max(0, Date.now() - startedAt),
					timeoutMs: safeTimeoutMs
				})
			}
			throw new GraphQLRequestError(
				isClient
					? publicGraphQLRequestMessage(response.status, code)
					: `GraphQL Error: ${errorMessages || 'Unknown GraphQL error'}`,
				{
					status: response.status,
					code,
					retryAfterSeconds: parseRetryAfterSeconds(
						response.headers.get('retry-after')
					),
					...rateLimitMetadata(response)
				}
			)
		}

		if (result.errors != null && normalizedErrors.length > 0) {
			if (isClient) {
				console.warn(
					'GraphQL response contained unusable error details; using data if present.',
					{
						operation: extractOperationName(query) || undefined,
						requestId
					}
				)
			} else {
				console.warn(
					'GraphQL response contained error entries with no usable details; using data if present.',
					safeSerializeForLog(result.errors)
				)
			}
		}

		if (result.data === undefined || result.data === null) {
			throw new GraphQLRequestError(
				result.errors != null
					? 'GraphQL response missing data (errors present but not parseable).'
					: 'GraphQL response missing data.',
				{ status: response.status, code: 'MISSING_DATA' }
			)
		}

		const durationMs = Math.max(0, Date.now() - startedAt)
		if (!isClient && durationMs >= GRAPHQL_SLOW_REQUEST_THRESHOLD_MS) {
			console.warn('GraphQL query slow', {
				operation: extractOperationName(query) || undefined,
				status: response.status,
				requestId,
				durationMs,
				timeoutMs: safeTimeoutMs
			})
		}

		if (typeof window !== 'undefined') {
			recordBugReportDiagnostic({
				at: new Date().toISOString(),
				operation: extractOperationName(query) || undefined,
				requestId,
				status: response.status
			})
		}
		return result.data as T
	} catch (error) {
		let normalizedError: unknown = error
		if (error instanceof Error && error.name === 'AbortError') {
			normalizedError = timedOut
				? new GraphQLRequestError(
						`GraphQL request timed out after ${safeTimeoutMs / 1_000}s`,
						{ code: 'REQUEST_TIMEOUT' }
					)
				: new GraphQLRequestError('GraphQL request was cancelled.', {
						code: 'REQUEST_CANCELLED'
					})
		} else if (!(error instanceof GraphQLRequestError)) {
			const message =
				error instanceof Error
					? error.message
					: typeof error === 'string'
						? error
						: safeSerializeForLog(error)
			normalizedError = new GraphQLRequestError(
				isClient ? publicGraphQLRequestMessage(0, 'NETWORK_ERROR') : message,
				{ code: 'NETWORK_ERROR' }
			)
		}

		const isCancelled =
			normalizedError instanceof GraphQLRequestError &&
			normalizedError.code === 'REQUEST_CANCELLED'
		const isHandledError =
			normalizedError instanceof GraphQLRequestError &&
			normalizedError.code != null &&
			handledErrorCodes?.includes(normalizedError.code) === true
		if (!isCancelled && !isHandledError && !suppressErrorLog) {
			if (isClient) {
				console.error('GraphQL request failed', {
					operation: extractOperationName(query) || undefined,
					status:
						normalizedError instanceof GraphQLRequestError
							? normalizedError.status
							: undefined,
					code:
						normalizedError instanceof GraphQLRequestError
							? normalizedError.code
							: 'UNKNOWN_ERROR',
					requestId
				})
			} else {
				console.error('GraphQL query failed', {
					operation: extractOperationName(query) || undefined,
					status:
						normalizedError instanceof GraphQLRequestError
							? normalizedError.status
							: undefined,
					code:
						normalizedError instanceof GraphQLRequestError
							? normalizedError.code
							: 'UNKNOWN_ERROR',
					requestId,
					durationMs: Math.max(0, Date.now() - startedAt),
					timeoutMs: safeTimeoutMs
				})
			}
			if (typeof window !== 'undefined') {
				recordBugReportDiagnostic({
					at: new Date().toISOString(),
					operation: extractOperationName(query) || undefined,
					requestId,
					...(normalizedError instanceof GraphQLRequestError
						? {
								code: normalizedError.code ?? undefined,
								status: normalizedError.status,
								retryAfterSeconds:
									normalizedError.retryAfterSeconds ?? undefined,
								rateLimitPolicy: normalizedError.rateLimitPolicy ?? undefined,
								rateLimitScope: normalizedError.rateLimitScope ?? undefined,
								workload: normalizedError.rateLimitWorkload ?? undefined
							}
						: {})
				})
			}
		}
		throw normalizedError
	} finally {
		globalThis.clearTimeout(timeoutId)
		externalSignal?.removeEventListener('abort', abortFromCaller)
	}
}

const pendingClientRequests = new Map<string, Promise<unknown>>()
const publicBrowserResponses = new Map<
	string,
	{ expiresAt: number; value: unknown }
>()

function readPublicBrowserCache<T>(key: string): T | undefined {
	const cached = publicBrowserResponses.get(key)
	if (!cached) return undefined
	if (cached.expiresAt <= Date.now()) {
		publicBrowserResponses.delete(key)
		return undefined
	}
	publicBrowserResponses.delete(key)
	publicBrowserResponses.set(key, cached)
	return cached.value as T
}

function writePublicBrowserCache<T>(key: string, value: T): void {
	publicBrowserResponses.set(key, {
		expiresAt: Date.now() + PUBLIC_BROWSER_CACHE_TTL_MS,
		value
	})
	while (publicBrowserResponses.size > PUBLIC_BROWSER_CACHE_MAX_ENTRIES) {
		const oldest = publicBrowserResponses.keys().next().value
		if (typeof oldest !== 'string') break
		publicBrowserResponses.delete(oldest)
	}
}

/** Clear request and response memory caches after authentication changes. */
export function clearPendingClientQueries(): void {
	pendingClientRequests.clear()
	publicBrowserResponses.clear()
}

export async function executeQuery<T>(
	query: string,
	variables?: Record<string, unknown>,
	options?: ExecuteQueryOptions
): Promise<T> {
	const isClient = typeof window !== 'undefined'
	const endpoint = getGraphQLEndpoint()
	const cache = options?.cache ?? 'no-store'
	const operationName = extractOperationName(query)
	const contractHeaders = options?.contract
		? { 'X-LetLetMe-Contract': options.contract }
		: undefined

	if (isClient) {
		const key = `${cache}::${options?.contract ?? ''}::${query}::${JSON.stringify(variables ?? null)}`
		const publicOperation = Boolean(
			operationName && PUBLIC_BROWSER_OPERATION_ALLOWLIST.has(operationName)
		)
		if (publicOperation) {
			const cached = readPublicBrowserCache<T>(key)
			if (cached !== undefined) return cached
		}

		if (!options?.signal) {
			const pending = pendingClientRequests.get(key) as Promise<T> | undefined
			if (pending) return pending
		}

		const promise = doFetch<T>(
			endpoint,
			query,
			variables,
			cache,
			options?.next,
			true,
			{ ...options?.headers, ...contractHeaders },
			options?.timeoutMs,
			options?.signal,
			options?.handledErrorCodes,
			options?.suppressErrorLog
		).then(result => {
			if (publicOperation) writePublicBrowserCache(key, result)
			return result
		})

		if (options?.signal) return promise
		const tracked = promise.finally(() => pendingClientRequests.delete(key))
		pendingClientRequests.set(key, tracked)
		return tracked
	}

	return doFetch<T>(
		endpoint,
		query,
		variables,
		cache,
		options?.next,
		false,
		{ ...options?.headers, ...contractHeaders },
		options?.timeoutMs,
		options?.signal,
		options?.handledErrorCodes,
		options?.suppressErrorLog
	)
}
