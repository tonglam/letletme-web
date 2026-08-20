import { createHmac } from 'node:crypto'

import {
	AGENT_TOOL_CAPABILITIES,
	AgentToolError,
	type AgentSession,
	isLetLetMeToolName,
	parseAgentToolInput
} from '@/lib/agent-tools/contracts'
import { GraphQLRequestError } from '@/lib/graphql-client'
import { PayloadTooLargeError, readBoundedText } from '@/lib/http-security-core'
import { resolveRequestId } from '@/lib/request-timing'
import { runAgentTool } from '@/lib/agent-tools/runner'
import type { AgentGraphQLExecutor } from '@/lib/agent-tools/runtime'

export const AGENT_MAX_INPUT_BYTES = 16 * 1024
export const AGENT_MAX_OUTPUT_BYTES = 64 * 1024
export const AGENT_UPSTREAM_TIMEOUT_MS = 15_000

type AgentGatewayEnvironment = Readonly<Record<string, string | undefined>>

export type AgentGatewayLog = {
	event: 'agent_gateway_request'
	requestId: string
	tool: string
	status: number
	durationMs: number
	inputBytes: number
	outputBytes: number
	userHash: string | null
	revisions?: Record<string, string>
}

export type AgentGatewayDependencies = {
	getSession: (headers: Headers) => Promise<AgentSession | null>
	execute: AgentGraphQLExecutor
	env?: AgentGatewayEnvironment
	now?: () => Date
	log?: (record: AgentGatewayLog) => void
	upstreamTimeoutMs?: number
}

const textEncoder = new TextEncoder()

const byteLength = (value: string): number =>
	textEncoder.encode(value).byteLength

const upstreamTimeoutMs = (dependencies: AgentGatewayDependencies): number => {
	const configured = dependencies.upstreamTimeoutMs
	return configured !== undefined &&
		Number.isFinite(configured) &&
		configured > 0
		? configured
		: AGENT_UPSTREAM_TIMEOUT_MS
}

const withUpstreamDeadline = async <T>(
	requestSignal: AbortSignal,
	timeoutMs: number,
	task: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
	const controller = new AbortController()
	const abortFromRequest = () => controller.abort(requestSignal.reason)
	if (requestSignal.aborted) abortFromRequest()
	else requestSignal.addEventListener('abort', abortFromRequest, { once: true })

	let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined
	const timeout = new Promise<never>((_resolve, reject) => {
		timeoutId = globalThis.setTimeout(() => {
			reject(
				new AgentToolError(
					'UPSTREAM_TIMEOUT',
					'The LetLetMe data service timed out.',
					504,
					true
				)
			)
			controller.abort(new Error('Agent tool upstream deadline exceeded'))
		}, timeoutMs)
	})

	try {
		return await Promise.race([task(controller.signal), timeout])
	} finally {
		if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
		requestSignal.removeEventListener('abort', abortFromRequest)
	}
}

const responseHeaders = (requestId: string): Headers =>
	new Headers({
		'Cache-Control': 'no-store, no-transform',
		'Content-Type': 'application/json; charset=utf-8',
		'X-Content-Type-Options': 'nosniff',
		'X-Request-Id': requestId
	})

const jsonResponse = (
	body: unknown,
	status: number,
	requestId: string,
	retryAfterSeconds?: number | null
): { response: Response; bytes: number } => {
	const serialized = JSON.stringify(body)
	const headers = responseHeaders(requestId)
	if (retryAfterSeconds !== undefined && retryAfterSeconds !== null) {
		headers.set('Retry-After', String(retryAfterSeconds))
	}
	return {
		response: new Response(serialized, { status, headers }),
		bytes: byteLength(serialized)
	}
}

