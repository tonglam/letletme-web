import { extractGraphQLOperationName } from '@/lib/cache-policy'
import { buildGraphQLUserContextHeaders } from '@/lib/graphql-envelope'
import {
	isSuccessfulGraphQLResponseBody,
	resolveGraphQLProxyCacheControl
} from '@/lib/graphql-proxy-cache'
import {
	copySafeGraphQLUpstreamHeaders,
	readForwardableMiniProgramAuthorization,
	sanitizeGraphQLUpstreamBody
} from '@/lib/graphql-proxy-security'
import {
	buildGraphQLProxyIngress,
	graphQLWorkloadForDocument
} from '@/lib/graphql-ingress'
import { PayloadTooLargeError, readBoundedJson } from '@/lib/http-security-core'
import {
	GraphQLUpstreamError,
	readGraphQLUpstream
} from '@/lib/graphql-proxy-upstream'
import { resolveServerGraphQLEndpoint } from '@/lib/graphql-endpoint'
import { shouldResolveGraphQLProxySession } from '@/lib/graphql-proxy-session'
import { logSafeAuthDiagnostic } from '@/lib/auth-safe-log'
import { resolveWebVitalSource } from '@/lib/analytics/web-vitals'
import { RequestTiming, resolveRequestId } from '@/lib/request-timing'
import { appendServerTiming } from '@/lib/server-timing'
import type {
	ClientSignalBatchV1,
	ClientSignalDeviceGroup,
	ClientSignalMetric,
	ClientSignalResult,
	ClientSignalSurface
} from '@/lib/client-signal-contract'
import { forwardClientSignalBatch } from '@/lib/ops-client-signals'
import { randomUUID } from 'node:crypto'
import { after, NextRequest, NextResponse } from 'next/server'

const GRAPHQL_ENDPOINT = resolveServerGraphQLEndpoint()
const MAX_GRAPHQL_BODY_BYTES = 256 * 1024
const MAX_GRAPHQL_RESPONSE_BYTES = 8 * 1024 * 1024
const SUCCESS_SIGNAL_SAMPLE_RATE = 0.1

function noStoreJson(
	body: unknown,
	status: number,
	headers: Record<string, string> = {}
) {
	return NextResponse.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store', ...headers }
	})
}

