import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const read = (path: string) =>
	readFile(new URL(`../${path}`, import.meta.url), 'utf8')

describe('data governance consumer probe contract', () => {
	it('accepts versioned registry keys used by the Data probe', async () => {
		const source = await read(
			'app/api/ops/data-contracts/[contractKey]/route.ts'
		)
		assert.match(source, /CONTRACT_KEY = \/\^\[a-z0-9\]\[a-z0-9.-\]\{0,63\}\$\//)
	})

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

	it('bounds the directed MyFPL request and propagates cancellation', async () => {
		const route = await read(
			'app/api/ops/data-contracts/[contractKey]/route.ts'
		)
		const probe = await read('lib/data-governance-probe.ts')
		assert.match(route, /export const maxDuration = 30/)
		assert.match(route, /AbortSignal\.any\(\[request\.signal, timeoutController\.signal\]\)/)
		assert.match(route, /const INTERNAL_DEADLINE_MS = 8_000/)
		assert.match(route, /setTimeout\(\(\) => timeoutController\.abort\(\), INTERNAL_DEADLINE_MS\)/)
		assert.match(route, /timeoutMs: Math\.max\(1, deadlineAt - Date\.now\(\)\)/)
		assert.match(probe, /signal: options\.signal/)
		assert.match(probe, /Math\.min\(options\.timeoutMs \?\? 8_000, 8_000\)/)
		assert.match(probe, /canarySession\(config, entryId\)/)
		assert.match(probe, /consumerEntryId = result\.entryId/)
		assert.match(probe, /entryId: number/)
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
			'my-tournament-review-v2.1',
			'player-stats'
		]) {
			assert.match(source, new RegExp(`case '${contractKey}'`))
		}
		assert.match(source, /aggregate-only|aggregate metadata/)
		assert.match(source, /new Date\(\)\.toISOString\(\)/)
	})

	it('keeps MyFPL consumer counts and revision sourced from GraphQL', async () => {
		const source = await read('lib/data-governance-probe.ts')
		assert.match(source, /entryId\?: number \| null/)
		assert.match(source, /gameweek\.entry\?\.id !== entryId/)
		assert.match(source, /\{ eventId, snapshotRevision: null \}/)
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

	it('probes the versioned tournament review through its status consumer', async () => {
		const source = await read('lib/data-governance-probe.ts')
		assert.match(source, /GET_MY_TOURNAMENT_REVIEW_STATUS/)
		assert.match(source, /GET_MY_TOURNAMENT_GAMEWEEK_REVIEW/)
		assert.match(source, /contract: 'my-tournament-review-v2\.1'/)
		assert.match(source, /scope\.expectedSubjectCount/)
		assert.match(source, /scope\.readySubjectCount \+ scope\.notApplicableSubjectCount/)
		assert.match(source, /scope\.rowCount/)
		assert.match(source, /reviewPayloadMatchesScope\(/)
		assert.match(source, /payload\.points\.rows\.length/)
		assert.match(source, /payload\.points\.nextCursor/)
		assert.match(source, /payload\.h2h\.matches\.length/)
		assert.match(source, /payload\.h2h\.standings\.length/)
		assert.match(source, /payload\.h2h\.nextCursor/)
		assert.match(source, /payload\.knockout\.matches\.length/)
		assert.match(source, /payload\.knockout\.nextCursor/)
		assert.match(source, /reviewPageCursorMatches\(/)
		assert.match(source, /event\.format !== scope\.format/)
		assert.match(source, /review\.payload\.format !== scope\.format/)
		assert.match(source, /eventId > latestFinalizedEventId/)
		assert.match(source, /first: 1,[\s\S]*after: null\n\s*\}/)
		const reviewRead = source.slice(
			source.indexOf('GET_MY_TOURNAMENT_GAMEWEEK_REVIEW'),
			source.indexOf('const review =')
		)
		assert.doesNotMatch(reviewRead, /revision: statusRevision/)
		assert.match(source, /event\.state === 'READY'/)
		assert.match(source, /event\.readyAt !== null/)
		assert.match(source, /event\.publishedAt !== null/)
		assert.match(source, /event\.repairState === 'NONE'/)
		assert.match(source, /input\.producerRevision === statusRevision/)
		assert.match(source, /input\.expectedCount === expectedCount/)
		assert.match(source, /input\.observedCount === observedCount/)
	})
})
