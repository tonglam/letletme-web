import { loadFixtureWindow } from '@/lib/fixture-window-server'
import { createFixtureWindowRouteHandler } from '@/lib/fixture-window-route'

export const dynamic = 'force-dynamic'

export const GET = createFixtureWindowRouteHandler(loadFixtureWindow)
