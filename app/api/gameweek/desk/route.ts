import { createGameweekDeskRouteHandler } from '@/lib/gameweek-desk-route'
import { loadGameweekDesk } from '@/lib/gameweek-desk-server'
import { withPublicRouteGraphQLIngress } from '@/lib/graphql-server'

export const dynamic = 'force-dynamic'

const handler = createGameweekDeskRouteHandler(async eventId => {
	const data = await loadGameweekDesk(eventId)
	return {
		...data,
		outcome:
			data.overviewState === 'UNAVAILABLE' && data.boardsState === 'UNAVAILABLE'
				? 'failed'
				: data.overviewState === 'UNAVAILABLE' ||
					  data.boardsState === 'UNAVAILABLE'
					? 'partial'
					: 'complete'
	}
})

export function GET(request: Request) {
	return withPublicRouteGraphQLIngress(request, () => handler(request))
}
