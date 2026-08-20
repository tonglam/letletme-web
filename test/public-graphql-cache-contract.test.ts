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
		const [server, operations, fixtures, playerStats] = await Promise.all([
			read('lib/graphql-server.ts'),
			read('lib/graphql/operations/market.ts'),
			read('app/[locale]/explore/fixtures/page.tsx'),
			read('lib/player-stats-seed.ts')
		])
		assert.match(server, /executeServerQuery/)
		assert.match(server, /options\?: Omit<ExecuteQueryOptions/)
		assert.doesNotMatch(operations, /period:\s*ROLLING_7D/)
		assert.doesNotMatch(operations, /GetFixturePlanningOwnershipRolling/)
		assert.match(fixtures, /rollingOwnership: null/)
		assert.match(playerStats, /rollingOwnership: null/)
	})

	it('coalesces gameweek desk cold fills before caching only normalized success', async () => {
		const source = await read('lib/gameweek-desk-server.ts')
		assert.match(source, /unstable_cache/)
		assert.match(source, /coalescePublicSeed/)
		assert.match(source, /CORE_AUTHORITY_ORIGIN_OPTIONS/)
		assert.match(source, /result\.outcome === 'failed'/)
		assert.match(source, /CORE_AUTHORITY_DATA_CACHE/)
		assert.doesNotMatch(source, /CORE_AUTHORITY_FETCH_OPTIONS/)
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
		assert.match(serverContext, /capacityRequestIdForHeaders/)
		assert.match(publicServer, /capacityRequestIdForCurrentRun/)
		assert.doesNotMatch(publicServer, /from 'next\/headers'/)
	})
})
