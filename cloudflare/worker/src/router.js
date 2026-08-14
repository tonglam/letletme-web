const DEFAULT_TENCENT_TIMEOUT_MS = 4_000
const INTERNAL_REQUEST_HEADERS = [
	'x-letletme-client-ip',
	'x-letletme-origin-token',
	'x-letletme-proxy-client-ip',
	'x-letletme-proxy-secret'
]

function isSingleIp(value) {
	if (!value || value.includes(',') || /\s/.test(value)) return false
	if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
		return value.split('.').every(part => Number(part) <= 255)
	}
	return value.includes(':') && /^[a-f0-9:]+$/i.test(value)
}

export function isTencentCandidate(request, country) {
	if (country !== 'CN') return false
	if (request.method !== 'GET' && request.method !== 'HEAD') return false
	const pathname = new URL(request.url).pathname
	if (pathname === '/api' || pathname.startsWith('/api/')) return false
	if (
		pathname === '/.well-known/acme-challenge' ||
		pathname.startsWith('/.well-known/acme-challenge/')
	) {
		return false
	}
	if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
		return false
	}
	return true
}

function sanitizedHeaders(request) {
	const headers = new Headers(request.headers)
	for (const header of INTERNAL_REQUEST_HEADERS) headers.delete(header)
	return headers
}

function originRequest(request, headers) {
	return new Request(request, { headers, redirect: 'manual' })
}

function annotateResponse(request, response, origin, env) {
	if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
		return response
	}
	const headers = new Headers(response.headers)
	headers.set('X-Letletme-Origin', origin)
	if (!headers.has('X-Letletme-Release')) {
		headers.set(
			'X-Letletme-Release',
			env.EXPECTED_RELEASE_SHA || 'unknown'
		)
	}
	return new Response(request.method === 'HEAD' ? null : response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	})
}

function logRoute(context, details) {
	const logger = context.logger ?? console.log
	logger(
		JSON.stringify({
			event: 'letletme_origin_route',
			workerVersion: context.env.ROUTER_VERSION || 'unknown',
			release: context.env.EXPECTED_RELEASE_SHA || 'unknown',
			...details
		})
	)
}

async function fetchVercel(request, context, origin = 'vercel') {
	const response = await context.fetchImpl(
		originRequest(request, sanitizedHeaders(request)),
		{ cf: { cacheEverything: false } }
	)
	return annotateResponse(request, response, origin, context.env)
}

async function fetchTencent(request, context) {
	const headers = sanitizedHeaders(request)
	headers.set('X-Letletme-Origin-Token', context.env.ORIGIN_TOKEN)
	const clientIp = request.headers.get('cf-connecting-ip')
	if (isSingleIp(clientIp)) {
		headers.set('X-Letletme-Client-IP', clientIp)
	}
	const timeoutValue = Number(context.env.TENCENT_TIMEOUT_MS)
	const timeoutMs =
		Number.isFinite(timeoutValue) && timeoutValue > 0
			? timeoutValue
			: DEFAULT_TENCENT_TIMEOUT_MS
	const controller = new AbortController()
	const timeout = setTimeout(
		() => controller.abort(new Error('tencent-timeout')),
		timeoutMs
	)
	try {
		return await context.fetchImpl(originRequest(request, headers), {
			signal: controller.signal,
			cf: {
				cacheEverything: false,
				resolveOverride: context.env.TENCENT_ORIGIN_HOST
			}
		})
	} catch (error) {
		if (controller.signal.aborted) throw new Error('tencent-timeout')
		throw error
	} finally {
		clearTimeout(timeout)
	}
}

export async function routeRequest(request, env = {}, options = {}) {
	const context = {
		env,
		fetchImpl: options.fetchImpl ?? fetch,
		logger: options.logger
	}
	const country = Object.hasOwn(options, 'country')
		? options.country
		: (request.cf?.country ?? null)
	if (env.ROUTER_MODE !== 'cn-router') {
		const response = await fetchVercel(request, context)
		logRoute(context, {
			country: country || 'unknown',
			origin: 'vercel',
			reason: 'pass-through',
			status: response.status
		})
		return response
	}
	if (!isTencentCandidate(request, country)) {
		const response = await fetchVercel(request, context)
		logRoute(context, {
			country: country || 'unknown',
			origin: 'vercel',
			reason: 'route-policy',
			status: response.status
		})
		return response
	}
	if (
		!env.ORIGIN_TOKEN ||
		!env.TENCENT_ORIGIN_HOST ||
		!env.EXPECTED_RELEASE_SHA ||
		env.EXPECTED_RELEASE_SHA === 'unknown'
	) {
		const response = await fetchVercel(request, context)
		logRoute(context, {
			country,
			origin: 'vercel',
			reason: 'tencent-config-missing',
			status: response.status
		})
		return response
	}

	let tencentResponse
	let fallbackReason
	try {
		tencentResponse = await fetchTencent(request, context)
		if (tencentResponse.status >= 500 && tencentResponse.status <= 599) {
			fallbackReason = `tencent-${tencentResponse.status}`
			await tencentResponse.body?.cancel()
		} else if (
			tencentResponse.headers.get('X-Letletme-Release') !==
			env.EXPECTED_RELEASE_SHA
		) {
			fallbackReason = 'tencent-release-mismatch'
			await tencentResponse.body?.cancel()
		}
	} catch (error) {
		fallbackReason =
			error instanceof Error && error.message === 'tencent-timeout'
				? 'tencent-timeout'
				: 'tencent-connect-error'
	}

	if (!fallbackReason && tencentResponse) {
		const response = annotateResponse(
			request,
			tencentResponse,
			'tencent',
			env
		)
		logRoute(context, {
			country,
			origin: 'tencent',
			reason: 'cn-safe-read',
			status: response.status
		})
		return response
	}

	const response = await fetchVercel(request, context, 'vercel-fallback')
	logRoute(context, {
		country,
		origin: 'vercel-fallback',
		reason: fallbackReason,
		status: response.status
	})
	return response
}

const worker = {
	fetch(request, env) {
		return routeRequest(request, env)
	}
}

export default worker
