import { loadFixtureWindowForPublicRoute } from '@/lib/fixture-window-server'
import { createFixtureWindowRouteHandler } from '@/lib/fixture-window-route'
import { withPublicRouteGraphQLIngress } from '@/lib/graphql-server'

export const dynamic = 'force-dynamic'

const handler = createFixtureWindowRouteHandler(loadFixtureWindowForPublicRoute)

export function GET(request: Request) {
	return withPublicRouteGraphQLIngress(request, () => handler(request))
}
