import { createPlayerStatsDeskRouteHandler } from '@/lib/player-stats-desk-route'
import { loadPlayerStatsDesk } from '@/lib/player-stats-desk-server'

export const dynamic = 'force-dynamic'

export const GET = createPlayerStatsDeskRouteHandler(loadPlayerStatsDesk)
