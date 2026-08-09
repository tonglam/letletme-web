import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatMySquadShareText } from '../app/data/fixtures/_lib/fixtures-share'
import type { SquadFdrRow } from '../lib/fixtures-fdr'

const labels = {
	title: 'My squad fixtures',
	none: 'No squad linked.',
	footer: 'letletme.com/fixtures',
}

const sampleRow: SquadFdrRow = {
	elementId: 10,
	teamId: 3,
	webName: 'Salah',
	teamShortName: 'LIV',
	elementTypeName: 'MIDFIELDER',
	positionCode: 'MID',
	position: 8,
	isStarter: true,
	isCaptain: true,
	isViceCaptain: false,
	avgFdr: 4.2,
	easyCount: 0,
	hardCount: 2,
	blankCount: 0,
	nextFdr: 5,
	nextOpponent: 'EVE',
	nextHome: true,
	gameweeks: [
		{
			eventId: 28,
			bgw: false,
			dgw: false,
			averageFdr: 5,
			fixtures: [
				{
					fixtureId: 2810,
					eventId: 28,
					opponentShortName: 'EVE',
					wasHome: true,
					difficulty: 5,
					finished: false,
				},
			],
		},
	],
	run: [
		{
			fixtureId: 2810,
			eventId: 28,
			opponentShortName: 'EVE',
			wasHome: true,
			difficulty: 5,
			finished: false,
		},
	],
	fixtureBand: 'difficult',
}

describe('formatMySquadShareText', () => {
	it('includes window, player line, and footer without plan labels', () => {
		const text = formatMySquadShareText({
			fromGw: 28,
			horizon: 3,
			rows: [sampleRow],
			labels,
		})
		assert.match(text, /My squad fixtures · GW28–30/)
		assert.match(text, /Salah LIV · MID · avg 4\.2 · GW28: EVE H\(5\)/)
		assert.doesNotMatch(text, /Starter|Bench|Captain|Vice/)
		assert.doesNotMatch(text, /Transfer out/)
		assert.match(text, /letletme\.com\/fixtures/)
	})

	it('shows empty message when no rows', () => {
		const text = formatMySquadShareText({
			fromGw: 28,
			horizon: 3,
			rows: [],
			labels,
		})
		assert.match(text, /No squad linked/)
	})
})