export async function POST(request: NextRequest) {
	const requestTiming = new RequestTiming()
	const startedAt = Date.now()
	const requestId = resolveRequestId(request.headers.get('x-request-id'))
	let observedTrafficClass: 'mini' | 'web_browser' | 'development' =
		'development'
	const observeResponse = (
		response: Response,
		operationName = 'anonymous',
		workload = 'unknown',
		responseBodyOk = false
	) =>
		observeProxyResponse(response, {
			startedAt,
			operationName,
			workload,
			responseBodyOk,
			request,
			trafficClass: observedTrafficClass
		})
	let body: unknown
	try {
		body = await requestTiming.measure('bodyRead', () =>
			readBoundedJson(request, MAX_GRAPHQL_BODY_BYTES)
		)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return observeResponse(
				noStoreJson(
					{
						errors: [
							{
								message: 'Payload too large',
								extensions: { code: 'PAYLOAD_TOO_LARGE' }
							}
						]
					},
					413
				)
			)
		}
		return observeResponse(
			noStoreJson({ errors: [{ message: 'Invalid JSON' }] }, 400)
		)
	}
	const operationName = extractGraphQLOperationName(body) || 'anonymous'
	const workload = graphQLWorkloadForDocument(body)
	let observedWorkload = workload
	const completeResponse = (response: Response, responseBodyOk = false) =>
		observeResponse(response, operationName, observedWorkload, responseBodyOk)

	const authorization = requestTiming.measureSync('authorizationHeader', () =>
		readForwardableMiniProgramAuthorization(request.headers)
	)
	if (!authorization.ok) {
		return completeResponse(
			noStoreJson(
				{
					errors: [
						{
							message: 'Invalid Authorization header',
							extensions: { code: 'INVALID_AUTHORIZATION_HEADER' }
						}
					]
				},
				400
			)
		)
	}

	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret && process.env.NODE_ENV === 'production') {
		return completeResponse(
			noStoreJson(
				{ errors: [{ message: 'Proxy security is unavailable' }] },
				503
			)
		)
	}
	const ingress = secret
		? buildGraphQLProxyIngress({
				headers: request.headers,
				secret,
				workload
			})
		: null
	observedTrafficClass = ingress?.ok ? ingress.trafficClass : 'web_browser'
	const effectiveWorkload = ingress?.ok ? ingress.workload : workload
	observedWorkload = effectiveWorkload
	if (ingress && !ingress.ok) {
		return completeResponse(
			noStoreJson(
				{
					errors: [
						{
							message: ingress.message,
							extensions: { code: 'INVALID_CLIENT_IDENTITY' }
						}
					]
				},
				400
			)
		)
	}

	let session = null
	if (shouldResolveGraphQLProxySession(request.headers)) {
		try {
			const { getAuthorizationSession } = await import('@/lib/auth')
			session = await requestTiming.measure('sessionLookup', () =>
				getAuthorizationSession(request.headers)
			)
		} catch (error) {
			logSafeAuthDiagnostic(
				'error',
				'graphql proxy authorization session lookup failed',
				error
			)
			return completeResponse(
				noStoreJson(
					{ errors: [{ message: 'Authentication unavailable' }] },
					503
				)
			)
		}
	}

	const forwardHeaders = requestTiming.measureSync('headerBuild', () => {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-Request-Id': requestId
		}
		// Live products use independent breaking GraphQL contracts. Preserve the
		// exact client header so the upstream gate makes the same decision for
		// browser, RSC, and Mini Program traffic.
		const liveContract = request.headers.get('X-LetLetMe-Contract')
		if (liveContract) {
			headers['X-LetLetMe-Contract'] = liveContract
		}
		if (authorization.value) {
			headers.Authorization = authorization.value
		}
		if (secret && ingress?.ok) {
			Object.assign(headers, ingress.headers)
			if (session?.user) {
				Object.assign(
					headers,
					buildGraphQLUserContextHeaders(session.user, secret)
				)
			}
		}
		return headers
	})

	let response: Response
	let responseBody: Uint8Array
	try {
		const upstream = await requestTiming.measure('upstreamFetchAndRead', () =>
			readGraphQLUpstream({
				endpoint: GRAPHQL_ENDPOINT,
				requestSignal: request.signal,
				maxResponseBytes: MAX_GRAPHQL_RESPONSE_BYTES,
				init: {
					method: 'POST',
					cache: 'no-store',
					headers: forwardHeaders,
					body: JSON.stringify(body)
				}
			})
		)
		response = upstream.response
		responseBody = upstream.body
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return completeResponse(
				noStoreJson(
					{
						errors: [
							{
								message: 'Upstream response too large',
								extensions: { code: 'UPSTREAM_RESPONSE_TOO_LARGE' }
							}
						]
					},
					502,
					{ 'X-Request-Id': requestId }
				)
			)
		}
		if (error instanceof GraphQLUpstreamError && error.code === 'timeout') {
			return completeResponse(
				noStoreJson({ errors: [{ message: 'Upstream timed out' }] }, 504, {
					'X-Request-Id': requestId
				})
			)
		}
		if (
			error instanceof GraphQLUpstreamError &&
			error.code === 'client-abort'
		) {
			console.info('[graphql proxy] client aborted upstream request', {
				requestId
			})
			return completeResponse(
				noStoreJson({ errors: [{ message: 'Client disconnected' }] }, 499, {
					'X-Request-Id': requestId
				})
			)
		}
		console.error('[graphql proxy] upstream read failed:', error)
		return completeResponse(
			noStoreJson({ errors: [{ message: 'Upstream unavailable' }] }, 502, {
				'X-Request-Id': requestId
			})
		)
	}
	const { responseBodyOk, cacheControl } = requestTiming.measureSync(
		'responsePolicy',
		() => {
			responseBody = new TextEncoder().encode(
				sanitizeGraphQLUpstreamBody(
					new TextDecoder().decode(responseBody),
					response.status
				)
			)
			const bodyOk = isSuccessfulGraphQLResponseBody(
				new TextDecoder().decode(responseBody)
			)
			return {
				responseBodyOk: bodyOk,
				cacheControl: resolveGraphQLProxyCacheControl({
					body,
					hasSessionUser: Boolean(session?.user),
					hasAuthorization: Boolean(authorization.value),
					responseOk: response.ok,
					responseBodyOk: bodyOk
				})
			}
		}
	)
	const safeHeaders = new Headers({ 'Cache-Control': cacheControl })
	if (cacheControl === 'no-store') safeHeaders.set('X-Request-Id', requestId)
	copySafeGraphQLUpstreamHeaders(response.headers, safeHeaders, {
		includeRateLimitMetadata: cacheControl === 'no-store'
	})
	const proxyTimingSnapshot = requestTiming.snapshot()
	appendServerTiming(safeHeaders, 'proxy', requestTiming.elapsedMs())
	const upstreamDuration = proxyTimingSnapshot.upstreamFetchAndRead
	if (typeof upstreamDuration === 'number') {
		appendServerTiming(safeHeaders, 'upstream', upstreamDuration)
	}
	const proxyResponse = requestTiming.measureSync(
		'responseBuild',
		() =>
			new NextResponse(responseBody as unknown as BodyInit, {
				status: response.status,
				headers: safeHeaders
			})
	)
	console.info(
		'[graphql proxy timing]',
		JSON.stringify({
			event: 'graphql_proxy_timing',
			requestId,
			operationName,
			trafficClass: ingress?.ok ? ingress.trafficClass : 'development',
			workload: effectiveWorkload,
			status: response.status,
			totalMs: Number(requestTiming.elapsedMs().toFixed(2)),
			timings: requestTiming.snapshot(),
			responseBodyOk,
			cacheResult: cacheControl === 'no-store' ? 'bypass' : 'eligible'
		})
	)
	return completeResponse(proxyResponse, responseBodyOk)
}

