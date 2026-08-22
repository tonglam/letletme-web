import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mapPlayersToSquadPitch } from '../app/live/points/_lib/live-points-squad-pitch'

describe('live-points squad pitch mapping', () => {
	it('does not throw when live team identity fields are absent', () => {
		assert.deepEqual(
			mapPlayersToSquadPitch([
				{
					id: '10',
					name: 'Player',
					team: undefined as unknown as string,
					teamShort: undefined as unknown as string,
					position: 'MID',
					playingStatus: 'NOT_STARTED',
					stats: {
						minutes: 0,
						goals: 0,
						expectedGoals: 0,
						expectedAssists: 0,
						expectedGoalInvolvements: 0,
						expectedGoalsConceded: 0,
						assists: 0,
						saves: 0,
						savePenalty: 0,
						cleanSheets: 0,
						yellowCards: 0,
						redCards: 0,
						points: 0,
						bonusPoints: 0
					}
				}
			]),
			[
				{
					id: '10',
					webName: 'Player',
					score: 0,
					teamBadgeLabel: '',
					position: 'MID',
					isCaptain: undefined,
					isViceCaptain: undefined
				}
			]
		)
	})
})
