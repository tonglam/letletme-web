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
