import { createHomeFixturesRouteHandler } from '@/lib/home-fixtures-route'
import { loadHomeFixtures } from '@/lib/home-data-server'

export const dynamic = 'force-dynamic'

export const GET = createHomeFixturesRouteHandler(loadHomeFixtures)
