import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildFixturesGlance,
	filterFixtures,
	fixtureStatus,
	getDateKey,
	groupFixturesByDay,
} from '../lib/fixtures-desk'
import { formatFixturesShareText } from '../app/data/fixtures/_lib/fixtures-share'
import type { Fixture } from '../lib/graphql/operations/events'

function fixture(partial: Partial<Fixture> & { id: number }): Fixture {
	return {
		code: partial.id * 10,
		event: { id: 28, name: 'Gameweek 28' },
		kickoffTime: '2026-03-08T15:00:00.000Z',
		finished: false,
		started: false,
		homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS' },
		awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE' },
		homeScore: null,
		awayScore: null,
		homeTeamDifficulty: 3,
		awayTeamDifficulty: 4,
		...partial,
	}
}

describe('fixtureStatus', () => {
	it('classifies finished / live / upcoming', () => {
		assert.equal(fixtureStatus(fixture({ id: 1, finished: true })), 'finished')
		assert.equal(
			fixtureStatus(fixture({ id: 2, started: true, finished: false })),
			'live',
		)
		assert.equal(fixtureStatus(fixture({ id: 3 })), 'upcoming')
	})
})

describe('groupFixturesByDay', () => {
	it('groups and sorts by kickoff within a UTC day', () => {
		const fixtures = [
			fixture({
				id: 2,
				kickoffTime: '2026-03-08T17:30:00.000Z',
				homeTeam: { id: 3, name: 'Liverpool', shortName: 'LIV' },
				awayTeam: { id: 4, name: 'Everton', shortName: 'EVE' },
			}),
			fixture({
				id: 1,
				kickoffTime: '2026-03-08T12:30:00.000Z',
			}),
			fixture({
				id: 3,
				kickoffTime: '2026-03-09T15:00:00.000Z',
				homeTeam: { id: 5, name: 'City', shortName: 'MCI' },
				awayTeam: { id: 6, name: 'United', shortName: 'MUN' },
			}),
		]
		const groups = groupFixturesByDay(fixtures, {
			useLocalTime: false,
			locale: 'en-GB',
		})
		assert.equal(groups.length, 2)
		assert.equal(groups[0]!.fixtures[0]!.id, 1)
		assert.equal(groups[0]!.fixtures[1]!.id, 2)
		assert.equal(groups[1]!.fixtures[0]!.id, 3)
		assert.equal(
			getDateKey(new Date('2026-03-08T15:00:00.000Z'), false),
			'2026-03-08',
		)
	})
})

describe('buildFixturesGlance / filterFixtures', () => {
	it('counts finished and remaining', () => {
		const fixtures = [
			fixture({ id: 1, finished: true, homeScore: 2, awayScore: 1 }),
			fixture({ id: 2, started: true }),
			fixture({ id: 3 }),
		]
		const glance = buildFixturesGlance(fixtures)
		assert.equal(glance.total, 3)
		assert.equal(glance.finished, 1)
		assert.equal(glance.remaining, 2)
		assert.ok(glance.nextKickoff)

		assert.equal(filterFixtures(fixtures, 'finished').length, 1)
		assert.equal(filterFixtures(fixtures, 'upcoming').length, 2)
	})
})

describe('formatFixturesShareText', () => {
	it('formats a compact GW schedule', () => {
		const text = formatFixturesShareText({
			gameweek: 28,
			fixtures: [
				fixture({
					id: 1,
					finished: true,
					homeScore: 2,
					awayScore: 1,
					kickoffTime: '2026-03-08T15:00:00.000Z',
				}),
			],
			useLocalTime: false,
			locale: 'en-GB',
			labels: {
				title: 'Fixtures',
				none: 'None',
				footer: 'https://letletme.top/data/fixtures',
			},
		})
		assert.match(text, /^Fixtures · GW28/)
		assert.match(text, /ARS vs CHE · 2–1/)
		assert.match(text, /https:\/\/letletme\.top\/data\/fixtures$/)
	})
})
