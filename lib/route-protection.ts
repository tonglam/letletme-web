export const PROTECTED_PAGE_PREFIXES = [
	'/profile',
	'/onboarding',
	'/tournament/create',
	'/tournament/browse',
	'/live/tournaments',
	'/me/team',
	'/me/tournament',
] as const

export const PROTECTED_API_PREFIXES = ['/api/tournaments'] as const

export function hasInvalidTournamentId(pathname: string): boolean {
	const match = pathname.match(/^\/tournament\/([^/]+)(\/manage)?\/?$/)
	if (!match) return false

	const id = match[1]
	if (id === 'create' || id === 'browse') return Boolean(match[2])
	return !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))
}

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
		pathname.startsWith('/tournament/create') ||
		pathname.startsWith('/live/tournaments') ||
		pathname.startsWith('/me/team') ||
		pathname.startsWith('/me/tournament') ||
		pathname.startsWith('/tournament/browse')
	)
}
