import { getAuth } from '@/lib/auth'
import {
	withAuthDeviceCookie,
	withObservedAuthRequest
} from '@/lib/auth-observability'
import { createLogoutRouteHandler } from '@/lib/logout-route'
import { enforceLogoutRateLimit } from '@/lib/miniprogram-route-security'
import { MiniProgramAuthError } from '@/lib/miniprogram-account-core'
import { recordAuthFailure } from '@/lib/auth-observability'

export const dynamic = 'force-dynamic'

const logout = createLogoutRouteHandler(headers => {
	const authHeaders = new Headers()
	const cookie = headers.get('cookie')
	if (cookie) authHeaders.set('cookie', cookie)
	return getAuth().api.signOut({ headers: authHeaders, asResponse: true })
})

export async function POST(request: Request): Promise<Response> {
	return withObservedAuthRequest(request, 'web', 'logout', async () => {
		try {
			await enforceLogoutRateLimit({ request, channel: 'web' })
		} catch (error) {
			const status =
				error instanceof MiniProgramAuthError ? error.status : 503
			if (status === 429) {
				recordAuthFailure('rate_limited', 429, 'rate_limited')
			}
			const headers = new Headers({ 'Cache-Control': 'no-store' })
			if (
				error instanceof MiniProgramAuthError &&
				error.retryAfterSeconds
			) {
				headers.set('Retry-After', String(error.retryAfterSeconds))
			}
			return Response.json(
				{
					code: status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE',
					message:
						status === 429
							? 'Too many requests'
							: 'Request safety checks are unavailable'
				},
				{ status, headers }
			)
		}
		return withAuthDeviceCookie(request, await logout(request))
	})
}
