import { routing } from '@/i18n/routing'
import {
	getLocaleFromInternalPathname,
	localizePathname,
	stripLocaleFromPathname
} from '@/i18n/routing'
import { getAuthorizationSession } from '@/lib/auth'
import {
	isProtectedApi,
	isProtectedPage,
	requiresVerifiedEntry
} from '@/lib/route-protection'
import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'

const handleI18nRouting = createMiddleware(routing)
const DEFAULT_LOCALE_PREFIX = `/${routing.defaultLocale}`

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

		const session = await getAuthorizationSession(req.headers)
		return session
			? NextResponse.next()
			: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
	}

	const isDefaultLocalePath =
		requestedPathname === DEFAULT_LOCALE_PREFIX ||
		requestedPathname.startsWith(`${DEFAULT_LOCALE_PREFIX}/`)
	let i18nResponse: NextResponse
	if (isDefaultLocalePath) {
		const requestHeaders = new Headers(req.headers)
		requestHeaders.set('x-next-intl-locale', routing.defaultLocale)
		i18nResponse = NextResponse.next({ request: { headers: requestHeaders } })
	} else {
		i18nResponse = handleI18nRouting(req)
		if (i18nResponse.headers.has('location')) return i18nResponse
	}

	const internalUrl = new URL(
		i18nResponse.headers.get('x-middleware-rewrite') ?? req.url
	)
	const locale = getLocaleFromInternalPathname(internalUrl.pathname)
	const pathname = stripLocaleFromPathname(internalUrl.pathname)
	const protectedPage = isProtectedPage(pathname)

	if (!protectedPage) {
		return withDocumentCacheHeaders(req, i18nResponse)
	}

	// Protected routes must observe entry verification and revocation immediately,
	// rather than trusting the five-minute session cookie cache.
	const session = await getAuthorizationSession(req.headers)

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
