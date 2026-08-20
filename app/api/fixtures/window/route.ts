import { loadFixtureWindow } from '@/lib/fixture-window-server'
import { createFixtureWindowRouteHandler } from '@/lib/fixture-window-route'
import { withPublicRouteGraphQLIngress } from '@/lib/graphql-server'

export const dynamic = 'force-dynamic'

const handler = createFixtureWindowRouteHandler(loadFixtureWindow)

export function GET(request: Request) {
	return withPublicRouteGraphQLIngress(request, () => handler(request))
}
