import { getAuth } from '@/lib/auth'
import { type NextRequest, NextResponse } from 'next/server'

// Routes that require a session — full prefix match (all sub-paths are also protected).
const PROTECTED_PREFIXES = [
	'/profile',
	'/tournament/create',
	'/onboarding',
	'/live/tournament',
	'/data/selections',
	'/stats/team',
	'/stats/tournament',
	'/tournament/list',
]

// Routes protected at the exact path only; sub-paths with an ID segment are public.
// /live/points          → protected (my team)
// /live/points/[id]     → public (view another team)
const EXACT_PROTECTED = ['/live/points']

// API routes that require a session (exact prefix match is fine).
const PROTECTED_API_PREFIXES = ['/api/tournaments']

// Routes exempt from the global fplEntryId gate (even when authenticated).
// Auth and onboarding flows must be exempt to avoid redirect loops.
// API routes handle their own auth; static assets never hit this middleware.
const ENTRY_GATE_EXEMPT_PREFIXES = [
	'/auth',
	'/onboarding',
	'/api',
	'/live/points/',   // /live/points/[id] is the public "view another team" path
]

function isEntryGateExempt(pathname: string): boolean {
	return ENTRY_GATE_EXEMPT_PREFIXES.some(
		p => pathname.startsWith(p),
	)
}

function isProtected(pathname: string): boolean {
	if (EXACT_PROTECTED.some(p => pathname === p)) return true
	return (
		PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/')) ||
		PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))
	)
}

// /tournament/[id]/manage requires auth even though /tournament/[id] is public.
function requiresAuth(pathname: string): boolean {
	if (pathname.match(/^\/tournament\/[^/]+\/manage(\/|$)/)) return true
	return isProtected(pathname)
}

export async function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl

	const session = await getAuth().api.getSession({ headers: req.headers })

	// Global rule: authenticated users without a bound FPL entry are always
	// redirected to onboarding first, regardless of which page they're visiting.
	if (session && !session.user.fplEntryId && !isEntryGateExempt(pathname)) {
		return NextResponse.redirect(new URL('/onboarding/bind-entry', req.url))
	}

	if (!requiresAuth(pathname)) {
		return NextResponse.next()
	}

	if (!session) {
		const url = req.nextUrl.clone()
		url.pathname = '/auth/login'
		url.searchParams.set('next', pathname)
		return NextResponse.redirect(url)
	}

	return NextResponse.next()
}

export const config = {
	// Run on all routes except Next.js internals and static files.
	matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)'],
}
