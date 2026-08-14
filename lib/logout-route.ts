type SignOutRequest = (headers: Headers) => Promise<Response>

function isSameOriginMutation(request: Request): boolean {
	const origin = request.headers.get('origin')
	const fetchSite = request.headers.get('sec-fetch-site')
	return (
		(!origin || origin === new URL(request.url).origin) &&
		fetchSite !== 'cross-site'
	)
}

function copySetCookies(source: Headers, target: Headers): void {
	const values = source.getSetCookie()
	for (const value of values) target.append('set-cookie', value)
}

export function createLogoutRouteHandler(
	signOut: SignOutRequest
): (request: Request) => Promise<Response> {
	return async request => {
		if (!isSameOriginMutation(request)) {
			return Response.json(
				{ error: 'Forbidden' },
				{ status: 403, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		try {
			const authResponse = await signOut(request.headers)
			if (!authResponse.ok) {
				console.error('[logout] auth sign-out rejected', {
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
			const response = new Response(null, {
				status: wantsJson ? 204 : 303,
				headers: {
					...(wantsJson
						? {}
						: { Location: new URL('/', request.url).toString() }),
					'Cache-Control': 'private, no-store, no-transform'
				}
			})
			copySetCookies(authResponse.headers, response.headers)
			return response
		} catch (error) {
			console.error('[logout] sign-out failed', {
				error: error instanceof Error ? error.name : 'UnknownError'
			})
			return Response.json(
				{ error: 'Sign out failed' },
				{ status: 500, headers: { 'Cache-Control': 'no-store' } }
			)
		}
	}
}
