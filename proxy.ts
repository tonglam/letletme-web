import { getAuth } from '@/lib/auth'
import { type NextRequest, NextResponse } from 'next/server'

// Page routes that require a session. Tournament-related pages depend on an
// entry id; profile stays protected so users can manage that binding.
const PROTECTED_PAGE_PREFIXES = [
	'/data/selections',
	'/live/tournament',
	'/stats/tournament',
	'/tournament',
	'/profile',
]

// API routes that require a session (exact prefix match is fine).
const PROTECTED_API_PREFIXES = ['/api/tournaments']

function isProtectedPage(pathname: string): boolean {
	return PROTECTED_PAGE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function isProtectedApi(pathname: string): boolean {
	return PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))
}

function requiresEntryId(pathname: string): boolean {
	return (
		pathname === '/stats/tournament' ||
		pathname === '/data/selections' ||
		pathname.startsWith('/live/tournament') ||
		pathname.startsWith('/tournament')
	)
}

export async function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl
	const protectedPage = isProtectedPage(pathname)
	const protectedApi = isProtectedApi(pathname)

	if (!protectedPage && !protectedApi) {
		return NextResponse.next()
	}

	const session = await getAuth().api.getSession({ headers: req.headers })

	if (!session) {
		if (protectedApi) {
			return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
		}

		const url = req.nextUrl.clone()
		url.pathname = '/auth/login'
		url.search = ''
		url.searchParams.set('next', `${pathname}${req.nextUrl.search}`)
		return NextResponse.redirect(url)
	}

	// Tournament pages need a linked FPL entry. Profile stays reachable so users
	// can add or change their entry id there.
	if (protectedPage && !session.user.fplEntryId && requiresEntryId(pathname)) {
		return NextResponse.redirect(new URL('/onboarding/bind-entry', req.url))
	}

	return NextResponse.next()
}

export const config = {
	// Run on all routes except Next.js internals and static files.
	matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)'],
}
