export const PROTECTED_PAGE_PREFIXES = [
	'/profile',
	'/onboarding',
	'/competitions/create',
	'/competitions/browse',
	'/live/competitions',
	'/my-fpl/team',
	'/my-fpl/competitions',
] as const

export const PROTECTED_API_PREFIXES = [
	'/api/tournaments',
	'/api/live/competitions',
	'/api/competitions'
] as const

export function hasInvalidTournamentId(pathname: string): boolean {
	const match = pathname.match(/^\/competitions\/([^/]+)(\/manage)?\/?$/)
	if (!match) return false

	const id = match[1]
	if (id === 'create' || id === 'browse') return Boolean(match[2])
	return !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))
}

export function isProtectedPage(pathname: string): boolean {
	if (pathname === '/live/points') return true
	if (/^\/competitions\/[^/]+\/manage(?:\/|$)/.test(pathname)) return true
	return PROTECTED_PAGE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/** Development-only visual preview for the protected My FPL Team surface. */
export function isDevelopmentTeamMockRequest(
	pathname: string,
	search: string,
): boolean {
	if (process.env.NODE_ENV === 'production' || pathname !== '/my-fpl/team') {
		return false
	}
	return new URLSearchParams(search).get('mock') === '1'
}

export function isProtectedApi(pathname: string): boolean {
	return PROTECTED_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export function requiresVerifiedEntry(pathname: string): boolean {
	return (
		pathname === '/live/points' ||
		pathname.startsWith('/competitions/create') ||
		pathname.startsWith('/live/competitions') ||
		pathname.startsWith('/my-fpl/team') ||
		pathname.startsWith('/my-fpl/competitions') ||
		pathname.startsWith('/competitions/browse')
	)
}
