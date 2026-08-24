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

function sanitizedHeaders(request) {
	const headers = new Headers(request.headers)
	for (const header of INTERNAL_REQUEST_HEADERS) headers.delete(header)
	return headers
}

function originRequest(request, env) {
	const headers = sanitizedHeaders(request)
	const url = new URL(request.url)
	url.protocol = 'https:'
	url.hostname = env.VERCEL_ORIGIN_HOST
	url.port = ''

	const originalHost = request.headers.get('host')
	if (originalHost) headers.set('host', originalHost)

	const clientIp = request.headers.get('cf-connecting-ip')
	if (env.VERCEL_PROXY_SECRET && isSingleIp(clientIp)) {
		headers.set('X-Letletme-Proxy-Client-IP', clientIp)
		headers.set('X-Letletme-Proxy-Secret', env.VERCEL_PROXY_SECRET)
	}

	const init = { method: request.method, headers, redirect: 'manual' }
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		init.body = request.body
		init.duplex = 'half'
	}
	return new Request(url, init)
}

function appendServerTiming(headers, name, durationMs) {
	if (!Number.isFinite(durationMs) || durationMs < 0) return
	const entry = `${name};dur=${Number(durationMs.toFixed(2))}`
	const existing = headers.get('Server-Timing')
	headers.set('Server-Timing', existing ? `${existing}, ${entry}` : entry)
}

function annotateResponse(request, response, env, originDurationMs) {
	if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
		return response
	}
	const headers = new Headers(response.headers)
	const publicOrigin = new URL(request.url).origin
	if (env.VERCEL_ORIGIN_HOST) {
		for (const header of ['location', 'link']) {
			const value = headers.get(header)
			if (value) {
				headers.set(
					header,
					value.replaceAll(`https://${env.VERCEL_ORIGIN_HOST}`, publicOrigin)
				)
			}
		}
	}
	headers.set('X-Letletme-Edge', env.EDGE_MARKER || 'cloudflare-fallback')
	headers.set('X-Letletme-Origin', 'vercel')
	appendServerTiming(headers, 'edge-origin', originDurationMs)
	if (!headers.has('X-Letletme-Release')) {
		headers.set('X-Letletme-Release', 'unknown')
	}
	return new Response(request.method === 'HEAD' ? null : response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	})
}

export async function fetchVercel(request, env, fetchImpl = fetch) {
	const startedAt = performance.now()
	const response = await fetchImpl(originRequest(request, env), {
		cf: { cacheEverything: false }
	})
	return annotateResponse(request, response, env, performance.now() - startedAt)
}

export function isSpoofableHeaderRemoved(headers) {
	return INTERNAL_REQUEST_HEADERS.every(header => !headers.has(header))
}

const worker = {
	fetch(request, env, ctx) {
		return fetchVercel(request, env)
	}
}

export default worker
