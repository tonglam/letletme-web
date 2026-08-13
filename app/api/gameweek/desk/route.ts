import { createGameweekDeskRouteHandler } from '@/lib/gameweek-desk-route'
import { loadGameweekDesk } from '@/lib/gameweek-desk-server'

export const dynamic = 'force-dynamic'

export const GET = createGameweekDeskRouteHandler(async eventId => {
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
