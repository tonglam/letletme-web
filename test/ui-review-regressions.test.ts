import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const require = createRequire(import.meta.url)

describe('legacy route redirects', () => {
	it('redirects both unprefixed English and locale-prefixed routes', async () => {
		const config = require('../next.config.js') as {
			redirects: () => Promise<
				Array<{ source: string; destination: string; permanent: boolean }>
			>
		}
		const redirects = await config.redirects()
		const bySource = new Map(redirects.map(route => [route.source, route]))

		assert.deepEqual(bySource.get('/stats/gameweek'), {
			source: '/stats/gameweek',
			destination: '/data/gameweek',
			permanent: true
		})
		assert.deepEqual(bySource.get('/:locale/stats/gameweek'), {
			source: '/:locale/stats/gameweek',
			destination: '/:locale/data/gameweek',
			permanent: true
		})
		assert.equal(
			bySource.get('/data/price-changes')?.destination,
			'/data/market'
		)
	})
})

describe('pre-paint theme bootstrap', () => {
	it('executes the inline bootstrap in head before body content', async () => {
		const source = await readFile(
			new URL('../app/[locale]/layout.tsx', import.meta.url),
			'utf8'
		)
		const head = source.indexOf('<head>')
		const bootstrap = source.indexOf('id="theme-bootstrap"')
		const body = source.indexOf('<body')

		assert.ok(head >= 0)
		assert.ok(bootstrap > head)
		assert.ok(body > bootstrap)
		assert.equal(source.includes('strategy="afterInteractive"'), false)
	})
})

describe('asynchronous selection safety', () => {
	it('clears failed gameweek sections and ignores superseded player lookups', async () => {
		const [gameweekSource, playerSource] = await Promise.all([
			readFile(
				new URL(
					'../app/data/gameweek/GameweekStatsClient.tsx',
					import.meta.url
				),
				'utf8'
			),
			readFile(
				new URL(
					'../app/data/player-stats/_hooks/usePlayerDetailSlot.ts',
					import.meta.url
				),
				'utf8'
			)
		])

		const overallFailure = gameweekSource.indexOf(
			"overallResult.status === 'rejected'"
		)
		const overallReset = gameweekSource.indexOf(
			'setOverallStats(FALLBACK_OVERALL_STATS)',
			overallFailure
		)
		const boardFailure = gameweekSource.indexOf(
			"boardsResult.status === 'rejected'"
		)
		const boardReset = gameweekSource.indexOf('setDreamTeam([])', boardFailure)
		assert.ok(overallFailure >= 0 && overallReset > overallFailure)
		assert.ok(boardFailure >= 0 && boardReset > boardFailure)

		const staleGuard = playerSource.indexOf(
			"if (result.status === 'superseded') return null"
		)
		const notFoundClear = playerSource.indexOf(
			'setSelectedPlayer(null)',
			staleGuard
		)
		assert.ok(staleGuard >= 0 && notFoundClear > staleGuard)
	})
})
