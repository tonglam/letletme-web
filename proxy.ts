import { routing } from '@/i18n/routing'
import {
	getLocaleFromInternalPathname,
	localizePathname,
	stripLocaleFromPathname
} from '@/i18n/routing'
import { getAuthorizationSession } from '@/lib/auth'
import { renderMaintenanceDocument } from '@/lib/maintenance-document'
import {
	isMaintenanceDataApi,
	readMaintenanceConfig
} from '@/lib/maintenance'
import {
	hasInvalidTournamentId,
	isProtectedApi,
	isProtectedPage,
	requiresVerifiedEntry
} from '@/lib/route-protection'
import { hasSessionCookieHintInHeaders } from '@/lib/session-cookie-hint'
import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'

const handleI18nRouting = createMiddleware(routing)
const DEFAULT_LOCALE_PREFIX = `/${routing.defaultLocale}`
const MAINTENANCE_MESSAGE =
	'LetLetMe data services are temporarily unavailable during scheduled maintenance.'

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

function withMaintenanceHeaders(
	response: NextResponse,
	retryAfterSeconds: number
) {
	response.headers.set('Cache-Control', 'private, no-store, no-transform')
	response.headers.set('Retry-After', String(retryAfterSeconds))
	response.headers.set('X-Robots-Tag', 'noindex, nofollow')
	return response
}

function invalidRouteResponse(
	req: NextRequest,
	locale: string,
	i18nResponse: NextResponse
) {
	const url = req.nextUrl.clone()
	url.pathname = `/${locale}/__not-found`
	url.search = ''
	return copyCookies(
		i18nResponse,
		withDocumentCacheHeaders(req, NextResponse.rewrite(url, { status: 404 }))
	)
}

function maintenanceApiResponse(retryAfterSeconds: number) {
	return withMaintenanceHeaders(
		NextResponse.json(
			{
				error: MAINTENANCE_MESSAGE,
				code: 'MAINTENANCE_MODE',
				retryAfterSeconds,
				errors: [
					{
						message: MAINTENANCE_MESSAGE,
						extensions: { code: 'MAINTENANCE_MODE' }
					}
				]
			},
			{ status: 503 }
		),
		retryAfterSeconds
	)
}

function maintenanceDocumentResponse(
	req: NextRequest,
	locale: string,
	i18nResponse: NextResponse,
	retryAfterSeconds: number
) {
	const response = new NextResponse(
		req.method === 'HEAD'
			? null
			: renderMaintenanceDocument(locale, retryAfterSeconds),
		{
			status: 503,
			headers: {
				'Content-Language': locale,
				'Content-Type': 'text/html; charset=utf-8'
			}
		}
	)
	return copyCookies(
		i18nResponse,
		withMaintenanceHeaders(response, retryAfterSeconds)
	)
}

export async function proxy(req: NextRequest) {
	const requestedPathname = req.nextUrl.pathname
	const maintenance = readMaintenanceConfig()

	// APIs and machine-facing integrations stay unprefixed and outside locale routing.
	if (requestedPathname.startsWith('/api/')) {
		if (maintenance.enabled && isMaintenanceDataApi(requestedPathname)) {
			return maintenanceApiResponse(maintenance.retryAfterSeconds)
		}
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
	if (isDefaultLocalePath) {
		return canonicalDefaultLocaleResponse(req, i18nResponse)
	}
	const internalUrl = new URL(
		i18nResponse.headers.get('x-middleware-rewrite') ?? req.url
	)
	const locale = getLocaleFromInternalPathname(internalUrl.pathname)
	const pathname = stripLocaleFromPathname(internalUrl.pathname)
	if (hasInvalidTournamentId(pathname)) {
		return invalidRouteResponse(req, locale, i18nResponse)
	}
	if (maintenance.enabled) {
		return maintenanceDocumentResponse(
			req,
			locale,
			i18nResponse,
			maintenance.retryAfterSeconds
		)
	}
	const protectedPage = isProtectedPage(pathname)

	if (!protectedPage) {
		// A public route can still stream user-specific content. The cookie remains
		// only a presentation hint here; auth is re-verified inside the page.
		return withDocumentCacheHeaders(
			req,
			i18nResponse,
			hasSessionCookieHintInHeaders(req.headers)
		)
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
