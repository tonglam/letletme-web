import { safeRedirectPath } from './auth-redirects'
import { logSafeAuthDiagnostic } from './auth-safe-log'
import { isTrustedSameSiteRequest } from './request-origin'

type SignOutRequest = (headers: Headers) => Promise<Response>

function copySetCookies(source: Headers, target: Headers): void {
	const values = source.getSetCookie()
	for (const value of values) target.append('set-cookie', value)
}

async function fallbackRedirectPath(request: Request): Promise<string> {
	try {
		const form = await request.formData()
		const value = form.get('redirectHref')
		return safeRedirectPath(typeof value === 'string' ? value : null)
	} catch {
		return '/'
	}
}

export function createLogoutRouteHandler(
	signOut: SignOutRequest
): (request: Request) => Promise<Response> {
	return async request => {
		if (!isTrustedSameSiteRequest(request)) {
			return Response.json(
				{ error: 'Forbidden' },
				{ status: 403, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		try {
			const authResponse = await signOut(request.headers)
			if (!authResponse.ok) {
				logSafeAuthDiagnostic('warn', 'better-auth diagnostic', {
					name: 'LogoutRejected',
					status: authResponse.status
				})
				return Response.json(
					{ error: 'Sign out failed' },
					{ status: 502, headers: { 'Cache-Control': 'no-store' } }
				)
			}
			const wantsJson = request.headers
				.get('accept')
				?.toLowerCase()
				.includes('application/json')
			const redirectPath = wantsJson ? '/' : await fallbackRedirectPath(request)
			const response = new Response(null, {
				status: wantsJson ? 204 : 303,
				headers: {
					...(wantsJson
						? {}
						: { Location: redirectPath }),
					'Cache-Control': 'private, no-store, no-transform'
				}
			})
			copySetCookies(authResponse.headers, response.headers)
			return response
		} catch (error) {
			logSafeAuthDiagnostic('error', 'better-auth diagnostic', {
				name: 'LogoutFailed',
				cause: error
			})
			return Response.json(
				{ error: 'Sign out failed' },
				{ status: 500, headers: { 'Cache-Control': 'no-store' } }
			)
		}
	}
}
