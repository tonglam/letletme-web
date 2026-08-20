import { createHomeFixturesRouteHandler } from '@/lib/home-fixtures-route'
import { loadHomeFixtures } from '@/lib/home-data-server'
import { withPublicRouteGraphQLIngress } from '@/lib/graphql-server'

export const dynamic = 'force-dynamic'

const handler = createHomeFixturesRouteHandler(loadHomeFixtures)

export function GET(request: Request) {
	return withPublicRouteGraphQLIngress(request, () => handler(request))
}
