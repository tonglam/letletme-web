import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PriceChangePlayer } from '../lib/graphql/operations/price-changes'
import { formatPriceChangeShareText } from '../app/data/price-changes/_lib/price-change-share'

const basePlayer: PriceChangePlayer = {
	playerId: 1,
	playerCode: 1,
	webName: 'Example',
	teamId: 1,
	teamName: 'Example FC',
	teamShortName: 'EXM',
	position: 'MID',
	currentPrice: 75,
	selectedByPercent: 12.3,
	progressPercent: 81.2,
	hourlyRate: 1,
	status: 'LIKELY_RISE',
	ownershipTrend: 'UP',
	transfersInEvent: 1200,
	transfersOutEvent: 200,
	lockedUntil: null,
	calibrating: false,
}

describe('formatPriceChangeShareText', () => {
	it('includes the active scope, local deadline label and current rows', () => {
		const text = formatPriceChangeShareText({
			players: [basePlayer],
			deadlineLabel: '23 Aug, 7:00 am AWST',
			labels: {
				title: 'Price Changes',
				scope: 'My squad',
				deadline: 'Deadline',
				progress: 'Progress',
				signal: 'Signal',
				movement: 'Net transfers',
				none: 'None',
				status: {
					VERY_LIKELY_RISE: 'Very likely rise',
					LIKELY_RISE: 'Likely rise',
					UNLIKELY: 'Unlikely',
					LIKELY_FALL: 'Likely fall',
					VERY_LIKELY_FALL: 'Very likely fall',
					LOCKED: 'Locked',
					CALIBRATING: 'Calibrating',
				},
				footer: 'https://letletme.top/en/explore/price-changes',
			},
		})

		assert.match(text, /Price Changes · My squad/)
		assert.match(text, /Deadline: 23 Aug, 7:00 am AWST/)
		assert.match(text, /Example EXM · £7\.5m · Progress \+81\.2%/)
		assert.match(text, /Net transfers \+1,000/)
		assert.match(text, /https:\/\/letletme\.top\/en\/explore\/price-changes/)
	})
})
