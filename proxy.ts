import { routing } from '@/i18n/routing'
import {
	getLocaleFromInternalPathname,
	isAppLocale,
	LANGUAGE_COOKIE,
	localizePathname,
	stripLocaleFromPathname
} from '@/i18n/routing'
import { getAuthorizationSession } from '@/lib/auth'
import { renderMaintenanceDocument } from '@/lib/maintenance-document'
import { isMaintenanceDataApi, readMaintenanceConfig } from '@/lib/maintenance'
import {
	hasInvalidTournamentId,
	isDevelopmentTeamMockRequest,
	isProtectedApi,
	isProtectedPage,
	requiresVerifiedEntry
} from '@/lib/route-protection'
import { hasSessionCookieHintInHeaders } from '@/lib/session-cookie-hint'
import {
	COMPETITION_SESSION_HANDOFF_HEADER,
	COMPETITION_SESSION_PATH_HEADER,
	createCompetitionSessionHandoff
} from '@/lib/competition-session-handoff'
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
	if (requestedPathname === '/healthz') return NextResponse.next()

	// APIs and machine-facing integrations stay unprefixed and outside locale routing.
	if (requestedPathname.startsWith('/api/')) {
		if (maintenance.enabled && isMaintenanceDataApi(requestedPathname)) {
			return maintenanceApiResponse(maintenance.retryAfterSeconds)
		}
		if (!isProtectedApi(requestedPathname)) return NextResponse.next()

		const session = await getAuthorizationSession(req.headers)
		if (!session) {
			return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
		}
		if (
			requestedPathname.startsWith('/api/tournaments') ||
			requestedPathname.startsWith('/api/live/competitions') ||
			requestedPathname.startsWith('/api/competitions')
		) {
			const requestHeaders = new Headers(req.headers)
			requestHeaders.delete(COMPETITION_SESSION_HANDOFF_HEADER)
			requestHeaders.delete(COMPETITION_SESSION_PATH_HEADER)
			const handoff = createCompetitionSessionHandoff(
				session,
				requestedPathname,
				req.headers.get('cookie')
			)
			if (handoff)
				requestHeaders.set(COMPETITION_SESSION_HANDOFF_HEADER, handoff)
			requestHeaders.set(COMPETITION_SESSION_PATH_HEADER, requestedPathname)
			return NextResponse.next({ request: { headers: requestHeaders } })
		}
		return session
			? NextResponse.next()
			: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
	}

	// The old id-only alias is a redirect boundary, not a second rendered page.
	const legacyMatch = requestedPathname.match(
		/^\/((?:[a-z]{2}(?:-[A-Z]{2})?)\/)?competitions\/([1-9]\d*)\/?$/
	)
	if (legacyMatch && Number.isSafeInteger(Number(legacyMatch[2]))) {
		const cookieLocale = req.cookies.get(LANGUAGE_COOKIE.name)?.value
		const locale =
			legacyMatch[1]?.replace(/\/$/, '') ||
			(isAppLocale(cookieLocale) ? cookieLocale : routing.defaultLocale)
		const url = req.nextUrl.clone()
		url.pathname = `/${locale}/live/competitions/${legacyMatch[2]}`
		return NextResponse.redirect(url, 308)
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
	const protectedPage =
		isProtectedPage(pathname) &&
		!isDevelopmentTeamMockRequest(pathname, req.nextUrl.search)

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

	const requestHeaders = new Headers(req.headers)
	requestHeaders.delete(COMPETITION_SESSION_HANDOFF_HEADER)
	requestHeaders.delete(COMPETITION_SESSION_PATH_HEADER)
	if (
		pathname.startsWith('/competitions') ||
		pathname.startsWith('/live/competitions')
	) {
		const handoff = createCompetitionSessionHandoff(
			session,
			pathname,
			req.headers.get('cookie')
		)
		if (handoff) requestHeaders.set(COMPETITION_SESSION_HANDOFF_HEADER, handoff)
		requestHeaders.set(COMPETITION_SESSION_PATH_HEADER, pathname)
		// The i18n middleware's locale is carried as a request override. Rebuild
		// that override on the handoff response so localized protected routes do
		// not fall back to the default locale after the session lookup.
		requestHeaders.set('x-next-intl-locale', locale)
		const handedOff = NextResponse.next({
			request: { headers: requestHeaders }
		})
		for (const header of ['x-middleware-rewrite', 'x-next-intl-locale']) {
			const value = i18nResponse.headers.get(header)
			if (value) handedOff.headers.set(header, value)
		}
		return copyCookies(
			i18nResponse,
			withDocumentCacheHeaders(req, handedOff, true)
		)
	}

	return withDocumentCacheHeaders(req, i18nResponse, true)
}

export const config = {
	// Run on all routes except Next.js internals and static files.
	matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)']
}
