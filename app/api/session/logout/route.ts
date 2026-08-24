import { getAuth } from '@/lib/auth'
import {
	withAuthDeviceCookie,
	withObservedAuthRequest
} from '@/lib/auth-observability'
import { createLogoutRouteHandler } from '@/lib/logout-route'

export const dynamic = 'force-dynamic'

const logout = createLogoutRouteHandler(headers => {
	const authHeaders = new Headers()
	const cookie = headers.get('cookie')
	if (cookie) authHeaders.set('cookie', cookie)
	return getAuth().api.signOut({ headers: authHeaders, asResponse: true })
})

export async function POST(request: Request): Promise<Response> {
	return withObservedAuthRequest(request, 'web', 'logout', async () =>
		withAuthDeviceCookie(request, await logout(request))
	)
}