const asAgentToolError = (error: unknown): AgentToolError => {
	if (error instanceof AgentToolError) return error
	if (error instanceof GraphQLRequestError) {
		if (error.code === 'UNAUTHENTICATED' || error.status === 401) {
			return new AgentToolError(
				'AUTH_REQUIRED',
				'Authentication is required.',
				401,
				false
			)
		}
		if (error.code === 'FORBIDDEN' || error.status === 403) {
			return new AgentToolError(
				'FORBIDDEN',
				'You are not authorized to access this LetLetMe data.',
				403,
				false
			)
		}
		if (error.code === 'NOT_FOUND' || error.status === 404) {
			return new AgentToolError(
				'NOT_FOUND',
				'The requested data was not found.',
				404,
				false
			)
		}
		if (error.code === 'RATE_LIMITED' || error.status === 429) {
			return new AgentToolError(
				'RATE_LIMITED',
				'The LetLetMe data request rate limit was reached.',
				429,
				true,
				error.retryAfterSeconds
			)
		}
		if (error.code === 'REQUEST_TIMEOUT') {
			return new AgentToolError(
				'UPSTREAM_TIMEOUT',
				'The LetLetMe data service timed out.',
				504,
				true
			)
		}
		if (
			[
				'BAD_USER_INPUT',
				'INVALID_GRAPHQL_REQUEST',
				'QUERY_TOO_COMPLEX'
			].includes(error.code ?? '')
		) {
			return new AgentToolError(
				'INVALID_INPUT',
				'The tool request was rejected by the data service.',
				400,
				false
			)
		}
	}
	return new AgentToolError(
		'UPSTREAM_UNAVAILABLE',
		'The LetLetMe data service is unavailable.',
		502,
		true
	)
}

const toolErrorResponse = (
	error: AgentToolError,
	requestId: string
): { response: Response; bytes: number } =>
	jsonResponse(
		{
			code: error.code,
			message: error.message,
			retryable: error.retryable,
			requestId
		},
		error.status,
		requestId,
		error.retryAfterSeconds
	)

const isEnabled = (env: AgentGatewayEnvironment): boolean =>
	env.AGENT_TOOLS_ENABLED?.trim().toLowerCase() === 'true'

const betaUserIds = (env: AgentGatewayEnvironment): Set<string> =>
	new Set(
		(env.AGENT_BETA_USER_IDS ?? '')
			.split(',')
			.map(value => value.trim())
			.filter(Boolean)
	)

const authorize = async (
	request: Request,
	dependencies: AgentGatewayDependencies
): Promise<{ session: AgentSession; secret: string }> => {
	const env = dependencies.env ?? process.env
	if (!isEnabled(env)) {
		throw new AgentToolError(
			'UPSTREAM_UNAVAILABLE',
			'LetLetMe Agent tools are currently disabled.',
			503,
			true
		)
	}
	const secret = env.BACKEND_PROXY_SECRET?.trim()
	if (!secret) {
		throw new AgentToolError(
			'UPSTREAM_UNAVAILABLE',
			'LetLetMe Agent security is unavailable.',
			503,
			true
		)
	}
	let session: AgentSession | null
	try {
		session = await dependencies.getSession(request.headers)
	} catch {
		throw new AgentToolError(
			'UPSTREAM_UNAVAILABLE',
			'LetLetMe authentication is unavailable.',
			503,
			true
		)
	}
	if (!session?.user?.id) {
		throw new AgentToolError(
			'AUTH_REQUIRED',
			'Sign in to LetLetMe to use Agent tools.',
			401,
			false
		)
	}
	const allowlist = betaUserIds(env)
	if (allowlist.size > 0 && !allowlist.has(session.user.id)) {
		throw new AgentToolError(
			'FORBIDDEN',
			'This LetLetMe account is not enabled for the Agent beta.',
			403,
			false
		)
	}
	return { session, secret }
}

const anonymousUserHash = (userId: string, secret: string): string =>
	createHmac('sha256', secret)
		.update(`agent-user:${userId}`)
		.digest('hex')
		.slice(0, 24)

const defaultLog = (record: AgentGatewayLog): void => {
	console.info('[agent-gateway]', JSON.stringify(record))
}

const finalLog = (
	dependencies: AgentGatewayDependencies,
	startedAt: number,
	record: Omit<AgentGatewayLog, 'event' | 'durationMs'>
): void => {
	;(dependencies.log ?? defaultLog)({
		event: 'agent_gateway_request',
		...record,
		durationMs: Number((performance.now() - startedAt).toFixed(2))
	})
}

