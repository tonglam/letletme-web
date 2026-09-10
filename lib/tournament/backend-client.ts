import 'server-only'

import {
	readBoundedResponseBytes,
	ResponseReadAbortedError
} from '@/lib/http-security-core'

const DEFAULT_TIMEOUT_MS = 15_000
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export class TournamentApiConfigurationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'TournamentApiConfigurationError'
	}
}

export class TournamentApiTimeoutError extends Error {
	constructor() {
		super('Tournament backend request timed out.')
		this.name = 'TournamentApiTimeoutError'
	}
}

export class TournamentApiUnavailableError extends Error {
	constructor() {
		super('Tournament backend is unavailable.')
		this.name = 'TournamentApiUnavailableError'
	}
}

export class TournamentApiCancelledError extends Error {
	constructor() {
		super('Tournament backend request was cancelled.')
		this.name = 'TournamentApiCancelledError'
	}
}

const normalizeOrigin = (value: string) => {
	try {
		const url = new URL(value)
		return `${url.protocol}//${url.host}`
	} catch {
		return value.replace(/\/+$/, '')
	}
}

export const getTournamentApiBaseUrl = (request?: Request): string => {
	const configuredBaseUrl = process.env.LETLETME_DATA_URL ?? ''

	if (!configuredBaseUrl) {
		throw new TournamentApiConfigurationError(
			'LETLETME_DATA_URL is not configured.'
		)
	}

	if (request) {
		const requestOrigin = new URL(request.url).origin
		if (normalizeOrigin(configuredBaseUrl) === requestOrigin) {
			throw new TournamentApiConfigurationError(
				'LETLETME_DATA_URL points to the web app origin. Configure it to the Data API.'
			)
		}
	}

	return configuredBaseUrl.replace(/\/+$/, '')
}

export async function tournamentApiFetch(
	path: string,
	init?: RequestInit,
	request?: Request
): Promise<Response> {
	const baseUrl = getTournamentApiBaseUrl(request)
	const method = (init?.method ?? 'GET').toUpperCase()
	const apiKey = process.env.LETLETME_DATA_API_KEY?.trim()
	if (!SAFE_METHODS.has(method) && !apiKey) {
		throw new TournamentApiConfigurationError(
			'LETLETME_DATA_API_KEY is required for tournament mutations.'
		)
	}
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
	const requestHeaders = new Headers(init?.headers)
	requestHeaders.set('Content-Type', 'application/json')
	if (apiKey) requestHeaders.set('x-api-key', apiKey)
	const signals = [controller.signal, init?.signal, request?.signal].filter(
		(signal): signal is AbortSignal => Boolean(signal)
	)
	const signal =
		signals.length === 1 ? controller.signal : AbortSignal.any(signals)

	try {
		const response = await fetch(`${baseUrl}${path}`, {
			...init,
			signal,
			headers: requestHeaders,
			cache: 'no-store'
		})
		// Fetch resolves after headers arrive. Consume the complete body while
		// the same 15-second signal is live, then hand callers a fresh readable
		// response with the original status, headers and payload.
		const body = await readBoundedResponseBytes(
			response,
			MAX_RESPONSE_BYTES,
			signal
		)
		// Fetch forbids a body on 204/205/304 responses. Preserve the original
		// empty-body semantics instead of turning a valid empty response into a
		// constructor error after the bounded read.
		const bodyInit =
			body.byteLength === 0 || [204, 205, 304].includes(response.status)
				? null
				: (body as unknown as BodyInit)
		return new Response(bodyInit, {
			status: response.status,
			statusText: response.statusText,
			headers: new Headers(response.headers)
		})
	} catch (error) {
		if (
			error instanceof ResponseReadAbortedError ||
			(error instanceof Error && error.name === 'AbortError')
		) {
			if (controller.signal.aborted) {
				throw new TournamentApiTimeoutError()
			}
			throw new TournamentApiCancelledError()
		}

		throw new TournamentApiUnavailableError()
	} finally {
		clearTimeout(timeoutId)
	}
}