function releaseName(): string {
	const release =
		process.env.LETLETME_RELEASE_SHA?.trim() ||
		process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
		'local'
	return release.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 64) || 'local'
}

function surfaceForWorkload(
	workload: string,
	operationName: string
): ClientSignalSurface {
	const value = `${workload}:${operationName}`.toLowerCase()
	if (value.includes('live') && value.includes('match')) return 'live_match'
	if (value.includes('live')) return 'live_matches'
	if (value.includes('price') || value.includes('market'))
		return 'price_changes'
	if (value.includes('player')) return 'player_stats'
	if (value.includes('fixture')) return 'fixtures'
	if (value.includes('my') || value.includes('entry')) return 'my_fpl'
	return 'other'
}

function deviceGroupForRequest(
	request: Request,
	trafficClass: 'mini' | 'web_browser' | 'development'
): ClientSignalDeviceGroup {
	if (trafficClass === 'mini') return 'wechat_phone'
	const userAgent = request.headers.get('user-agent') ?? ''
	if (/mobile|android|iphone|ipad/i.test(userAgent)) return 'mobile'
	return 'unknown'
}

function sampleSourceForRequest(request: Request): 'real' | 'synthetic' {
	if (request.headers.get('x-letletme-perf-source') === 'synthetic')
		return 'synthetic'
	const referer = request.headers.get('referer')
	if (referer) {
		try {
			return resolveWebVitalSource({ search: new URL(referer).search }) ===
				'synthetic'
				? 'synthetic'
				: 'real'
		} catch {
			// An invalid referrer is not a trusted synthetic marker.
		}
	}
	return 'real'
}

function proxyResult(
	statusCode: number,
	responseBodyOk: boolean
): ClientSignalResult {
	if (statusCode === 401 || statusCode === 403) return 'auth_error'
	if (statusCode === 408 || statusCode === 504) return 'timeout'
	return statusCode >= 200 && statusCode < 300 && responseBodyOk
		? 'ok'
		: 'error'
}

function observeProxyResponse(
	response: Response,
	input: {
		startedAt: number
		operationName: string
		workload: string
		responseBodyOk: boolean
		request: Request
		trafficClass: 'mini' | 'web_browser' | 'development'
	}
): Response {
	const result = proxyResult(response.status, input.responseBodyOk)
	if (result === 'ok' && Math.random() >= SUCCESS_SIGNAL_SAMPLE_RATE)
		return response
	const batch: ClientSignalBatchV1 = {
		schemaVersion: 1,
		batchId: randomUUID(),
		client: input.trafficClass === 'mini' ? 'wechat_miniprogram' : 'web',
		release: releaseName(),
		sentAt: new Date().toISOString(),
		samples: [
			{
				observedAt: new Date().toISOString(),
				surface: surfaceForWorkload(input.workload, input.operationName),
				metric: 'graphql_proxy_ms',
				deviceGroup: deviceGroupForRequest(input.request, input.trafficClass),
				sampleSource: sampleSourceForRequest(input.request),
				result,
				value: Math.max(0, Date.now() - input.startedAt)
			}
		]
	}
	after(() => forwardClientSignalBatch(batch))
	return response
}
