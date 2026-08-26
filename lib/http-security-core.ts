import { createHmac, timingSafeEqual } from 'crypto'
import { isIP } from 'net'

export class PayloadTooLargeError extends Error {
	constructor(readonly maxBytes: number) {
		super(`Request body exceeds ${maxBytes} bytes`)
		this.name = 'PayloadTooLargeError'
	}
}

export class ResponseReadAbortedError extends Error {
	constructor() {
		super('Response body read was aborted')
		this.name = 'ResponseReadAbortedError'
	}
}

export async function readBoundedText(
	request: Request,
	maxBytes: number
): Promise<string> {
	const declared = Number(request.headers.get('content-length'))
	if (Number.isFinite(declared) && declared > maxBytes)
		throw new PayloadTooLargeError(maxBytes)
	if (!request.body) return ''
	const reader = request.body.getReader()
	const decoder = new TextDecoder()
	let bytes = 0
	let body = ''
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		bytes += value.byteLength
		if (bytes > maxBytes) {
			await reader.cancel()
			throw new PayloadTooLargeError(maxBytes)
		}
		body += decoder.decode(value, { stream: true })
	}
	return body + decoder.decode()
}

export async function readBoundedBytes(
	request: Request,
	maxBytes: number
): Promise<Uint8Array> {
	const declared = Number(request.headers.get('content-length'))
	if (Number.isFinite(declared) && declared > maxBytes) {
		throw new PayloadTooLargeError(maxBytes)
	}
	if (!request.body) return new Uint8Array()
	const reader = request.body.getReader()
	const chunks: Uint8Array[] = []
	let bytes = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		bytes += value.byteLength
		if (bytes > maxBytes) {
			await reader.cancel()
			throw new PayloadTooLargeError(maxBytes)
		}
		chunks.push(value)
	}
	const result = new Uint8Array(bytes)
	let offset = 0
	for (const chunk of chunks) {
		result.set(chunk, offset)
		offset += chunk.byteLength
	}
	return result
}

export async function readBoundedResponseBytes(
	response: Response,
	maxBytes: number,
	signal?: AbortSignal
): Promise<Uint8Array> {
	if (signal?.aborted) {
		if (response.body) await response.body.cancel()
		throw new ResponseReadAbortedError()
	}
	const declared = Number(response.headers.get('content-length'))
	if (Number.isFinite(declared) && declared > maxBytes) {
		if (response.body) await response.body.cancel()
		throw new PayloadTooLargeError(maxBytes)
	}
	if (!response.body) return new Uint8Array()
	const reader = response.body.getReader()
	const chunks: Uint8Array[] = []
	let bytes = 0
	let aborted = false
	const abortReader = () => {
		aborted = true
		void reader.cancel().catch(() => undefined)
	}
	signal?.addEventListener('abort', abortReader, { once: true })
	try {
		for (;;) {
			const { done, value } = await reader.read()
			if (aborted) throw new ResponseReadAbortedError()
			if (done) break
			if (!value) continue
			bytes += value.byteLength
			if (bytes > maxBytes) {
				await reader.cancel()
				throw new PayloadTooLargeError(maxBytes)
			}
			chunks.push(value)
		}
		if (aborted) throw new ResponseReadAbortedError()
	} catch (error) {
		if (aborted) throw new ResponseReadAbortedError()
		throw error
	} finally {
		signal?.removeEventListener('abort', abortReader)
		reader.releaseLock()
	}
	const result = new Uint8Array(bytes)
	let offset = 0
	for (const chunk of chunks) {
		result.set(chunk, offset)
		offset += chunk.byteLength
	}
	return result
}

export async function readBoundedJson(
	request: Request,
	maxBytes: number
): Promise<unknown> {
	return JSON.parse(await readBoundedText(request, maxBytes))
}

const validIp = (value: string | null): string | null => {
	if (!value) return null
	const candidate = value.trim()
	return isIP(candidate) ? candidate : null
}

function secretsEqual(provided: string | null, expected: string): boolean {
	if (!provided) return false
	const providedBytes = Buffer.from(provided)
	const expectedBytes = Buffer.from(expected)
	return (
		providedBytes.length === expectedBytes.length &&
		timingSafeEqual(providedBytes, expectedBytes)
	)
}

function configuredLocalProxySecrets(): string[] {
	const active = process.env.LETLETME_LOCAL_PROXY_SECRET
	if (!active) return []
	const secondary = process.env.LETLETME_LOCAL_PROXY_SECRET_PREVIOUS
	if (!secondary || secondary === active) return [active]
	return [active, secondary]
}

