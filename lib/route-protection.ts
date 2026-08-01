export const PROTECTED_PAGE_PREFIXES = [
	'/profile',
	'/onboarding',
	'/tournament/create',
	'/tournament/list',
	'/live/tournament',
	'/data/selections',
	'/stats/team',
	'/stats/tournament',
] as const

export const PROTECTED_API_PREFIXES = ['/api/tournaments'] as const

export function isProtectedPage(pathname: string): boolean {
	if (pathname === '/live/points') return true
	if (/^\/tournament\/[^/]+\/manage(?:\/|$)/.test(pathname)) return true
	return PROTECTED_PAGE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function isProtectedApi(pathname: string): boolean {
	return PROTECTED_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export function requiresVerifiedEntry(pathname: string): boolean {
	return (
		pathname === '/live/points' ||
		pathname === '/data/selections' ||
		pathname.startsWith('/tournament/create') ||
		pathname.startsWith('/live/tournament') ||
		pathname.startsWith('/stats/team') ||
		pathname.startsWith('/stats/tournament') ||
		pathname.startsWith('/tournament/list')
	)
}
