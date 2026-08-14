import { getAuth } from '@/lib/auth'
import { createLogoutRouteHandler } from '@/lib/logout-route'

export const dynamic = 'force-dynamic'

export const POST = createLogoutRouteHandler(headers => {
	const authHeaders = new Headers()
	const cookie = headers.get('cookie')
	if (cookie) authHeaders.set('cookie', cookie)
	return getAuth().api.signOut({ headers: authHeaders, asResponse: true })
})