function expectedProductionHosts(): Set<string> {
	const hosts = new Set<string>()
	for (const raw of [
		process.env.BETTER_AUTH_URL,
		process.env.NEXT_PUBLIC_APP_URL
	]) {
		if (!raw) continue
		try {
			hosts.add(new URL(raw).host.toLowerCase())
		} catch {}
	}
	if (
		hosts.has('letletme.top') ||
		hosts.has('www.letletme.top') ||
		hosts.size === 0
	) {
		hosts.add('letletme.top')
		hosts.add('www.letletme.top')
	}
	return hosts
}

export function resolveProviderClientIp(headers: Headers): string {
	const host = (headers.get('host') ?? '').toLowerCase()
	const isExpectedProductionHost = expectedProductionHosts().has(host)
	const localProxySecrets = configuredLocalProxySecrets()
	if (
		isExpectedProductionHost &&
		localProxySecrets.some(secret =>
			secretsEqual(headers.get('x-letletme-proxy-secret'), secret)
		)
	) {
		return validIp(headers.get('x-letletme-proxy-client-ip')) ?? 'unknown'
	}
	if (isExpectedProductionHost && headers.has('cf-ray')) {
		return validIp(headers.get('cf-connecting-ip')) ?? 'unknown'
	}
	if (
		(isExpectedProductionHost || host.endsWith('.vercel.app')) &&
		headers.has('x-vercel-id')
	) {
		return (
			validIp(headers.get('x-vercel-forwarded-for')?.split(',')[0] ?? null) ??
			'unknown'
		)
	}
	// The local Next proxy cannot receive Cloudflare/Vercel client-IP headers.
	// Give loopback Mini-program requests a stable abuse subject in development
	// so they can exercise the same signed ingress contract as production.
	if (
		process.env.NODE_ENV !== 'production' &&
		/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)
	) {
		return '127.0.0.1'
	}
	return 'unknown'
}

export function buildOpaqueRateLimitSubject(
	headers: Headers,
	secret: string
): string {
	return createHmac('sha256', secret)
		.update(`rate-limit:${resolveProviderClientIp(headers)}`)
		.digest('hex')
}

export type GraphQLTrafficClass =
	| 'mini'
	| 'web_browser'
	| 'web_rsc'
	| 'service'
	| 'legacy'

export type GraphQLWorkload =
	| 'interactive'
	| 'home'
	| 'fixtures'
	| 'market'
	| 'player-stats'
	| 'gameweek'
	| 'public-other'

export type IngressEnvelopeV2 = {
	v: 2
	aud: 'letletme-graphql'
	trafficClass: Exclude<GraphQLTrafficClass, 'legacy'>
	subject: string
	abuseSubject: string | null
	workload: GraphQLWorkload
	iat: number
	exp: number
}

const opaqueSubject = (
	purpose: string,
	value: string,
	secret: string
): string =>
	createHmac('sha256', secret)
		.update(`${purpose}:${value}`)
		.digest('hex')

export function buildOpaqueMiniDeviceSubject(
	deviceId: string,
	secret: string
): string {
	return opaqueSubject('rate-limit:mini-device', deviceId, secret)
}

export function buildOpaqueAbuseSubject(
	headers: Headers,
	secret: string
): string | null {
	const ip = resolveProviderClientIp(headers)
	return ip === 'unknown'
		? null
		: opaqueSubject('rate-limit:abuse-ip', ip, secret)
}

export function buildOpaqueRscSubject(
	workload: GraphQLWorkload,
	secret: string
): string {
	return opaqueSubject('rate-limit:web-rsc', workload, secret)
}

export function buildIngressContextHeaders(
	subject: string,
	secret: string,
	nowSeconds = Math.floor(Date.now() / 1000)
): Record<string, string> {
	const payload = JSON.stringify({
		aud: 'letletme-graphql',
		sub: subject,
		iat: nowSeconds,
		exp: nowSeconds + 60
	})
	return {
		'X-Ingress-Context': Buffer.from(payload).toString('base64url'),
		'X-Ingress-Context-Sig': createHmac('sha256', secret)
			.update(payload)
			.digest('base64url')
	}
}

export function buildIngressContextHeadersV2(
	input: {
		trafficClass: Exclude<GraphQLTrafficClass, 'legacy'>
		subject: string
		abuseSubject: string | null
		workload: GraphQLWorkload
	},
	secret: string,
	nowSeconds = Math.floor(Date.now() / 1000)
): Record<string, string> {
	const envelope: IngressEnvelopeV2 = {
		v: 2,
		aud: 'letletme-graphql',
		trafficClass: input.trafficClass,
		subject: input.subject,
		abuseSubject: input.abuseSubject,
		workload: input.workload,
		iat: nowSeconds,
		exp: nowSeconds + 60
	}
	const payload = JSON.stringify(envelope)
	return {
		'X-Ingress-Context': Buffer.from(payload).toString('base64url'),
		'X-Ingress-Context-Sig': createHmac('sha256', secret)
			.update(payload)
			.digest('base64url')
	}
}
