import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mapPlayersToSquadPitch } from '../app/live/points/_lib/live-points-squad-pitch'
import {
	squadPitchPlayerDetailsLabel,
	type SquadPitchLabels
} from '../components/squad-pitch/SquadPitch'
import { playerRowAriaLabel } from '../components/live/PlayerRow'

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

	it('preserves projected auto-sub roles for pitch and share rendering', () => {
		const [player] = mapPlayersToSquadPitch([
			{
				id: '13',
				name: 'Wilson',
				team: 'Fulham',
				teamShort: 'FUL',
				position: 'MID',
				playingStatus: 'FINISHED',
				isBench: true,
				autoSubRole: 'PREDICTED_IN',
				autoSubPartnerName: 'Sarr',
				stats: {
					minutes: 65,
					goals: 0,
					expectedGoals: 0,
					expectedAssists: 0,
					expectedGoalInvolvements: 0,
					expectedGoalsConceded: 0,
					assists: 1,
					saves: 0,
					savePenalty: 0,
					cleanSheets: 0,
					yellowCards: 0,
					redCards: 0,
					points: 3,
					bonusPoints: 0
				}
			}
		])

		assert.equal(player.autoSubRole, 'PREDICTED_IN')
		assert.equal(player.autoSubPartnerName, 'Sarr')
	})

	it('includes the auto-sub status in an interactive pitch card label', () => {
		const player = {
			id: '13',
			webName: 'Wilson',
			score: 3,
			position: 'MID' as const,
			autoSubRole: 'PREDICTED_IN' as const,
			autoSubPartnerName: 'Sarr'
		}
		const labels: SquadPitchLabels = {
			formation: 'Formation',
			positions: {
				GKP: 'Goalkeepers',
				DEF: 'Defenders',
				MID: 'Midfielders',
				FWD: 'Forwards'
			},
			captain: 'Captain',
			viceCaptain: 'Vice-captain',
			total: 'Total',
			autoSub: current =>
				`${current.webName} projected in for ${current.autoSubPartnerName}`,
			playerDetails: current => `View ${current.webName}`
		}

		assert.equal(
			squadPitchPlayerDetailsLabel(player, labels),
			'View Wilson; Wilson projected in for Sarr'
		)
	})

	it('includes the auto-sub status in an interactive list-row label', () => {
		assert.equal(
			playerRowAriaLabel('View Wilson', 'Wilson projected in for Sarr'),
			'View Wilson; Wilson projected in for Sarr'
		)
		assert.equal(playerRowAriaLabel('View Wilson', null), 'View Wilson')
	})
})
