const DEPLOYMENT_AUTH_ORIGINS = [
	'https://vercel-origin.letletme.top',
	'https://letletme-web.vercel.app'
] as const

export function trustedAuthOrigins(url: string): string[] {
	const origins = new Set([url, ...DEPLOYMENT_AUTH_ORIGINS])
	try {
		const parsed = new URL(url)
		if (
			parsed.hostname === 'letletme.top' ||
			parsed.hostname === 'www.letletme.top'
		) {
			origins.add(`${parsed.protocol}//letletme.top`)
			origins.add(`${parsed.protocol}//www.letletme.top`)
		}
	} catch {}
	return Array.from(origins)
}
