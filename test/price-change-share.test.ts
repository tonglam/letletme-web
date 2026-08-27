import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PriceChangePlayer } from '../lib/graphql/operations/price-changes'
import {
	formatPriceChangeShareText,
	selectPriceChangeSharePlayers,
	selectPriceChangeSquadPlayers
} from '../app/data/price-changes/_lib/price-change-share'

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
	progressPercent: -81.2,
	hourlyRate: 1,
	status: 'LIKELY_FALL',
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
			updatedAtLabel: '27 Aug 2026, 10:11:12 am AWST',
			deadlineLabel: '23 Aug, 7:00 am AWST',
			labels: {
				title: 'Price Changes',
				scope: 'My squad',
				updated: 'Updated',
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
				footer: 'https://letletme.top/en/explore/price-predictions',
			},
		})

		assert.match(text, /Price Changes · My squad/)
		assert.match(text, /Updated: 27 Aug 2026, 10:11:12 am AWST/)
		assert.match(text, /Deadline: 23 Aug, 7:00 am AWST/)
		assert.match(text, /Example EXM · £7\.5m · Progress -81\.2%/)
		assert.match(text, /Net transfers \+1,000/)
		assert.match(text, /https:\/\/letletme\.top\/en\/explore\/price-predictions/)
	})

	it('keeps only likely-fall statuses in every prediction share source', () => {
		const players: PriceChangePlayer[] = [
			{ ...basePlayer, playerId: 1, status: 'LIKELY_RISE' },
			{ ...basePlayer, playerId: 2, status: 'LIKELY_FALL' },
			{ ...basePlayer, playerId: 3, status: 'VERY_LIKELY_FALL' },
			{ ...basePlayer, playerId: 4, status: 'UNLIKELY' }
		]

		const selected = selectPriceChangeSharePlayers(players)
		assert.deepEqual(
			selected.map(player => player.status),
			['LIKELY_FALL', 'VERY_LIKELY_FALL']
		)

		const text = formatPriceChangeShareText({
			players,
			labels: {
				title: 'Price Changes',
				scope: 'All players',
				updated: 'Updated',
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
					CALIBRATING: 'Calibrating'
				}
			}
		})

		assert.match(text, /Example EXM/)
		assert.equal(text.includes('Very likely rise'), false)
		assert.equal(text.includes('Unlikely'), false)
	})

	it('keeps a non-empty explanation when the selected scope has no fall rows', () => {
		const text = formatPriceChangeShareText({
			players: [{ ...basePlayer, status: 'LIKELY_RISE' }],
			labels: {
				title: 'Price Changes',
				scope: 'My squad',
				updated: 'Updated',
				deadline: 'Deadline',
				progress: 'Progress',
				signal: 'Signal',
				movement: 'Net transfers',
				none: 'No shareable fall predictions for this squad.',
				status: {
					VERY_LIKELY_RISE: 'Very likely rise',
					LIKELY_RISE: 'Likely rise',
					UNLIKELY: 'Unlikely',
					LIKELY_FALL: 'Likely fall',
					VERY_LIKELY_FALL: 'Very likely fall',
					LOCKED: 'Locked',
					CALIBRATING: 'Calibrating'
				}
			}
		})

		assert.match(text, /No shareable fall predictions for this squad\./)
	})

	it('matches linked squad picks by element id first and player identity second', () => {
		const players: PriceChangePlayer[] = [
			{ ...basePlayer, playerId: 10, webName: 'By id', teamShortName: 'ID' },
			{ ...basePlayer, playerId: 20, webName: 'By name', teamShortName: 'NAM' }
		]
		const picks = [
			{
				elementId: 10,
				webName: 'wrong name',
				teamShortName: 'WRONG',
				elementTypeName: 'MIDFIELDER',
				position: 1,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false
			},
			{
				elementId: null,
				webName: 'BY NAME',
				teamShortName: 'nam',
				elementTypeName: 'MIDFIELDER',
				position: 2,
				multiplier: 1,
				isCaptain: false,
				isViceCaptain: false
			}
		]

		assert.deepEqual(
			selectPriceChangeSquadPlayers(players, picks).map(player => player.webName),
			['By id', 'By name']
		)
	})
})
