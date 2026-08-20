import { createPlayerStatsDeskRouteHandler } from '@/lib/player-stats-desk-route'
import { loadPlayerStatsDesk } from '@/lib/player-stats-desk-server'
import { withPublicRouteGraphQLIngress } from '@/lib/graphql-server'

export const dynamic = 'force-dynamic'

const handler = createPlayerStatsDeskRouteHandler(loadPlayerStatsDesk)

export function GET(request: Request) {
	return withPublicRouteGraphQLIngress(request, () => handler(request))
}
