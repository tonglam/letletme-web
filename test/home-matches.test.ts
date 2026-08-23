import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHomeFixturesToMatchDays } from '../components/home/MatchesSection'
import type {
	HomeFixture,
	HomeFixturesResponse
} from '../lib/graphql/operations/home'

const fixture = (
	id: number,
	state: Pick<HomeFixture, 'started' | 'finished'>
): HomeFixture => ({
	id,
	eventId: 1,
	started: state.started,
	finished: state.finished,
	kickoffTime: `2026-08-23T${String(12 + id).padStart(2, '0')}:00:00.000Z`,
	homeTeam: { id: id * 2, name: `Home ${id}`, shortName: `H${id}` },
	awayTeam: { id: id * 2 + 1, name: `Away ${id}`, shortName: `A${id}` },
	homeScore: state.started ? 1 : null,
	awayScore: state.started ? 0 : null
})

const staleLiveMetadata: Pick<HomeFixturesResponse, 'source' | 'stale'> = {
	source: 'LIVE',
	stale: true
}

describe('Home match presentation', () => {
	it('marks only an in-progress fixture as delayed for a stale live publication', () => {
		const [day] = parseHomeFixturesToMatchDays(
			[
				fixture(1, { started: true, finished: true }),
				fixture(2, { started: true, finished: false }),
				fixture(3, { started: false, finished: false })
			],
			false,
			'en',
			staleLiveMetadata
		)

		assert.deepEqual(
			day.matches.map(match => ({ id: match.id, stale: match.stale })),
			[
				{ id: 1, stale: false },
				{ id: 2, stale: true },
				{ id: 3, stale: false }
			]
		)
	})

	it('does not mark a match delayed for a core fixture publication', () => {
		const [day] = parseHomeFixturesToMatchDays(
			[fixture(1, { started: true, finished: false })],
			false,
			'en',
			{ source: 'CORE', stale: true }
		)

		assert.equal(day.matches[0]?.stale, false)
	})
})
