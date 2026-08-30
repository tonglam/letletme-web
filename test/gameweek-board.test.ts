import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	mapGameweekBoardPlayers,
	resolveGameweekDisplayState,
} from '../lib/gameweek-board'
import type { LiveScore } from '../lib/graphql/operations/live'

const score = (
	id: number,
	points: number,
	position: string,
	inDreamTeam = false,
): LiveScore => ({
	player: {
		id,
		webName: `Player ${id}`,
		position,
		team: { name: 'Team', shortName: 'TST' },
	},
	inDreamTeam,
	totalPoints: points,
})

describe('gameweek boards', () => {
	it('keeps non-Dream-Team hauls in the independent points board', () => {
		const rows = mapGameweekBoardPlayers(
			[score(1, 12, 'FWD', false), score(2, 10, 'MID', true)],
			'points',
		)
		assert.deepEqual(rows.map(row => row.id), [1, 2])
	})

	it('uses explicit snapshot states and only authoritative event fallbacks', () => {
		assert.equal(resolveGameweekDisplayState('LIVE_ACTIVE', null), 'provisional')
		assert.equal(resolveGameweekDisplayState('FINALIZED', null), 'settled')
		assert.equal(resolveGameweekDisplayState('PRE_DEADLINE', null), 'scheduled')
		assert.equal(
			resolveGameweekDisplayState(null, {
				id: 1,
				deadlineTime: null,
				finished: false,
				isCurrent: false,
				isNext: true,
			}),
			'scheduled',
		)
		assert.equal(resolveGameweekDisplayState(null, null), null)
	})
})
