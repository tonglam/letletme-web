import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildLivePointsEntryShareUrl,
	formatLivePointsShareText,
	formatShareFooter,
} from '../app/live/points/_lib/live-points-share'
import type { Player } from '../types/player'

const labels = {
	live: 'Live',
	net: 'Net',
	season: 'Season',
	chip: 'Chip',
	noChip: 'None',
	captain: 'C',
	startingXi: 'Starting XI',
	bench: 'Bench',
	statusPlaying: 'Live',
	statusFinished: 'FT',
	statusNotStarted: 'NS',
	pts: 'pts',
	hits: 'hits',
	footer: formatShareFooter(
		'Live points: {url}',
		'https://letletme.top/live/points/6953',
	),
}

function player(
	partial: Partial<Player> &
		Pick<Player, 'id' | 'name' | 'teamShort' | 'position' | 'playingStatus'> & {
			points: number
		},
): Player {
	return {
		id: partial.id,
		name: partial.name,
		team: partial.team ?? partial.teamShort,
		teamShort: partial.teamShort,
		position: partial.position,
		playingStatus: partial.playingStatus,
		isCaptain: partial.isCaptain,
		isViceCaptain: partial.isViceCaptain,
		isBench: partial.isBench,
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
			points: partial.points,
			bonusPoints: 0,
		},
	}
}

describe('formatShareFooter / buildLivePointsEntryShareUrl', () => {
	it('builds absolute entry live-points URLs', () => {
		assert.equal(
			buildLivePointsEntryShareUrl(6953, 'https://letletme.top'),
			'https://letletme.top/live/points/6953',
		)
		assert.equal(
			buildLivePointsEntryShareUrl(42, 'https://letletme.top', '/zh-CN'),
			'https://letletme.top/zh-CN/live/points/42',
		)
	})

	it('injects the url into the localized footer template', () => {
		assert.equal(
			formatShareFooter(
				'Live points: {url}',
				'https://letletme.top/live/points/6953',
			),
			'Live points: https://letletme.top/live/points/6953',
		)
		assert.equal(
			formatShareFooter(
				'实时积分：{url}',
				'https://letletme.top/zh-CN/live/points/6953',
			),
			'实时积分：https://letletme.top/zh-CN/live/points/6953',
		)
	})
})

describe('formatLivePointsShareText', () => {
	const starting: Player[] = [
		player({
			id: '1',
			name: 'Raya',
			teamShort: 'ARS',
			position: 'GKP',
			playingStatus: 'PLAYING',
			points: 7,
		}),
		player({
			id: '2',
			name: 'Haaland',
			teamShort: 'MCI',
			position: 'FWD',
			playingStatus: 'FINISHED',
			points: 17,
			isCaptain: true,
		}),
	]

	const bench: Player[] = [
		player({
			id: '3',
			name: 'João Pedro',
			teamShort: 'BHA',
			position: 'FWD',
			playingStatus: 'NOT_STARTED',
			points: 0,
			isBench: true,
		}),
	]

	it('formats header, chip, captain, XI and bench as a shareable md-ish list', () => {
		const text = formatLivePointsShareText({
			gameweek: 1,
			liveData: {
				entry: 6953,
				entryName: "Tong's Team",
				playerName: 'Tong Lam',
				livePoints: 101,
				liveNetPoints: 97,
				liveTotalPoints: 145,
				transferCost: 4,
				chip: null,
				captainName: 'Haaland',
			},
			startingPlayers: starting,
			benchPlayers: bench,
			labels,
		})

		assert.match(text, /^# Tong's Team · GW1/m)
		assert.match(text, /Tong Lam/)
		assert.match(text, /Live: \*\*101\*\* \(−4 hits\)/)
		assert.match(text, /Net: 97/)
		assert.match(text, /Season: 145/)
		assert.match(text, /Chip: None · C: Haaland/)
		assert.match(text, /## Starting XI/)
		assert.match(text, /- GKP ARS Raya · Live · 7 pts/)
		assert.match(text, /- FWD MCI Haaland \(C\) · FT · 17 pts/)
		assert.match(text, /## Bench/)
		assert.match(text, /- FWD BHA João Pedro · NS · 0 pts/)
		assert.match(
			text,
			/Live points: https:\/\/letletme\.top\/live\/points\/6953$/,
		)
	})

	it('omits hits when transfer cost is zero and shows chip name', () => {
		const text = formatLivePointsShareText({
			gameweek: 12,
			liveData: {
				entry: 1,
				entryName: 'Test FC',
				playerName: '',
				livePoints: 40,
				liveNetPoints: 40,
				liveTotalPoints: 400,
				transferCost: 0,
				chip: '3xc',
				captainName: 'Salah',
			},
			startingPlayers: starting.slice(0, 1),
			benchPlayers: [],
			labels: {
				...labels,
				footer: formatShareFooter(
					'Live points: {url}',
					'https://letletme.top/live/points/1',
				),
			},
		})

		assert.doesNotMatch(text, /hits/)
		assert.match(text, /Chip: Triple Captain/)
		assert.doesNotMatch(text, /## Bench/)
		// empty playerName should not leave a blank manager line
		assert.doesNotMatch(text, /^# Test FC · GW12\n\n/m)
		assert.match(text, /https:\/\/letletme\.top\/live\/points\/1$/)
	})

	it('falls back to entry id when team name is missing', () => {
		const text = formatLivePointsShareText({
			gameweek: 3,
			liveData: {
				entry: 42,
				entryName: undefined,
				livePoints: 10,
				liveNetPoints: 10,
				liveTotalPoints: 10,
				transferCost: 0,
				chip: '',
				captainName: '',
			},
			startingPlayers: [],
			benchPlayers: [],
			labels: { ...labels, footer: undefined },
		})

		assert.match(text, /# Entry 42 · GW3/)
		assert.match(text, /C: —/)
		assert.doesNotMatch(text, /https:\/\/letletme\.top/)
	})
})
