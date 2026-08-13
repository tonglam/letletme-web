const getGraphQLEndpoint = () => {
	if (typeof window === 'undefined') {
		return process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql'
	}
	return `${window.location.origin}/api/graphql`
}

export interface ExecuteQueryOptions {
	cache?: RequestCache
	next?: { revalidate?: number | false; tags?: string[] }
	headers?: Record<string, string>
	timeoutMs?: number
	signal?: AbortSignal
}

type GraphQLRequestErrorOptions = {
	status?: number
	code?: string | null
	retryAfterSeconds?: number | null
}

export class GraphQLRequestError extends Error {
	readonly status: number
	readonly code: string | null
	readonly retryAfterSeconds: number | null

	constructor(message: string, options: GraphQLRequestErrorOptions = {}) {
		super(message)
		this.name = 'GraphQLRequestError'
		this.status = options.status ?? 0
		this.code = options.code ?? null
		this.retryAfterSeconds = options.retryAfterSeconds ?? null
	}
}

const DEFAULT_GRAPHQL_TIMEOUT_MS = 15_000
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
	'SearchPlayersForPicker'
])

const extractOperationName = (query: string): string | undefined =>
	query.match(/\b(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/)?.[1]

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
		if (key === 'message' || key === 'path' || key === 'extensions') return false
		const value = (error as Record<string, unknown>)[key]
		return value != null && value !== ''
	})
}

const graphQLErrorCode = (error: GraphQLErrorLike | undefined): string | null => {
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

async function doFetch<T>(
	endpoint: string,
	query: string,
	variables: Record<string, unknown> | undefined,
	cache: RequestCache,
	next: ExecuteQueryOptions['next'],
	isClient: boolean,
	extraHeaders?: Record<string, string>,
	timeoutMs = DEFAULT_GRAPHQL_TIMEOUT_MS,
	externalSignal?: AbortSignal
): Promise<T> {
	const controller = new AbortController()
	const safeTimeoutMs =
		Number.isFinite(timeoutMs) && timeoutMs > 0
			? timeoutMs
			: DEFAULT_GRAPHQL_TIMEOUT_MS
	let timedOut = false
	const timeoutId = globalThis.setTimeout(() => {
		timedOut = true
		controller.abort()
	}, safeTimeoutMs)
	const abortFromCaller = () => controller.abort()
	if (externalSignal?.aborted) controller.abort()
	else externalSignal?.addEventListener('abort', abortFromCaller, { once: true })

	try {
		const fetchOptions: RequestInit & { next?: ExecuteQueryOptions['next'] } = {
			method: 'POST',
			cache,
			headers: { 'Content-Type': 'application/json', ...extraHeaders },
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
		const result = await response.json().catch(() => null)
		const normalizedErrors = normalizeGraphQLErrors(result?.errors)
		const meaningfulErrors = normalizedErrors.filter(isMeaningfulGraphQLError)
		const firstError = meaningfulErrors[0]

		if (!response.ok) {
			throw new GraphQLRequestError(
				firstError?.message?.trim() ||
					`Request failed with status ${response.status}`,
				{
					status: response.status,
					code: graphQLErrorCode(firstError),
					retryAfterSeconds: parseRetryAfterSeconds(
						response.headers.get('retry-after')
					)
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

			console.warn(
				`GraphQL errors: ${errorMessages}`,
				'\nraw:',
				safeSerializeForLog(result.errors)
			)
			throw new GraphQLRequestError(
				`GraphQL Error: ${errorMessages || 'Unknown GraphQL error'}`,
				{
					status: response.status,
					code: graphQLErrorCode(firstError)
				}
			)
		}

		if (result.errors != null && normalizedErrors.length > 0) {
			console.warn(
				'GraphQL response contained error entries with no usable details; using data if present.',
				safeSerializeForLog(result.errors)
			)
		}

		if (result.data === undefined || result.data === null) {
			throw new GraphQLRequestError(
				result.errors != null
					? 'GraphQL response missing data (errors present but not parseable).'
					: 'GraphQL response missing data.',
				{ status: response.status, code: 'MISSING_DATA' }
			)
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
			normalizedError = new GraphQLRequestError(message, {
				code: 'NETWORK_ERROR'
			})
		}

		if (
			!(
				normalizedError instanceof GraphQLRequestError &&
				normalizedError.code === 'REQUEST_CANCELLED'
			)
		) {
			console.error(
				`GraphQL query error [${endpoint}]: ${
					normalizedError instanceof Error
						? normalizedError.message
						: String(normalizedError)
				}`
			)
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

	if (isClient) {
		const key = `${cache}::${query}::${JSON.stringify(variables ?? null)}`
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
			undefined,
			options?.timeoutMs,
			options?.signal
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
		options?.headers,
		options?.timeoutMs,
		options?.signal
	)
}
