import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const read = (path: string) =>
	readFile(new URL(`../${path}`, import.meta.url), 'utf8')

describe('public GraphQL cache contract', () => {
	it('shares fixture and market seed loaders between Fixtures and Player Stats', async () => {
		const [fixtures, playerStats, fixtureLoader, marketLoader, fixtureTeams] =
			await Promise.all([
				read('app/[locale]/explore/fixtures/page.tsx'),
				read('lib/player-stats-seed.ts'),
				read('lib/fixture-window-server.ts'),
				read('lib/fixture-planning-seed-server.ts'),
				read('lib/fixture-team-seed-server.ts')
			])
		for (const source of [fixtures, playerStats]) {
			assert.match(source, /loadFixtureWindow/)
			assert.match(source, /loadFixturePlanningSignals/)
			assert.match(source, /loadFixturePlanningGameweekOwnership/)
		}
		for (const source of [fixtureLoader, marketLoader]) {
			assert.match(source, /unstable_cache/)
			assert.match(source, /cache\(/)
			assert.match(source, /coalescePublicSeed/)
		}
		assert.match(fixtureLoader, /RevalidateSeconds\.publicStats/)
		assert.match(marketLoader, /RevalidateSeconds\.market/)
		assert.match(fixtures, /loadFixtureTeams\(\)/)
		assert.match(fixtureTeams, /unstable_cache/)
		assert.match(fixtureTeams, /cache: 'no-store'/)
	})

	it('keeps private reads no-store and removes rolling ownership operations', async () => {
		const [server, operations, fixtures, playerStats, en, zh] = await Promise.all([
			read('lib/graphql-server.ts'),
			read('lib/graphql/operations/market.ts'),
			read('app/[locale]/explore/fixtures/page.tsx'),
			read('lib/player-stats-seed.ts'),
			read('messages/en.json'),
			read('messages/zh-CN.json')
		])
		assert.match(server, /executeServerQuery/)
		assert.match(server, /options\?: Omit<ExecuteQueryOptions/)
		assert.doesNotMatch(operations, /period:\s*ROLLING_7D/)
		assert.doesNotMatch(operations, /GetFixturePlanningOwnershipRolling/)
		assert.match(fixtures, /rollingOwnership: null/)
		assert.match(playerStats, /rollingOwnership: null/)
		assert.doesNotMatch(en, /rolling-seven-day market signals/)
		assert.doesNotMatch(zh, /近 7 日周期/)
	})

	it('coalesces gameweek desk cold fills before caching only normalized success', async () => {
		const source = await read('lib/gameweek-desk-server.ts')
		assert.match(source, /unstable_cache/)
		assert.match(source, /coalescePublicSeed/)
		assert.match(source, /CORE_AUTHORITY_ORIGIN_OPTIONS/)
		assert.match(source, /result\.outcome !== 'complete'/)
		assert.match(source, /IncompleteGameweekDeskError/)
		assert.match(source, /CORE_AUTHORITY_DATA_CACHE/)
		assert.doesNotMatch(source, /CORE_AUTHORITY_FETCH_OPTIONS/)
	})

	it('keeps Home route caching single-layered and transient gameweeks out of Data Cache', async () => {
		const home = await read('lib/home-data-server.ts')
		const fixturesLoader = home.slice(
			home.indexOf('const loadHomeFixturesFromOrigin'),
			home.indexOf('export const loadHomeFixtures')
		)
		assert.match(fixturesLoader, /coalescePublicSeed/)
		assert.doesNotMatch(fixturesLoader, /unstable_cache/)
		assert.match(home, /gameweek\.gameweekDesk\.lifecycle === 'SETTLED'/)
		assert.match(home, /overviewState === 'AVAILABLE'/)
		assert.match(home, /boardsState === 'AVAILABLE'/)
		assert.match(home, /transfersState === 'AVAILABLE'/)
		assert.doesNotMatch(home, /TransientHomeGameweekError/)
	})

	it('keeps the fixture API CDN cache separate from the RSC Data Cache', async () => {
		const [fixtureLoader, fixtureRoute] = await Promise.all([
			read('lib/fixture-window-server.ts'),
			read('app/api/fixtures/window/route.ts')
		])
		assert.match(
			fixtureLoader,
			/loadFixtureWindowForPublicRoute[\s\S]*loadCompleteFixtureWindowFromOrigin/
		)
		assert.match(fixtureRoute, /loadFixtureWindowForPublicRoute/)
		assert.doesNotMatch(
			fixtureRoute,
			/createFixtureWindowRouteHandler\(loadFixtureWindow\)/
		)
	})

	it('keeps public Trends classification aligned and Player Stats route caching single-layered', async () => {
		const [trends, playerDesk, playerDeskRoute] = await Promise.all([
			read('lib/trends-server.ts'),
			read('lib/player-stats-desk-server.ts'),
			read('app/api/player-stats/desk/route.ts')
		])
		assert.doesNotMatch(trends, /'public-other'/)
		assert.equal((trends.match(/'interactive'/g) ?? []).length, 2)
		assert.match(
			playerDesk,
			/unstable_cache\(\s*loadCompletePlayerStatsDeskByPlayerFromOrigin/
		)
		assert.match(playerDesk, /playerIds\.map\(playerId/)
		assert.match(
			playerDesk,
			/loadPlayerStatsDeskForPublicRoute[\s\S]*loadCompletePlayerStatsDeskFromOrigin/
		)
		assert.match(playerDeskRoute, /loadPlayerStatsDeskForPublicRoute/)
		assert.doesNotMatch(playerDeskRoute, /createPlayerStatsDeskRouteHandler\(loadPlayerStatsDesk\)/)
	})

	it('correlates signed capacity page runs without making cache keys request-derived', async () => {
		const [playerStats, fixtures, market, serverContext, publicServer] =
			await Promise.all([
				read('app/[locale]/explore/player-stats/page.tsx'),
				read('app/[locale]/explore/fixtures/page.tsx'),
				read('app/[locale]/explore/market/page.tsx'),
				read('lib/server-user-context.ts'),
				read('lib/graphql-server.ts')
			])
		for (const source of [playerStats, fixtures, market]) {
			assert.match(source, /withCapacityRunForRequest/)
		}
		assert.match(
			market,
			/async function MarketContent[\s\S]*withCapacityRunForRequest\(\(\) => renderMarketContent/
		)
		assert.match(
			market,
			/isPublishedMarketOwnershipDate\([\s\S]*loadMarketOwnershipDay\(publishedDate\)/
		)
		assert.match(serverContext, /capacityRequestIdForHeaders/)
		assert.match(publicServer, /capacityRequestIdForCurrentRun/)
		assert.doesNotMatch(publicServer, /from 'next\/headers'/)
	})
})
