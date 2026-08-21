import { publicGraphQLRequestMessage } from '@/lib/safe-errors'

export type ForwardableAuthorization =
	| { ok: true; value: string | null }
	| { ok: false };

const MINI_PROGRAM_BEARER = /^Bearer ([A-Za-z0-9_-]{32,512})$/i;

/** Accept only the opaque Web-issued Mini Program token format. */
export function readForwardableMiniProgramAuthorization(
	headers: Headers,
): ForwardableAuthorization {
	const raw = headers.get('authorization')
	if (raw === null) return { ok: true, value: null }

	const match = MINI_PROGRAM_BEARER.exec(raw)
	if (!match?.[1]) return { ok: false }
	return { ok: true, value: `Bearer ${match[1]}` }
}

const SAFE_UPSTREAM_RESPONSE_HEADERS = [
	'content-type',
	'content-language'
] as const

const REQUEST_RATE_LIMIT_RESPONSE_HEADERS = [
	'retry-after',
	'x-ratelimit-policy',
	'x-ratelimit-scope',
	'x-ratelimit-shadow-outcome',
	'x-ratelimit-shadow-scope'
] as const

export function copySafeGraphQLUpstreamHeaders(
	upstream: Headers,
	target: Headers,
	options: { includeRateLimitMetadata?: boolean } = {}
): void {
	const names = options.includeRateLimitMetadata === false
		? SAFE_UPSTREAM_RESPONSE_HEADERS
		: [...SAFE_UPSTREAM_RESPONSE_HEADERS, ...REQUEST_RATE_LIMIT_RESPONSE_HEADERS]
	for (const name of names) {
		const value = upstream.get(name)
		if (value) target.set(name, value)
	}
}

const SAFE_GRAPHQL_ERROR_CODES = new Set([
	'BAD_USER_INPUT',
	'FORBIDDEN',
	'GRAPHQL_PARSE_FAILED',
	'GRAPHQL_VALIDATION_FAILED',
	'INTERNAL_SERVER_ERROR',
	'LIVE_REVISION_GONE',
	'NOT_FOUND',
	'RATE_LIMITED',
	'UNAUTHENTICATED',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

function publicGraphQLErrorCode(status: number, value: unknown): string {
	const candidate =
		isRecord(value) && isRecord(value.extensions) &&
		typeof value.extensions.code === 'string'
			? value.extensions.code
			: null
	if (candidate && SAFE_GRAPHQL_ERROR_CODES.has(candidate)) return candidate
	if (status === 400) return 'BAD_USER_INPUT'
	if (status === 401) return 'UNAUTHENTICATED'
	if (status === 403) return 'FORBIDDEN'
	if (status === 404) return 'NOT_FOUND'
	if (status === 429) return 'RATE_LIMITED'
	return 'UPSTREAM_GRAPHQL_ERROR'
}

function publicGraphQLRequestCode(status: number): string {
	if (status === 400) return 'BAD_USER_INPUT'
	if (status === 401) return 'UNAUTHENTICATED'
	if (status === 403) return 'FORBIDDEN'
	if (status === 404) return 'NOT_FOUND'
	if (status === 429) return 'RATE_LIMITED'
	return 'UPSTREAM_GRAPHQL_ERROR'
}

/**
 * GraphQL resolver errors are untrusted upstream content. Keep only the
 * public error contract and an allowlisted code before returning a response
 * to a browser. Data is retained for partial GraphQL responses, but paths,
 * extensions, stacks, and resolver/database messages are never proxied.
 */
export function sanitizeGraphQLUpstreamBody(body: string, status: number): string {
	let parsed: unknown
	try {
		parsed = JSON.parse(body)
	} catch {
		return JSON.stringify({
			errors: [
				{
					message: publicGraphQLRequestMessage(status, null),
					extensions: { code: publicGraphQLRequestCode(status) },
				}
			]
		})
	}

	if (!isRecord(parsed)) {
		return JSON.stringify({
			errors: [
			{
				message: publicGraphQLRequestMessage(status, null),
				extensions: { code: publicGraphQLRequestCode(status) },
			}
		]
	})
	}

	const rawErrors = parsed.errors
	if (Array.isArray(rawErrors) && rawErrors.length > 0) {
		return JSON.stringify({
			...parsed,
			errors: rawErrors.map(error => {
				const code = publicGraphQLErrorCode(status, error)
				return {
					message: publicGraphQLRequestMessage(status, code),
					extensions: { code },
				}
			}),
		})
	}

	if (status < 200 || status >= 300) {
		return JSON.stringify({
			errors: [
			{
				message: publicGraphQLRequestMessage(status, null),
				extensions: { code: publicGraphQLRequestCode(status) },
			}
		]
		})
	}

	return body
}
