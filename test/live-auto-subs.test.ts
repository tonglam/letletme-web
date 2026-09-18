import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { deriveLiveAutoSubProjection } from '../app/live/points/_lib/live-auto-subs'
import type { LivePick } from '../lib/graphql/operations/live'

const pick = (
	position: number,
	overrides: Partial<LivePick> = {}
): LivePick => ({
		element: 100 + position,
		elementType:
			position === 1 ? 1 : position <= 4 || position >= 14 ? 2 : position <= 8 ? 3 : 4,
		position,
		webName: `Player ${position}`,
		teamName: 'Team',
		teamShortName: 'TST',
		minutes: 0,
		goalsScored: 0,
		assists: 0,
		cleanSheets: 0,
		goalsConceded: 0,
		defensiveContribution: 0,
		ownGoals: 0,
		penaltiesSaved: 0,
		penaltiesMissed: 0,
		yellowCards: 0,
		redCards: 0,
		saves: 0,
		bonus: 0,
		bps: 0,
		totalPoints: 0,
		starts: false,
		isGwStarted: false,
		isGwFinished: false,
		isPlayed: false,
		isCaptain: position === 9,
		isViceCaptain: position === 10,
		multiplier: position === 9 ? 2 : position <= 11 ? 1 : 0,
		pickActive: position <= 11,
		autoSub: false,
		bgw: false,
		expectedGoals: 0,
		expectedAssists: 0,
		expectedGoalInvolvements: 0,
		expectedGoalsConceded: 0,
		inDreamTeam: false,
	...overrides
})

describe('live auto-sub projection', () => {
	it('uses the published projected XI when the score has already applied a later bench player', () => {
		const picks = Array.from({ length: 15 }, (_, index) => pick(index + 1))
		picks[10] = pick(11, {
			webName: 'Starter No-show',
			minutes: 0,
			isGwStarted: true,
			isGwFinished: true,
			isPlayed: false,
			multiplier: 0,
			pickActive: false
		})
		picks[12] = pick(13, {
			webName: 'First bench pending',
			elementType: 3,
			isGwStarted: false,
			isGwFinished: false,
			pickActive: false
		})
		picks[13] = pick(14, {
			webName: 'Second bench played',
			elementType: 2,
			minutes: 90,
			isGwStarted: true,
			isGwFinished: true,
			isPlayed: true,
			totalPoints: 7,
			multiplier: 1,
			pickActive: true,
			autoSub: true
		})

		const projection = deriveLiveAutoSubProjection({
			chip: 'NONE',
			pickList: picks,
			score: { delivery: { state: 'FRESH' } } as never,
			snapshot: { state: 'LIVE_ACTIVE' } as never
		})

		assert.equal(projection.state, 'PREDICTED')
		assert.deepEqual(projection.activePlayerIds.sort(), [
			...Array.from({ length: 10 }, (_, index) => String(index + 101)),
			'114'
		].sort())
		assert.deepEqual(projection.substitutions, [
			{
				playerInId: '114',
				playerInName: 'Second bench played',
				playerInOriginalPosition: 14,
				playerOutId: '111',
				playerOutName: 'Starter No-show',
				playerOutOriginalPosition: 11,
				state: 'PREDICTED'
			}
		])
	})
})
