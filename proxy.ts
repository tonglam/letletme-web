import { getAuth } from '@/lib/auth'
import { isProtectedApi, isProtectedPage, requiresVerifiedEntry } from '@/lib/route-protection'
import { type NextRequest, NextResponse } from 'next/server'

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
	if (protectedPage && !session.user.fplEntryVerifiedAt && requiresVerifiedEntry(pathname)) {
		return NextResponse.redirect(new URL('/onboarding/bind-entry', req.url))
	}

	return NextResponse.next()
}

export const config = {
	// Run on all routes except Next.js internals and static files.
	matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)'],
}
