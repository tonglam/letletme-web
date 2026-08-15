const PUBLIC_ORIGINS = [
	'https://letletme.top',
	'https://www.letletme.top',
]

function normalizeOrigin(value: string | null): string | null {
	if (!value || value === 'null') return null
	try {
		const url = new URL(value)
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
		return url.origin.toLowerCase()
	} catch {
		return null
	}
}

function trustedOrigins(request: Request): Set<string> {
	const origins = new Set(PUBLIC_ORIGINS)
	const requestOrigin = normalizeOrigin(request.url)
	if (requestOrigin) origins.add(requestOrigin)

	for (const configured of [
		process.env.NEXT_PUBLIC_APP_URL,
		process.env.BETTER_AUTH_URL,
	]) {
		const origin = normalizeOrigin(configured ?? null)
		if (origin) origins.add(origin)
	}

	return origins
}

/**
 * Validate browser requests when the app is served behind a custom-domain
 * proxy. The public Origin can differ from the internal Vercel request URL,
 * so comparing Origin with request.url alone rejects legitimate beacons.
 */
export function isTrustedSameSiteRequest(request: Request): boolean {
	const trusted = trustedOrigins(request)
	const originHeader = request.headers.get('origin')
	const refererHeader = request.headers.get('referer')
	const origin = normalizeOrigin(originHeader)
	const refererOrigin = refererHeader
		? normalizeOrigin(refererHeader)
		: null

	if (originHeader === 'null' && !refererOrigin) return false
	if (originHeader && originHeader !== 'null' && !origin) return false
	if (origin && !trusted.has(origin)) return false
	if (refererHeader && !refererOrigin) return false
	if (refererOrigin && !trusted.has(refererOrigin)) return false

	const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase()
	if (
		fetchSite === 'cross-site' &&
		!trusted.has(origin ?? refererOrigin ?? '')
	) {
		return false
	}

	return true
}
