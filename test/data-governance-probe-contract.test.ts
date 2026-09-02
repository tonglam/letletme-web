import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const read = (path: string) =>
	readFile(new URL(`../${path}`, import.meta.url), 'utf8')

describe('data governance consumer probe contract', () => {
	it('requires ready market evidence and a canonical, matching live revision', async () => {
		const source = await read('lib/data-governance-probe.ts')
		assert.match(source, /market\.status === 'READY'/)
		assert.match(source, /if \(desk\.scoreCoreRevision === null\)/)
		assert.match(source, /desk\.season !== season/)
		assert.doesNotMatch(
			source,
			/revision\(desk\.scoreCoreRevision \?\? desk\.coreRevision\)/
		)
	})

	it('does not follow redirects while sending the Data API credential', async () => {
		const source = await read('lib/data-governance-client.ts')
		assert.match(source, /redirect: 'error'/)
	})

	it('uses server-only canaries for every authenticated business contract', async () => {
		const source = await read('lib/data-governance-probe.ts')
		assert.match(source, /GET_ENTRY_LIVE_COMPETITION_BOARD/)
		assert.match(source, /entryLiveCompetitionBoard/)
		assert.doesNotMatch(source, /GET_TOURNAMENT_DETAIL_DESK/)
		for (const envName of [
			'DATA_GOVERNANCE_CANARY_ENTRY_ID',
			'DATA_GOVERNANCE_CANARY_TOURNAMENT_ID',
			'DATA_GOVERNANCE_CANARY_PLAYER_IDS'
		]) {
			assert.match(source, new RegExp(envName))
		}
		for (const contractKey of [
			'entry-data',
			'live-picks',
			'league-tournament',
			'official-h2h',
			'my-fpl',
			'player-stats'
		]) {
			assert.match(source, new RegExp(`case '${contractKey}'`))
		}
		assert.match(source, /aggregate-only|aggregate metadata/)
		assert.match(source, /new Date\(\)\.toISOString\(\)/)
	})

	it('keeps MyFPL consumer counts and revision sourced from GraphQL', async () => {
		const source = await read('lib/data-governance-probe.ts')
		assert.match(source, /expectedCount = result\.expectedCount/)
		assert.match(source, /observedCount = result\.observedCount/)
		assert.match(source, /input\.producerRevision === result\.revision/)
		assert.match(source, /input\.expectedCount === result\.expectedCount/)
		assert.match(source, /input\.observedCount === result\.observedCount/)
	})

	it('keeps entry readiness independent from publication-wide MyFPL coverage', async () => {
		const source = await read('lib/data-governance-probe.ts')
		assert.match(
			source,
			/complete: result\.complete && result\.coverageState === 'COMPLETE'/
		)
		assert.doesNotMatch(
			source,
			/gameweek\.state === 'READY'[\s\S]*meta\.coverageState === 'COMPLETE'/
		)
		assert.doesNotMatch(source, /finalRanksPresent/)
	})
})
