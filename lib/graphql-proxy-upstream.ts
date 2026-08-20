import {
	PayloadTooLargeError,
	readBoundedResponseBytes,
	ResponseReadAbortedError
} from '@/lib/http-security-core'

export const GRAPHQL_UPSTREAM_TIMEOUT_MS = 15_000

export type GraphQLUpstreamErrorCode =
	'timeout' | 'client-abort' | 'unavailable'

export class GraphQLUpstreamError extends Error {
	constructor(
		readonly code: GraphQLUpstreamErrorCode,
		options?: { cause?: unknown }
	) {
		super(`GraphQL upstream ${code}`, options)
		this.name = 'GraphQLUpstreamError'
	}
}

type UpstreamFetch = typeof fetch
type TimerHandle = ReturnType<typeof globalThis.setTimeout>

export type GraphQLUpstreamDependencies = {
	fetchImpl?: UpstreamFetch
	setTimeoutImpl?: typeof globalThis.setTimeout
	clearTimeoutImpl?: typeof globalThis.clearTimeout
	readResponseBytes?: typeof readBoundedResponseBytes
}

export async function readGraphQLUpstream({
	endpoint,
	init,
	requestSignal,
	maxResponseBytes,
	timeoutMs = GRAPHQL_UPSTREAM_TIMEOUT_MS,
	fetchImpl = fetch,
	setTimeoutImpl = globalThis.setTimeout,
	clearTimeoutImpl = globalThis.clearTimeout,
	readResponseBytes = readBoundedResponseBytes
}: {
	endpoint: string
	init: RequestInit
	requestSignal?: AbortSignal
	maxResponseBytes: number
	timeoutMs?: number
} & GraphQLUpstreamDependencies): Promise<{
	response: Response
	body: Uint8Array
}> {
	const controller = new AbortController()
	let timedOut = false
	let clientAborted = false
	let timeoutId: TimerHandle | undefined
	const abortForClient = () => {
		clientAborted = true
		controller.abort()
	}
	const abortForTimeout = () => {
		timedOut = true
		controller.abort()
	}

	if (requestSignal?.aborted) {
		abortForClient()
	} else {
		requestSignal?.addEventListener('abort', abortForClient, { once: true })
	}
	timeoutId = setTimeoutImpl(abortForTimeout, timeoutMs)
	try {
		if (clientAborted) throw new GraphQLUpstreamError('client-abort')
		const response = await fetchImpl(endpoint, {
			...init,
			signal: controller.signal
		})
		const body = await readResponseBytes(
			response,
			maxResponseBytes,
			controller.signal
		)
		return { response, body }
	} catch (error) {
		if (error instanceof PayloadTooLargeError) throw error
		if (timedOut) throw new GraphQLUpstreamError('timeout', { cause: error })
		if (clientAborted || error instanceof ResponseReadAbortedError) {
			throw new GraphQLUpstreamError('client-abort', { cause: error })
		}
		throw new GraphQLUpstreamError('unavailable', { cause: error })
	} finally {
		if (timeoutId !== undefined) clearTimeoutImpl(timeoutId)
		requestSignal?.removeEventListener('abort', abortForClient)
	}
}
