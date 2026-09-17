export const AUTHORIZATION_SESSION_TIMEOUT_MS = 5_000

export class AuthorizationSessionTimeoutError extends Error {
	readonly code = 'AUTHORIZATION_SESSION_TIMEOUT'

	constructor() {
		super('Authorization session lookup exceeded its deadline')
		this.name = 'AuthorizationSessionTimeoutError'
	}
}

/**
 * Bound a request-local authorization lookup. The database client also sets a
 * server-side statement/lock deadline, so the outer deadline cannot leave an
 * unbounded SQL operation occupying a pool slot.
 */
export async function withAuthorizationSessionDeadline<T>(
	operation: Promise<T>,
	options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<T> {
	const timeoutMs = options.timeoutMs ?? AUTHORIZATION_SESSION_TIMEOUT_MS
	let timer: ReturnType<typeof setTimeout> | undefined
	let onAbort: (() => void) | undefined
	const deadline = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new AuthorizationSessionTimeoutError()), timeoutMs)
	})
	const aborted = options.signal
		? new Promise<never>((_, reject) => {
			onAbort = () => reject(new AuthorizationSessionTimeoutError())
			if (options.signal?.aborted) onAbort?.()
			else options.signal?.addEventListener('abort', onAbort, { once: true })
		})
		: null
	try {
		return await Promise.race(
			aborted ? [operation, deadline, aborted] : [operation, deadline]
		)
	} finally {
		if (timer) clearTimeout(timer)
		if (onAbort && options.signal) options.signal.removeEventListener('abort', onAbort)
	}
}
