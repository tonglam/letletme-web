import { publicDeskRoute } from '@/lib/trends-route'
import { withPublicRouteGraphQLIngress } from '@/lib/graphql-server'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
	return withPublicRouteGraphQLIngress(request, () => publicDeskRoute(request))
}
