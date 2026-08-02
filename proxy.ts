import { routing } from '@/i18n/routing'
import {
	getLocaleFromInternalPathname,
	localizePathname,
	stripLocaleFromPathname
} from '@/i18n/routing'
import { getAuth } from '@/lib/auth'
import {
	isProtectedApi,
	isProtectedPage,
	requiresVerifiedEntry
} from '@/lib/route-protection'
import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'

const handleI18nRouting = createMiddleware(routing)

function copyCookies(from: NextResponse, to: NextResponse) {
	for (const cookie of from.cookies.getAll()) {
		to.cookies.set(cookie)
	}
	return to
}

function withDocumentCacheHeaders(
	req: NextRequest,
	response: NextResponse,
	privateDocument = false
) {
	const acceptsHtml = req.headers.get('accept')?.includes('text/html') ?? false
	if ((req.method === 'GET' || req.method === 'HEAD') && acceptsHtml) {
		// Cloudflare must not rewrite Next.js streaming or hydration scripts.
		response.headers.set(
			'Cache-Control',
			privateDocument
				? 'private, no-store, no-transform'
				: 'public, max-age=0, must-revalidate, no-transform'
		)
	}
	return response
}

export async function proxy(req: NextRequest) {
	const requestedPathname = req.nextUrl.pathname

	// APIs and machine-facing integrations stay unprefixed and outside locale routing.
	if (requestedPathname.startsWith('/api/')) {
		if (!isProtectedApi(requestedPathname)) return NextResponse.next()

		const session = await getAuth().api.getSession({ headers: req.headers })
		return session
			? NextResponse.next()
			: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
	}

	const i18nResponse = handleI18nRouting(req)
	if (i18nResponse.headers.has('location')) return i18nResponse

	const internalUrl = new URL(
		i18nResponse.headers.get('x-middleware-rewrite') ?? req.url
	)
	const locale = getLocaleFromInternalPathname(internalUrl.pathname)
	const pathname = stripLocaleFromPathname(internalUrl.pathname)
	const protectedPage = isProtectedPage(pathname)

	if (!protectedPage) {
		return withDocumentCacheHeaders(req, i18nResponse)
	}

	const session = await getAuth().api.getSession({ headers: req.headers })

	if (!session) {
		const url = req.nextUrl.clone()
		url.pathname = localizePathname('/auth/login', locale)
		url.search = ''
		url.searchParams.set('next', `${requestedPathname}${req.nextUrl.search}`)
		return copyCookies(i18nResponse, NextResponse.redirect(url))
	}
	if (!session.user.fplEntryVerifiedAt && requiresVerifiedEntry(pathname)) {
		const url = req.nextUrl.clone()
		url.pathname = localizePathname('/onboarding/bind-entry', locale)
		url.search = ''
		url.searchParams.set('next', `${requestedPathname}${req.nextUrl.search}`)
		return copyCookies(i18nResponse, NextResponse.redirect(url))
	}

	return withDocumentCacheHeaders(req, i18nResponse, true)
}

export const config = {
	// Run on all routes except Next.js internals and static files.
	matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)']
}
