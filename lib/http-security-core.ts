import { createHmac, timingSafeEqual } from 'crypto'
import { isIP } from 'net'

export class PayloadTooLargeError extends Error {
	constructor(readonly maxBytes: number) {
		super(`Request body exceeds ${maxBytes} bytes`)
		this.name = 'PayloadTooLargeError'
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
	const localProxySecret = process.env.LETLETME_LOCAL_PROXY_SECRET
	if (
		isExpectedProductionHost &&
		localProxySecret &&
		secretsEqual(
			headers.get('x-letletme-proxy-secret'),
			localProxySecret
		)
	) {
		return (
			validIp(headers.get('x-letletme-proxy-client-ip')) ?? 'unknown'
		)
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