export async function handleAgentCapabilitiesRequest(
	request: Request,
	dependencies: AgentGatewayDependencies
): Promise<Response> {
	const startedAt = performance.now()
	const requestId = resolveRequestId(request.headers.get('x-request-id'))
	let userHash: string | null = null
	let status = 500
	let outputBytes = 0
	try {
		const { session, secret } = await authorize(request, dependencies)
		userHash = anonymousUserHash(session.user.id, secret)
		const verified = Boolean(
			session.user.fplEntryVerifiedAt &&
			Number.isSafeInteger(session.user.fplEntryId) &&
			(session.user.fplEntryId ?? 0) > 0
		)
		const built = jsonResponse(
			{
				schemaVersion: '1',
				requestId,
				asOf: (dependencies.now ?? (() => new Date()))().toISOString(),
				authenticated: true,
				verifiedFplEntry: verified,
				tools: AGENT_TOOL_CAPABILITIES,
				limits: {
					requestBytes: AGENT_MAX_INPUT_BYTES,
					responseBytes: AGENT_MAX_OUTPUT_BYTES,
					upstreamTimeoutMs: upstreamTimeoutMs(dependencies)
				}
			},
			200,
			requestId
		)
		status = 200
		outputBytes = built.bytes
		return built.response
	} catch (error) {
		const built = toolErrorResponse(asAgentToolError(error), requestId)
		status = built.response.status
		outputBytes = built.bytes
		return built.response
	} finally {
		finalLog(dependencies, startedAt, {
			requestId,
			tool: 'capabilities',
			status,
			inputBytes: 0,
			outputBytes,
			userHash
		})
	}
}

export async function handleAgentToolRequest(
	request: Request,
	toolName: string,
	dependencies: AgentGatewayDependencies
): Promise<Response> {
	const startedAt = performance.now()
	const requestId = resolveRequestId(request.headers.get('x-request-id'))
	let userHash: string | null = null
	let status = 500
	let inputBytes = 0
	let outputBytes = 0
	let revisions: Record<string, string> | undefined
	try {
		const { session, secret } = await authorize(request, dependencies)
		userHash = anonymousUserHash(session.user.id, secret)
		if (!isLetLetMeToolName(toolName)) {
			throw new AgentToolError(
				'NOT_FOUND',
				'Unknown LetLetMe Agent tool.',
				404,
				false
			)
		}
		const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
		if (!contentType.startsWith('application/json')) {
			throw new AgentToolError(
				'INVALID_INPUT',
				'Agent tool requests must use application/json.',
				415,
				false
			)
		}
		let rawBody: string
		try {
			rawBody = await readBoundedText(request, AGENT_MAX_INPUT_BYTES)
			inputBytes = byteLength(rawBody)
		} catch (error) {
			if (error instanceof PayloadTooLargeError) {
				throw new AgentToolError(
					'INVALID_INPUT',
					'Agent tool request body exceeds 16 KiB.',
					413,
					false
				)
			}
			throw error
		}
		let body: unknown
		try {
			body = JSON.parse(rawBody)
		} catch {
			throw new AgentToolError(
				'INVALID_INPUT',
				'Request body is not valid JSON.',
				400,
				false
			)
		}
		const input = parseAgentToolInput(toolName, body)
		const result = await withUpstreamDeadline(
			request.signal,
			upstreamTimeoutMs(dependencies),
			signal =>
				runAgentTool({
					tool: toolName,
					input,
					session,
					requestId,
					execute: dependencies.execute,
					signal,
					now: dependencies.now
				})
		)
		const serialized = JSON.stringify(result)
		outputBytes = byteLength(serialized)
		if (outputBytes > AGENT_MAX_OUTPUT_BYTES) {
			throw new AgentToolError(
				'RESULT_TOO_LARGE',
				'The encoded tool result exceeds 64 KiB. Narrow the filters or page size.',
				413,
				false
			)
		}
		revisions = Object.fromEntries(
			Object.entries(result.revisions).filter(
				(entry): entry is [string, string] => typeof entry[1] === 'string'
			)
		)
		status = 200
		return new Response(serialized, {
			status,
			headers: responseHeaders(requestId)
		})
	} catch (error) {
		const built = toolErrorResponse(asAgentToolError(error), requestId)
		status = built.response.status
		outputBytes = built.bytes
		return built.response
	} finally {
		finalLog(dependencies, startedAt, {
			requestId,
			tool: isLetLetMeToolName(toolName) ? toolName : 'unknown',
			status,
			inputBytes,
			outputBytes,
			userHash,
			...(revisions ? { revisions } : {})
		})
	}
}
