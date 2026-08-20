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
	'content-language',
	'retry-after',
	'x-ratelimit-policy',
	'x-ratelimit-scope'
] as const

export function copySafeGraphQLUpstreamHeaders(
	upstream: Headers,
	target: Headers
): void {
	for (const name of SAFE_UPSTREAM_RESPONSE_HEADERS) {
		const value = upstream.get(name)
		if (value) target.set(name, value)
	}
}
