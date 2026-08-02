import { getAuth } from '@/lib/auth'
import { isProtectedApi, isProtectedPage, requiresVerifiedEntry } from '@/lib/route-protection'
import { type NextRequest, NextResponse } from 'next/server'

export async function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl
	const protectedPage = isProtectedPage(pathname)
	const protectedApi = isProtectedApi(pathname)
	const passThrough = (privateDocument = false) => {
		const response = NextResponse.next()
		const acceptsHtml = req.headers.get('accept')?.includes('text/html') ?? false

		if (
			(req.method === 'GET' || req.method === 'HEAD') &&
			acceptsHtml &&
			!pathname.startsWith('/api/')
		) {
			// Cloudflare must not rewrite Next.js streaming or hydration scripts.
			// Keep public revalidation and private session pages explicit because a
			// proxy response header replaces Next.js's downstream Cache-Control value.
			response.headers.set(
				'Cache-Control',
				privateDocument
					? 'private, no-store, no-transform'
					: 'public, max-age=0, must-revalidate, no-transform',
			)
		}

		return response
	}

	if (!protectedPage && !protectedApi) {
		return passThrough()
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

	return passThrough(protectedPage)
}

export const config = {
	// Run on all routes except Next.js internals and static files.
	matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)'],
}
